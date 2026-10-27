import {
  compare,
  distanceRanges,
  evenRanges,
  placeSegment,
  segmentGeometry,
  type Comparison,
  type SectionOverride,
  type SegmentRange,
  type TimeMode,
} from './analysis';
import { MAX_TRACKS } from './colors';
import { defaultSpeedMode, type SpeedMode, type Units } from './format';
import { parseFile } from './parse';
import {
  loadActivities,
  loadSegments,
  loadSession,
  loadSettings,
  saveActivities,
  saveSegments,
  saveSession,
  saveSettings,
} from './storage';
import type { Activity, CustomSegment } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type MapColorMode = 'tracks' | 'gain' | 'fastest';
export type BaseMap = 'auto' | 'osm' | 'topo' | 'satellite';
export type SegmentMode = 'even' | 'distance' | 'custom';
export const STAT_VIEWS = ['ahead', 'speed', 'pace', 'ele', 'hr', 'cad', 'pwr', 'splits', 'segments'] as const;
export type StatView = (typeof STAT_VIEWS)[number];

export const DEFAULT_CHART_HEIGHT = 280;
export const MAX_EVEN_SEGMENTS = 120;

/** Stretch lengths offered for "by distance" map colouring, in metres. */
export const SEGMENT_LENGTHS: Record<Units, [number, string][]> = {
  metric: [
    [100, '100 m'],
    [200, '200 m'],
    [500, '500 m'],
    [1000, '1 km'],
    [2000, '2 km'],
    [5000, '5 km'],
    [10000, '10 km'],
  ],
  imperial: [
    [160.9344, '0.1 mi'],
    [402.336, '¼ mi'],
    [804.672, '½ mi'],
    [1609.344, '1 mi'],
    [3218.688, '2 mi'],
    [8046.72, '5 mi'],
    [16093.44, '10 mi'],
  ],
};

/** A stretch the map colours, with the custom segment's name when it is one. */
export interface MapSegment extends SegmentRange {
  name?: string;
}

export interface PlacedSegment {
  segment: CustomSegment;
  /** Null when the segment isn't on the current compared section. */
  range: SegmentRange | null;
}

export interface Settings {
  units: Units;
  speedMode: 'auto' | SpeedMode;
  timeMode: TimeMode;
  /** Metres; 0 = automatic (1 km / 1 mi, coarser for long sections). */
  splitLength: number;
  theme: Theme;
  baseMap: BaseMap;
  mapColorMode: MapColorMode;
  /** How the gain/loss and fastest map colouring cuts the route into stretches. */
  segmentMode: SegmentMode;
  /** Stretches in 'even' mode. */
  segmentCount: number;
  /** Metres per stretch in 'distance' mode; 0 = 1 km / 1 mi. */
  segmentLength: number;
  replaySpeed: number;
  follow: boolean;
  /** What the panel under the map shows. */
  stat: StatView;
  /** Draw the elevation profile behind the other charts. */
  eleOverlay: boolean;
  /** Height of the chart card under the map, in px; dragged with the divider. */
  chartHeight: number;
}

interface Session {
  refId: string | null;
  section: SectionOverride | null;
  passes: Record<string, number>;
  /** Track compared against the reference in "gain/loss" map mode. */
  focusId: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  speedMode: 'auto',
  timeMode: 'elapsed',
  splitLength: 0,
  theme: 'system',
  baseMap: 'auto',
  mapColorMode: 'tracks',
  segmentMode: 'even',
  segmentCount: MAX_EVEN_SEGMENTS,
  segmentLength: 0,
  replaySpeed: 0,
  follow: false,
  stat: 'ahead',
  eleOverlay: false,
  chartHeight: DEFAULT_CHART_HEIGHT,
};

export interface Notice {
  id: number;
  kind: 'error' | 'info';
  text: string;
}

let noticeSeq = 0;

class AppState {
  activities = $state<Activity[]>([]);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  session = $state<Session>({ refId: null, section: null, passes: {}, focusId: null });
  /** Custom segments; kept apart from the session so they outlive the activities. */
  segments = $state<CustomSegment[]>([]);
  /** Custom segment being edited: highlighted on the map, with draggable ends. */
  selectedSegment = $state<string | null>(null);
  notices = $state<Notice[]>([]);
  persistFailed = $state(false);
  loading = $state(false);

  /** Replay clock: normalised seconds since everyone crossed the start line. */
  clock = $state(0);
  playing = $state(false);
  /** Chart hover position, metres into the section. */
  hoverX = $state<number | null>(null);

  systemDark = $state(typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

  dark = $derived(this.settings.theme === 'dark' || (this.settings.theme === 'system' && this.systemDark));

  included = $derived(this.activities.filter((a) => a.included));

  refId = $derived.by(() => {
    const inc = this.included;
    if (this.session.refId && inc.some((a) => a.id === this.session.refId)) return this.session.refId;
    return inc[0]?.id ?? null;
  });

  comparison: Comparison | null = $derived.by(() => {
    const refId = this.refId;
    if (!refId) return null;
    try {
      return compare($state.snapshot(this.included) as Activity[], refId, {
        timeMode: this.settings.timeMode,
        section: $state.snapshot(this.session.section),
        passes: $state.snapshot(this.session.passes),
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  refActivity = $derived(this.activities.find((a) => a.id === this.refId) ?? null);

  speedMode: SpeedMode = $derived(
    this.settings.speedMode === 'auto' ? defaultSpeedMode(this.refActivity?.sport ?? '') : this.settings.speedMode,
  );

  focusIndex = $derived.by(() => {
    const cmp = this.comparison;
    if (!cmp || cmp.tracks.length < 2) return -1;
    const k = cmp.tracks.findIndex((t) => t.activity.id === this.session.focusId);
    return k > 0 ? k : 1;
  });

  splitLength = $derived.by(() => {
    if (this.settings.splitLength > 0) return this.settings.splitLength;
    const unit = this.settings.units === 'imperial' ? 1609.344 : 1000;
    const len = this.comparison?.length ?? 0;
    // Keep the table to a readable number of rows for long rides.
    for (const mult of [1, 5, 10, 20, 50]) if (len / (unit * mult) <= 30) return unit * mult;
    return unit * 100;
  });

  /** Distance-mode stretch length, falling back to 1 km / 1 mi when the stored one isn't offered in these units. */
  segmentLength = $derived.by(() => {
    const opts = SEGMENT_LENGTHS[this.settings.units];
    return opts.find(([m]) => m === this.settings.segmentLength)?.[0] ?? opts[3][0];
  });

  placedSegments: PlacedSegment[] = $derived.by(() => {
    const cmp = this.comparison;
    return this.segments.map((segment) => ({ segment, range: cmp ? placeSegment(cmp, segment) : null }));
  });

  /** Stretches the gain/loss and fastest map modes colour. */
  mapSegments: MapSegment[] = $derived.by(() => {
    const cmp = this.comparison;
    if (!cmp) return [];
    switch (this.settings.segmentMode) {
      case 'distance':
        return distanceRanges(cmp.length, this.segmentLength);
      case 'custom':
        return this.placedSegments.flatMap((p) => (p.range ? [{ ...p.range, name: p.segment.name }] : []));
      default:
        return evenRanges(cmp.length, this.settings.segmentCount);
    }
  });

  init() {
    const s = loadSettings<Settings>();
    if (s) {
      this.settings = { ...DEFAULT_SETTINGS, ...s };
      if (!STAT_VIEWS.includes(this.settings.stat)) this.settings.stat = DEFAULT_SETTINGS.stat;
      if (!['even', 'distance', 'custom'].includes(this.settings.segmentMode)) this.settings.segmentMode = 'even';
      this.settings.segmentCount = clampCount(this.settings.segmentCount);
    }
    const sess = loadSession<Session>();
    if (sess) this.session = { ...this.session, ...sess, passes: sess.passes ?? {} };
    this.activities = loadActivities();
    const segs = loadSegments<CustomSegment>();
    if (Array.isArray(segs)) this.segments = segs.filter((g) => g?.id && g.start && g.end && Array.isArray(g.near));

    if (typeof matchMedia !== 'undefined') {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', (e) => (this.systemDark = e.matches));
    }

    $effect.root(() => {
      $effect(() => {
        saveSettings($state.snapshot(this.settings));
      });
      $effect(() => {
        saveSession($state.snapshot(this.session));
      });
      $effect(() => {
        saveSegments($state.snapshot(this.segments));
      });
      $effect(() => {
        this.persistFailed = !saveActivities($state.snapshot(this.activities) as Activity[]);
      });
      $effect(() => {
        const root = document.documentElement;
        if (this.settings.theme === 'system') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', this.settings.theme);
      });
      // A new comparison invalidates the replay position.
      $effect(() => {
        void this.comparison;
        this.playing = false;
        this.clock = 0;
      });
    });
  }

  notify(kind: Notice['kind'], text: string) {
    const id = ++noticeSeq;
    this.notices.push({ id, kind, text });
    setTimeout(() => this.dismiss(id), kind === 'error' ? 9000 : 5000);
  }

  dismiss(id: number) {
    this.notices = this.notices.filter((n) => n.id !== id);
  }

  async addFiles(files: File[]) {
    this.loading = true;
    try {
      for (const file of files) {
        if (this.activities.length >= MAX_TRACKS) {
          this.notify('error', `Up to ${MAX_TRACKS} activities can be compared at once; skipped ${file.name}.`);
          continue;
        }
        try {
          const parsed = await parseFile(file);
          const used = new Set(this.activities.map((a) => a.slot));
          let slot = 0;
          while (used.has(slot)) slot++;
          const base = file.name.replace(/\.[^.]+$/, '');
          this.activities.push({
            ...parsed,
            name: parsed.name || base,
            id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            fileName: file.name,
            slot,
            included: true,
          });
        } catch (e) {
          this.notify('error', `${file.name}: ${e instanceof Error ? e.message : 'could not be read'}`);
        }
      }
    } finally {
      this.loading = false;
    }
  }

  async loadSamples() {
    const names = ['seafront-march.gpx', 'seafront-october.gpx', 'seafront-friend.gpx'];
    const files: File[] = [];
    for (const n of names) {
      const res = await fetch(`./samples/${n}`);
      if (!res.ok) continue;
      files.push(new File([await res.blob()], n));
    }
    await this.addFiles(files);
  }

  remove(id: string) {
    this.activities = this.activities.filter((a) => a.id !== id);
    delete this.session.passes[id];
    if (this.session.refId === id) {
      this.session.refId = null;
      this.session.section = null;
    }
  }

  clearAll() {
    this.activities = [];
    this.session = { refId: null, section: null, passes: {}, focusId: null };
  }

  setReference(id: string) {
    if (this.refId === id) return;
    this.session.refId = id;
    this.session.passes = {};
  }

  setSection(section: SectionOverride | null) {
    this.session.section = section;
  }

  /** Adds a segment over `from`–`to` metres of the current section and selects it. */
  addSegment(from: number, to: number) {
    const cmp = this.comparison;
    if (!cmp) return;
    const used = new Set(this.segments.map((g) => g.name));
    let n = this.segments.length + 1;
    while (used.has(`Segment ${n}`)) n++;
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.segments.push({ id, name: `Segment ${n}`, ...segmentGeometry(cmp, from, to) });
    this.selectedSegment = id;
  }

  /** Moves a segment to cover `from`–`to` metres of the current section. */
  moveSegment(id: string, from: number, to: number) {
    const cmp = this.comparison;
    const seg = this.segments.find((g) => g.id === id);
    if (!cmp || !seg) return;
    Object.assign(seg, segmentGeometry(cmp, from, to));
  }

  renameSegment(id: string, name: string) {
    const seg = this.segments.find((g) => g.id === id);
    if (seg) seg.name = name;
  }

  removeSegment(id: string) {
    this.segments = this.segments.filter((g) => g.id !== id);
    if (this.selectedSegment === id) this.selectedSegment = null;
  }
}

export function clampCount(n: number): number {
  return Number.isFinite(n) ? Math.min(MAX_EVEN_SEGMENTS, Math.max(1, Math.round(n))) : MAX_EVEN_SEGMENTS;
}

export const app = new AppState();
