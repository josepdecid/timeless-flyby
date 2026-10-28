import { cumulativeDistance, haversine, LocalProjection, locate, lerp } from './geo';
import { movingMask } from './motion';
import type { LatLon, TrackPoint } from './types';

/** A track is "on the route" when within this distance of the reference line. */
export const MATCH_RADIUS = 40;
/**
 * Off-route gaps shorter than this share of the reference (in reference distance), or than
 * GAP_FILL_MIN, don't split the common section: GPS drift, a tunnel, or a stretch of the course
 * that changed between editions of a race.
 */
const GAP_FILL_SHARE = 0.05;
const GAP_FILL_MIN = 250;
/** A track may go this far back in time between neighbouring vertices before it counts as a different pass. */
const ORDER_SLACK = 30_000;
/** A track jumping this far ahead in time between neighbouring vertices may have landed on another pass. */
const PASS_JUMP = 5 * 60_000;
/** Tighter radius used to pin down where the common section really begins and ends. */
const EDGE_RADIUS = 15;
/** How close a track must pass to the start line for that pass to count as a start. */
const START_RADIUS = 60;
/** Look-ahead window along the reference while projecting (plus distance travelled off-route). */
const LOOK_AHEAD = 150;
const LOOK_BEHIND = 30;
const MAX_START_CANDIDATES = 6;

export interface RefRoute {
  points: LatLon[];
  proj: LocalProjection;
  xy: Float64Array;
  cum: Float64Array;
  /** Unit direction of travel at each route vertex. */
  heading: Float32Array;
  length: number;
}

/** Samples each side averaged when building the route line, to keep GPS jitter out of its length. */
const ROUTE_SMOOTH = 1;
/** Minimum spacing of route vertices; drift while standing still collapses into one vertex. */
const ROUTE_SPACING = 5;

export function buildRoute(all: TrackPoint[]): RefRoute {
  // Standing still (waiting at the start, traffic lights) only adds drift to the line.
  const moving = movingMask(all);
  let raw = all.filter((_, i) => moving[i] || moving[i + 1]);
  if (raw.length < 2) raw = all;
  const n = raw.length;
  const smoothed = raw.map((_, i) => {
    const a = Math.max(0, i - ROUTE_SMOOTH);
    const b = Math.min(n - 1, i + ROUTE_SMOOTH);
    let lat = 0;
    let lon = 0;
    for (let k = a; k <= b; k++) {
      lat += raw[k].lat;
      lon += raw[k].lon;
    }
    return { lat: lat / (b - a + 1), lon: lon / (b - a + 1) };
  });
  const points: LatLon[] = [smoothed[0]];
  for (let i = 1; i < n; i++) {
    if (haversine(points[points.length - 1], smoothed[i]) >= ROUTE_SPACING || i === n - 1) points.push(smoothed[i]);
  }
  if (points.length < 2) points.push(smoothed[n - 1]);
  const proj = new LocalProjection(points[0]);
  const cum = cumulativeDistance(points);
  const xy = proj.project(points);
  return { points, proj, xy, cum, heading: headings(xy, 2), length: cum[cum.length - 1] };
}

/**
 * Unit direction of travel at each point, measured over ±span samples; zero when barely moving.
 * Used to tell the two legs of an out-and-back apart, or a warm-up run the wrong way along
 * the course, which are otherwise in exactly the same place.
 */
export function headings(xy: Float64Array, span = 3, minLen = 3): Float32Array {
  const n = xy.length / 2;
  const out = new Float32Array(xy.length);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - span);
    const b = Math.min(n - 1, i + span);
    const dx = xy[2 * b] - xy[2 * a];
    const dy = xy[2 * b + 1] - xy[2 * a + 1];
    const len = Math.hypot(dx, dy);
    if (len >= minLen) {
      out[2 * i] = dx / len;
      out[2 * i + 1] = dy / len;
    }
  }
  return out;
}

/** Same general direction (or unknown, when either is standing still). */
function sameWay(h1: Float32Array, i: number, h2: Float32Array, j: number): boolean {
  return h1[2 * i] * h2[2 * j] + h1[2 * i + 1] * h2[2 * j + 1] > -0.2;
}

export function positionAt(route: RefRoute, d: number): LatLon {
  const { i, f } = locate(route.cum, d);
  const a = route.points[i];
  const b = route.points[Math.min(i + 1, route.points.length - 1)];
  return { lat: lerp(a.lat, b.lat, f), lon: lerp(a.lon, b.lon, f) };
}

/** Distance along the route of the point on it closest to `p`. */
export function snapToRoute(route: RefRoute, p: LatLon): number {
  const [px, py] = route.proj.project([p]);
  let best = Infinity;
  let bestD = 0;
  for (let j = 0; j < route.points.length - 1; j++) {
    const r = segDist2(px, py, route.xy, j);
    if (r.d2 < best) {
      best = r.d2;
      bestD = lerp(route.cum[j], route.cum[j + 1], r.f);
    }
  }
  return bestD;
}

/**
 * Distance along the route of the point closest to `p`, among the passes within `tol` metres of
 * it. Loops and out-and-backs pass a spot more than once; `near` (a distance along the route)
 * picks the pass. Null when the route never comes within `tol`.
 */
export function matchOnRoute(route: RefRoute, p: LatLon, near: number, tol = 30): number | null {
  const [px, py] = route.proj.project([p]);
  const tol2 = tol * tol;
  let best: number | null = null;
  // Each run of consecutive route segments within reach is one pass; keep its closest point.
  let runD2 = Infinity;
  let runD = 0;
  const closeRun = () => {
    if (runD2 < Infinity && (best == null || Math.abs(runD - near) < Math.abs(best - near))) best = runD;
    runD2 = Infinity;
  };
  for (let j = 0; j < route.points.length - 1; j++) {
    const r = segDist2(px, py, route.xy, j);
    if (r.d2 > tol2) {
      closeRun();
      continue;
    }
    if (r.d2 < runD2) {
      runD2 = r.d2;
      runD = lerp(route.cum[j], route.cum[j + 1], r.f);
    }
  }
  closeRun();
  return best;
}

function segDist2(px: number, py: number, xy: Float64Array, j: number): { d2: number; f: number } {
  const ax = xy[2 * j];
  const ay = xy[2 * j + 1];
  const dx = xy[2 * j + 2] - ax;
  const dy = xy[2 * j + 3] - ay;
  const len2 = dx * dx + dy * dy;
  let f = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  f = f < 0 ? 0 : f > 1 ? 1 : f;
  const ex = ax + f * dx - px;
  const ey = ay + f * dy - py;
  return { d2: ex * ex + ey * ey, f };
}

/** Spatial hash of a polyline's segments, for "is anything of this track near here?" queries. */
class SegmentGrid {
  private cells = new Map<string, number[]>();
  private readonly heading: Float32Array;
  constructor(
    private readonly xy: Float64Array,
    private readonly cell: number,
  ) {
    this.heading = headings(xy);
    const n = xy.length / 2;
    for (let j = 0; j < n - 1; j++) {
      const x0 = Math.floor(Math.min(xy[2 * j], xy[2 * j + 2]) / cell);
      const x1 = Math.floor(Math.max(xy[2 * j], xy[2 * j + 2]) / cell);
      const y0 = Math.floor(Math.min(xy[2 * j + 1], xy[2 * j + 3]) / cell);
      const y1 = Math.floor(Math.max(xy[2 * j + 1], xy[2 * j + 3]) / cell);
      // A pathological long segment (signal loss) shouldn't blow up memory.
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) continue;
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const k = `${cx},${cy}`;
          const list = this.cells.get(k);
          if (list) list.push(j);
          else this.cells.set(k, [j]);
        }
    }
  }

  /**
   * A segment within `radius` of the point heading the same way as `h[k]`, or -1. When several
   * passes qualify (laps, a loop's start and finish), prefer the one just after `hint`.
   */
  match(px: number, py: number, radius: number, h: Float32Array, k: number, hint: number): number {
    const r2 = radius * radius;
    const cx = Math.floor(px / this.cell);
    const cy = Math.floor(py / this.cell);
    let best = -1;
    let bestCost = Infinity;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        const list = this.cells.get(`${cx + ox},${cy + oy}`);
        if (!list) continue;
        for (const j of list) {
          if (!sameWay(this.heading, j, h, k) || segDist2(px, py, this.xy, j).d2 > r2) continue;
          const cost = hint < 0 ? j : j >= hint ? j - hint : 4 * (hint - j);
          if (cost < bestCost) {
            bestCost = cost;
            best = j;
          }
        }
      }
    return best;
  }
}

export interface Section {
  startD: number;
  endD: number;
}

/**
 * The longest stretch of the reference route that every other track also covers.
 * Warm-ups, cool-downs and detours fall outside it.
 */
export function detectCommonSection(ref: RefRoute, others: TrackPoint[][]): Section {
  const n = ref.points.length;
  const covered = new Uint8Array(n).fill(1);
  // breakBefore[j]: some track jumps back in time between vertex j-1 and j, i.e. the two sides
  // are covered by different parts of that track (its finish vs its start, say).
  const breakBefore = new Uint8Array(n);
  const gapFill = Math.max(GAP_FILL_MIN, GAP_FILL_SHARE * ref.length);
  const grids = others.map((pts) => new SegmentGrid(ref.proj.project(pts), MATCH_RADIUS));
  grids.forEach((grid, g) => {
    const times = others[g];
    let prev = -1;
    // After a jump ahead in time: the last match before it, where it landed, and the vertex it
    // happened at. If the track comes back to just after `anchor` within gapFill, the jump was
    // onto another pass of the same road (its finish, where the reference took a variant near
    // the start) and those vertices weren't covered by this pass after all. Until then, going
    // back in time is only a break if it turns out to be one.
    let anchor = -1;
    let landed = -1;
    let jumpAt = 0;
    let pendingBreak = -1;
    const confirmJump = () => {
      if (pendingBreak >= 0) breakBefore[pendingBreak] = 1;
      anchor = -1;
      pendingBreak = -1;
    };
    for (let j = 0; j < n; j++) {
      if (anchor >= 0 && ref.cum[j] - ref.cum[jumpAt] > gapFill) confirmJump();
      const x = ref.xy[2 * j];
      const y = ref.xy[2 * j + 1];
      const m = grid.match(x, y, MATCH_RADIUS, ref.heading, j, prev);
      if (m < 0) {
        covered[j] = 0;
        continue;
      }
      if (anchor >= 0) {
        const r = grid.match(x, y, MATCH_RADIUS, ref.heading, j, anchor);
        const dt = times[r].t - times[anchor].t;
        if (dt >= -ORDER_SLACK && dt < times[landed].t - times[r].t) {
          covered.fill(0, jumpAt, j);
          anchor = -1;
          pendingBreak = -1;
          prev = r;
          continue;
        }
      }
      if (prev >= 0 && times[m].t < times[prev].t - ORDER_SLACK) {
        if (anchor < 0) breakBefore[j] = 1;
        else if (pendingBreak < 0) pendingBreak = j;
      } else if (prev >= 0 && anchor < 0 && times[m].t > times[prev].t + PASS_JUMP) {
        anchor = prev;
        landed = m;
        jumpAt = j;
      }
      prev = m;
    }
    confirmJump();
  });

  // Bridge short uncovered gaps so they don't split the section, as long as every track picks
  // the route back up where it left it (not with a different part of itself).
  let j = 0;
  while (j < n) {
    if (covered[j]) {
      j++;
      continue;
    }
    let k = j;
    while (k < n && !covered[k]) k++;
    if (j > 0 && k < n && !breakBefore[k] && ref.cum[k] - ref.cum[j - 1] < gapFill) covered.fill(1, j, k);
    j = k;
  }

  let best: { a: number; b: number } | null = null;
  j = 0;
  while (j < n) {
    if (!covered[j]) {
      j++;
      continue;
    }
    let k = j;
    while (k + 1 < n && covered[k + 1] && !breakBefore[k + 1]) k++;
    if (!best || ref.cum[k] - ref.cum[j] > ref.cum[best.b] - ref.cum[best.a]) best = { a: j, b: k };
    j = k + 1;
  }
  // Nothing in common: fall back to the whole reference so the user can still trim manually.
  if (!best || ref.cum[best.b] - ref.cum[best.a] < 1) return { startD: 0, endD: ref.length };

  // MATCH_RADIUS lets the section spill up to ~40 m past where the others start/stop; walk
  // the edges inward until every track is close by.
  const allNear = (i: number) =>
    grids.every((g) => g.match(ref.xy[2 * i], ref.xy[2 * i + 1], EDGE_RADIUS, ref.heading, i, -1) >= 0);
  let { a, b } = best;
  const a0 = a;
  const b0 = b;
  while (a < b && !allNear(a) && ref.cum[a] - ref.cum[a0] < 2 * MATCH_RADIUS) a++;
  while (b > a && !allNear(b) && ref.cum[b0] - ref.cum[b] < 2 * MATCH_RADIUS) b--;
  if (ref.cum[b] - ref.cum[a] < 1) ({ a, b } = best);
  return { startD: ref.cum[a], endD: ref.cum[b] };
}

export interface AlignedTrack {
  /** Absolute sample times (ms) and their monotone distance along the reference (m). */
  t: Float64Array;
  d: Float64Array;
  /** Interpolated moments the track crossed the section's start and end. */
  tStart: number;
  tEnd: number;
  finished: boolean;
  /** Furthest reference distance reached, capped at the section end. */
  reachedD: number;
  /** Share of samples inside the section that were further than MATCH_RADIUS from the route. */
  offRoute: number;
  /** How many passes by the start line lead along the whole route; the user can pick another. */
  passCount: number;
  passUsed: number;
}

export function alignTrack(
  pts: TrackPoint[],
  ref: RefRoute,
  section: Section,
  preferredPass?: number,
): AlignedTrack {
  const xy = ref.proj.project(pts);
  const heading = headings(xy);
  const candidates = startCandidates(xy, ref, section.startD);
  const runs = candidates.map((i0) => {
    const r = project(pts, xy, heading, ref, section, i0);
    return finalize(r.t, r.d, r.on, section);
  });

  // Only passes that get (nearly) as far along the route as the best one are real starts;
  // passing the start again at the finish of a loop isn't.
  const progress = (r: Omit<AlignedTrack, 'passCount' | 'passUsed'>) => r.reachedD - section.startD;
  const best = Math.max(...runs.map(progress));
  const viable = runs.filter((r) => progress(r) >= 0.95 * best);

  // Default to the one covering the route most efficiently: a warm-up through the start line
  // followed by a detour loses.
  let pick = 0;
  let pickRate = Infinity;
  viable.forEach((r, k) => {
    const rate = (r.tEnd - r.tStart) / Math.max(1, progress(r));
    if (rate < pickRate - 1e-9) {
      pick = k;
      pickRate = rate;
    }
  });
  if (preferredPass !== undefined && preferredPass >= 0 && preferredPass < viable.length) pick = preferredPass;
  return { ...viable[pick], passCount: viable.length, passUsed: pick };
}

/** Track point indices where separate passes by the start line begin their closest approach. */
function startCandidates(xy: Float64Array, ref: RefRoute, startD: number): number[] {
  const s = positionAt(ref, startD);
  const [sx, sy] = ref.proj.project([s]);
  const n = xy.length / 2;
  const out: number[] = [];
  let groupBest = -1;
  let groupBestD2 = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const { d2, f } = segDist2(sx, sy, xy, i);
    if (d2 <= START_RADIUS * START_RADIUS) {
      if (d2 < groupBestD2) {
        groupBestD2 = d2;
        // Start projecting from the segment's first point so the crossing is interpolated.
        groupBest = f > 0.999 ? i + 1 : i;
      }
    } else if (groupBest >= 0) {
      out.push(groupBest);
      groupBest = -1;
      groupBestD2 = Infinity;
    }
  }
  if (groupBest >= 0) out.push(groupBest);
  if (out.length === 0) {
    // Never passed the start (recording began late or elsewhere): use the closest point.
    let best = 0;
    let bestD2 = Infinity;
    for (let i = 0; i < n; i++) {
      const d2 = (xy[2 * i] - sx) ** 2 + (xy[2 * i + 1] - sy) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    out.push(best);
  }
  return out.slice(0, MAX_START_CANDIDATES);
}

/**
 * Walks the track forward from `i0`, matching each sample to the reference within a sliding
 * window ahead of the last match. The window is what keeps loops, laps and out-and-back
 * courses from snapping onto the wrong pass of the same road.
 */
function project(
  pts: TrackPoint[],
  xy: Float64Array,
  heading: Float32Array,
  ref: RefRoute,
  section: Section,
  i0: number,
) {
  const nSeg = ref.points.length - 1;
  const n = pts.length;
  const t: number[] = [];
  const d: number[] = [];
  const on: number[] = [];

  // Initial cursor: nearest reference segment around the start line.
  let cursor = 0;
  {
    let best = Infinity;
    for (let j = 0; j < nSeg; j++) {
      if (ref.cum[j + 1] < section.startD - 300) continue;
      if (ref.cum[j] > section.startD + 300) break;
      if (!sameWay(heading, i0, ref.heading, j)) continue;
      const r = segDist2(xy[2 * i0], xy[2 * i0 + 1], ref.xy, j);
      if (r.d2 < best) {
        best = r.d2;
        cursor = j;
      }
    }
  }

  let lastD = -Infinity;
  let travelled = 0; // since the last on-route match
  const r2 = MATCH_RADIUS * MATCH_RADIUS;
  for (let i = i0; i < n; i++) {
    if (i > i0) travelled += Math.hypot(xy[2 * i] - xy[2 * i - 2], xy[2 * i + 1] - xy[2 * i - 1]);
    const maxAhead = ref.cum[cursor] + LOOK_AHEAD + 1.5 * travelled;
    const minBack = ref.cum[cursor] - LOOK_BEHIND;

    let bestD2 = Infinity;
    let bestJ = -1;
    let bestF = 0;
    for (let j = cursor; j >= 0 && ref.cum[j + 1] >= minBack; j--) {
      if (!sameWay(heading, i, ref.heading, j)) continue;
      const r = segDist2(xy[2 * i], xy[2 * i + 1], ref.xy, j);
      if (r.d2 < bestD2) {
        bestD2 = r.d2;
        bestJ = j;
        bestF = r.f;
      }
    }
    for (let j = cursor + 1; j < nSeg && ref.cum[j] <= maxAhead; j++) {
      if (!sameWay(heading, i, ref.heading, j)) continue;
      const r = segDist2(xy[2 * i], xy[2 * i + 1], ref.xy, j);
      if (r.d2 < bestD2) {
        bestD2 = r.d2;
        bestJ = j;
        bestF = r.f;
      }
    }

    let onRoute = 0;
    if (bestJ >= 0 && bestD2 <= r2) {
      const matched = lerp(ref.cum[bestJ], ref.cum[bestJ + 1], bestF);
      // Distance never goes backwards: GPS jitter becomes a short plateau instead.
      lastD = Math.max(lastD, matched);
      if (bestJ > cursor) cursor = bestJ;
      travelled = 0;
      onRoute = 1;
    } else if (lastD === -Infinity) {
      lastD = ref.cum[cursor];
    }
    t.push(pts[i].t);
    d.push(lastD);
    on.push(onRoute);
    if (lastD >= section.endD) break;
  }
  return { t: Float64Array.from(t), d: Float64Array.from(d), on: Uint8Array.from(on) };
}

/** Start crossing is measured this far past the line, then extrapolated back: robust to drift while waiting. */
const START_TOL = 10;
/** A track ending this close to the section end still counts as finished (watch stopped a bit early). */
const END_TOL = 30;

function finalize(
  t: Float64Array,
  d: Float64Array,
  on: Uint8Array,
  section: Section,
): Omit<AlignedTrack, 'passCount' | 'passUsed'> {
  const n = t.length;
  const { startD, endD } = section;
  const tol = Math.min(START_TOL, (endD - startD) / 4);

  let tStart: number;
  let k = 0;
  while (k < n && d[k] <= startD + tol) k++;
  if (k === n) {
    tStart = t[0];
  } else if (k === 0) {
    // Recording started past the start line: extrapolate back at the early speed.
    const v = speedFrom(t, d, 0);
    tStart = v > 0 && d[0] - startD < 200 ? t[0] - (d[0] - startD) / v : t[0];
  } else {
    const tTol = crossing(t, d, k, startD + tol);
    const v = speedFrom(t, d, k);
    tStart = v > 0 ? tTol - tol / v : tTol;
  }

  let tEnd: number;
  let finished = false;
  let e = k;
  while (e < n && d[e] < endD) e++;
  const maxD = d[n - 1];
  let f = n - 1;
  while (f > 0 && d[f - 1] === maxD) f--;
  if (e < n && e > 0) {
    tEnd = crossing(t, d, e, endD);
    finished = true;
  } else if (maxD >= endD - END_TOL) {
    const v = speedBefore(t, d, f);
    tEnd = v > 0 ? t[f] + (endD - maxD) / v : t[f];
    finished = true;
  } else {
    // Didn't finish: end at the first moment the furthest point was reached.
    tEnd = t[f];
  }

  let off = 0;
  let inside = 0;
  for (let i = 0; i < n; i++) {
    if (t[i] < tStart || t[i] > tEnd) continue;
    inside++;
    if (!on[i]) off++;
  }

  return {
    t,
    d,
    tStart,
    tEnd,
    finished,
    reachedD: finished ? endD : Math.min(maxD, endD),
    offRoute: inside ? off / inside : 1,
  };
}

/** Speed (m/ms) over the ~40 m following sample i. */
function speedFrom(t: Float64Array, d: Float64Array, i: number): number {
  let m = i;
  while (m < t.length - 1 && d[m] - d[i] < 40) m++;
  return m > i && t[m] > t[i] ? (d[m] - d[i]) / (t[m] - t[i]) : 0;
}

/** Speed (m/ms) over the ~40 m leading up to sample i. */
function speedBefore(t: Float64Array, d: Float64Array, i: number): number {
  let m = i;
  while (m > 0 && d[i] - d[m] < 40) m--;
  return m < i && t[i] > t[m] ? (d[i] - d[m]) / (t[i] - t[m]) : 0;
}

function crossing(t: Float64Array, d: Float64Array, k: number, target: number): number {
  const d0 = d[k - 1];
  const d1 = d[k];
  if (d1 === d0) return t[k];
  return lerp(t[k - 1], t[k], (target - d0) / (d1 - d0));
}
