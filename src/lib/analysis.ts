import {
  alignTrack,
  buildRoute,
  detectCommonSection,
  matchOnRoute,
  positionAt,
  snapToRoute,
  type AlignedTrack,
  type RefRoute,
  type Section,
} from './align';
import { interp, lerp, locate, upperBound } from './geo';
import { movingMask } from './motion';
import type { Activity, CustomSegment, LatLon, MetricKey, TrackPoint } from './types';

export type TimeMode = 'elapsed' | 'moving';

/**
 * Maps between absolute time and normalised seconds since the track crossed the start line.
 * In 'moving' mode stopped time is removed, so a traffic light doesn't count against you.
 */
export class Timeline {
  private readonly times: Float64Array;
  private readonly mov: Float64Array;
  private readonly m0: number;
  constructor(
    points: TrackPoint[],
    private readonly t0: number,
    private readonly mode: TimeMode,
  ) {
    this.times = Float64Array.from(points, (p) => p.t);
    const moving = movingMask(points);
    this.mov = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      this.mov[i] = this.mov[i - 1] + (moving[i] ? (points[i].t - points[i - 1].t) / 1000 : 0);
    }
    this.m0 = interp(this.times, this.mov, t0);
  }
  /** Normalised seconds at absolute time `t` (ms). */
  el(t: number): number {
    if (this.mode === 'elapsed') return (t - this.t0) / 1000;
    return interp(this.times, this.mov, t) - this.m0;
  }
  /** Absolute time (ms) at normalised seconds `e`. */
  abs(e: number): number {
    if (this.mode === 'elapsed') return this.t0 + e * 1000;
    const target = e + this.m0;
    if (target <= this.mov[0]) return this.times[0];
    return interp(this.mov, this.times, target);
  }
}

type Series = (number | null)[];

export interface TrackSeries {
  activity: Activity;
  aligned: AlignedTrack;
  timeline: Timeline;
  /** Normalised seconds to cover the section (or the part reached, if unfinished). */
  duration: number;
  /** Per grid point: normalised seconds to reach it. null beyond what the track covered. */
  time: Series;
  /** Per grid point: seconds ahead of the reference (positive = ahead). */
  ahead: Series;
  metrics: Partial<Record<MetricKey, Series>>;
}

export interface Comparison {
  ref: RefRoute;
  refId: string;
  section: Section;
  autoSection: Section;
  length: number;
  /** Distance from the section start, metres. */
  grid: number[];
  routeAt: LatLon[];
  tracks: TrackSeries[];
  maxDuration: number;
}

export interface SectionOverride {
  start: LatLon;
  end: LatLon;
}

export interface CompareOptions {
  timeMode: TimeMode;
  section?: SectionOverride | null;
  /** Which start-line pass to use, per activity id. */
  passes?: Record<string, number>;
}

export function compare(activities: Activity[], refId: string, opts: CompareOptions): Comparison | null {
  const refAct = activities.find((a) => a.id === refId);
  if (!refAct || activities.length === 0) return null;
  const others = activities.filter((a) => a.id !== refId);
  const ref = buildRoute(refAct.points);

  const autoSection = detectCommonSection(
    ref,
    others.map((a) => a.points),
  );
  let section = autoSection;
  if (opts.section) {
    const s = snapToRoute(ref, opts.section.start);
    const e = snapToRoute(ref, opts.section.end);
    if (e - s > 10) section = { startD: s, endD: e };
  }
  const length = section.endD - section.startD;

  const step = Math.max(2, length / 1500);
  const grid: number[] = [];
  for (let x = 0; x < length; x += step) grid.push(x);
  grid.push(length);
  const routeAt = grid.map((x) => positionAt(ref, section.startD + x));

  const smoothHalf = Math.max(1, Math.round(Math.min(300, Math.max(30, length / 150)) / step));

  const tracks: TrackSeries[] = [];
  for (const act of [refAct, ...others]) {
    const aligned = alignTrack(act.points, ref, section, opts.passes?.[act.id]);
    const timeline = new Timeline(act.points, aligned.tStart, opts.timeMode);
    const duration = timeline.el(aligned.tEnd);

    const time: Series = grid.map((x) => {
      const d = section.startD + x;
      if (d > aligned.reachedD + 1e-6) return null;
      if (x === 0) return 0;
      return Math.max(0, timeline.el(interp(aligned.d, aligned.t, d)));
    });
    if (aligned.finished) time[time.length - 1] = duration;

    tracks.push({
      activity: act,
      aligned,
      timeline,
      duration,
      time,
      ahead: [],
      metrics: buildMetrics(act.points, aligned, section.startD, time, grid, smoothHalf),
    });
  }

  const refTime = tracks[0].time;
  for (const tr of tracks) {
    tr.ahead = tr.time.map((t, j) => (t == null || refTime[j] == null ? null : refTime[j]! - t));
  }

  return {
    ref,
    refId,
    section,
    autoSection,
    length,
    grid,
    routeAt,
    tracks,
    maxDuration: Math.max(...tracks.map((t) => t.duration)),
  };
}

function buildMetrics(
  points: TrackPoint[],
  aligned: AlignedTrack,
  startD: number,
  time: Series,
  grid: number[],
  half: number,
): Partial<Record<MetricKey, Series>> {
  const out: Partial<Record<MetricKey, Series>> = {};
  const n = grid.length;

  // Speed straight from the alignment, so every track is measured along the same line.
  const speed: Series = new Array(n).fill(null);
  for (let j = 0; j < n; j++) {
    if (time[j] == null) continue;
    let a = Math.max(0, j - half);
    let b = Math.min(n - 1, j + half);
    while (time[b] == null && b > j) b--;
    while (time[a] == null && a < j) a++;
    const dt = (time[b] as number) - (time[a] as number);
    if (b > a && dt > 0) speed[j] = (grid[b] - grid[a]) / dt;
  }
  out.speed = speed;

  // Absolute time at each grid point, straight from the alignment (unambiguous across stops).
  const absAt: Series = time.map((t, j) => (t == null ? null : interp(aligned.d, aligned.t, startD + grid[j])));

  for (const key of ['ele', 'hr', 'cad', 'pwr'] as const) {
    const ts: number[] = [];
    const vs: number[] = [];
    for (const p of points) {
      const v = p[key];
      if (v != null) {
        ts.push(p.t);
        vs.push(v);
      }
    }
    if (ts.length < 2) continue;
    const raw: Series = absAt.map((t) => (t == null ? null : interp(ts, vs, t)));
    out[key] = movingAverage(raw, key === 'ele' ? Math.max(1, half >> 1) : half);
  }
  return out;
}

function movingAverage(s: Series, half: number): Series {
  const n = s.length;
  const sum = new Float64Array(n + 1);
  const cnt = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    sum[i + 1] = sum[i] + (s[i] ?? 0);
    cnt[i + 1] = cnt[i] + (s[i] == null ? 0 : 1);
  }
  return s.map((v, i) => {
    if (v == null) return null;
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    return (sum[b] - sum[a]) / (cnt[b] - cnt[a]);
  });
}

/** Normalised seconds for track `tr` to reach `x` metres into the section (exact, not grid). */
export function elapsedAt(cmp: Comparison, tr: TrackSeries, x: number): number | null {
  const d = cmp.section.startD + x;
  if (d > tr.aligned.reachedD + 1e-6) return null;
  if (x <= 0) return 0;
  if (tr.aligned.finished && x >= cmp.length) return tr.duration;
  return Math.max(0, tr.timeline.el(interp(tr.aligned.d, tr.aligned.t, d)));
}

export interface ReplayState {
  id: string;
  pos: LatLon;
  /** Metres into the section. */
  x: number;
  finished: boolean;
}

export function replayState(cmp: Comparison, tr: TrackSeries, e: number): ReplayState {
  const clampedE = Math.min(Math.max(e, 0), tr.duration);
  const abs = Math.min(Math.max(tr.timeline.abs(clampedE), tr.aligned.tStart), tr.aligned.tEnd);
  return positionOf(cmp, tr, abs, e >= tr.duration);
}

/** Where track `tr` was when it had covered `x` metres of the section (for chart hover). */
export function positionAtX(cmp: Comparison, tr: TrackSeries, x: number): LatLon | null {
  const d = cmp.section.startD + x;
  if (d > tr.aligned.reachedD + 1e-6) return null;
  return positionOf(cmp, tr, interp(tr.aligned.d, tr.aligned.t, d), false).pos;
}

const timeCache = new WeakMap<TrackPoint[], Float64Array>();
function pointTimes(points: TrackPoint[]): Float64Array {
  let ts = timeCache.get(points);
  if (!ts) {
    ts = Float64Array.from(points, (p) => p.t);
    timeCache.set(points, ts);
  }
  return ts;
}

function positionOf(cmp: Comparison, tr: TrackSeries, abs: number, finished: boolean): ReplayState {
  const pts = tr.activity.points;
  const { i, f } = locate(pointTimes(pts), abs);
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  const d = interp(tr.aligned.t, tr.aligned.d, abs);
  return {
    id: tr.activity.id,
    pos: { lat: lerp(a.lat, b.lat, f), lon: lerp(a.lon, b.lon, f) },
    x: Math.min(Math.max(d - cmp.section.startD, 0), cmp.length),
    finished,
  };
}

export interface Split {
  index: number;
  from: number;
  to: number;
  /** Per track (same order as cmp.tracks): split seconds, or null if not covered. */
  times: (number | null)[];
  cumulative: (number | null)[];
  fastest: number;
}

export function computeSplits(cmp: Comparison, splitLength: number): Split[] {
  const out: Split[] = [];
  const bounds = distanceRanges(cmp.length, splitLength).map((r) => r.to);
  let prev = 0;
  const prevT = cmp.tracks.map(() => 0 as number | null);
  bounds.forEach((to, index) => {
    const cumulative = cmp.tracks.map((tr) => elapsedAt(cmp, tr, to));
    const times = cumulative.map((c, k) => (c == null || prevT[k] == null ? null : c - prevT[k]!));
    let fastest = -1;
    times.forEach((t, k) => {
      if (t != null && (fastest < 0 || t < times[fastest]!)) fastest = k;
    });
    out.push({ index, from: prev, to, times, cumulative, fastest });
    cumulative.forEach((c, k) => (prevT[k] = c));
    prev = to;
  });
  return out;
}

/** A stretch of the section, metres from its start. */
export interface SegmentRange {
  from: number;
  to: number;
}

/** `count` equal stretches covering the whole section. */
export function evenRanges(length: number, count: number): SegmentRange[] {
  const n = Math.max(1, Math.round(count));
  return Array.from({ length: n }, (_, i) => ({ from: (length * i) / n, to: (length * (i + 1)) / n }));
}

/** Stretches of `step` metres from the start; the last one takes whatever is left. */
export function distanceRanges(length: number, step: number): SegmentRange[] {
  const out: SegmentRange[] = [];
  let from = 0;
  for (let x = step; x < length - 1; x += step) {
    out.push({ from, to: x });
    from = x;
  }
  out.push({ from, to: length });
  return out;
}

export interface SegmentStat extends SegmentRange {
  /** Per track (same order as cmp.tracks): seconds spent on the stretch, or null if not covered. */
  times: (number | null)[];
  /** Index into cmp.tracks of the quickest track here, -1 if none. */
  fastest: number;
}

export function segmentStats(cmp: Comparison, ranges: SegmentRange[]): SegmentStat[] {
  return ranges.map(({ from, to }) => {
    const times = cmp.tracks.map((tr) => {
      const a = elapsedAt(cmp, tr, from);
      const b = elapsedAt(cmp, tr, to);
      return a == null || b == null ? null : b - a;
    });
    let fastest = -1;
    times.forEach((t, k) => {
      if (t != null && (fastest < 0 || t < times[fastest]!)) fastest = k;
    });
    return { from, to, times, fastest };
  });
}

/** The reference line between two points of the section, for drawing a stretch on the map. */
export function routeBetween(cmp: Comparison, from: number, to: number): LatLon[] {
  const at = (x: number) => positionAt(cmp.ref, cmp.section.startD + x);
  const out = [at(from)];
  for (let j = upperBound(cmp.grid, from); j < cmp.grid.length && cmp.grid[j] < to; j++) out.push(cmp.routeAt[j]);
  out.push(at(to));
  return out;
}

/** Where a saved segment lies on this comparison's section, or null when it isn't on it. */
export function placeSegment(cmp: Comparison, seg: CustomSegment): SegmentRange | null {
  const a = matchOnRoute(cmp.ref, seg.start, seg.near[0]);
  const b = matchOnRoute(cmp.ref, seg.end, seg.near[1]);
  if (a == null || b == null) return null;
  // A few metres of slack, so a segment dragged right onto the start or finish still counts.
  const slack = 10;
  const from = a - cmp.section.startD;
  const to = b - cmp.section.startD;
  if (from < -slack || to > cmp.length + slack || to - from < 1) return null;
  return { from: Math.max(0, from), to: Math.min(cmp.length, to) };
}

/** Geometry to save for a segment covering `from`–`to` metres of the section. */
export function segmentGeometry(cmp: Comparison, from: number, to: number): Pick<CustomSegment, 'start' | 'end' | 'near'> {
  const a = cmp.section.startD + from;
  const b = cmp.section.startD + to;
  return { start: positionAt(cmp.ref, a), end: positionAt(cmp.ref, b), near: [a, b] };
}
