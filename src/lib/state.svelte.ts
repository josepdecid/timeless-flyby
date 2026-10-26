import { compare, type Comparison, type SectionOverride, type TimeMode } from './analysis';
import { MAX_TRACKS } from './colors';
import { defaultSpeedMode, type SpeedMode, type Units } from './format';
import { parseFile } from './parse';
import {
  loadActivities,
  loadSession,
  loadSettings,
  saveActivities,
  saveSession,
  saveSettings,
} from './storage';
import type { Activity } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type MapColorMode = 'tracks' | 'gain' | 'fastest';
export type BaseMap = 'auto' | 'osm' | 'topo' | 'satellite';
export const STAT_VIEWS = ['ahead', 'speed', 'pace', 'ele', 'hr', 'cad', 'pwr', 'splits'] as const;
export type StatView = (typeof STAT_VIEWS)[number];

export const DEFAULT_CHART_HEIGHT = 280;

export interface Settings {
  units: Units;
  speedMode: 'auto' | SpeedMode;
  timeMode: TimeMode;
  /** Metres; 0 = automatic (1 km / 1 mi, coarser for long sections). */
  splitLength: number;
  theme: Theme;
  baseMap: BaseMap;
  mapColorMode: MapColorMode;
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

  init() {
    const s = loadSettings<Settings>();
    if (s) {
      this.settings = { ...DEFAULT_SETTINGS, ...s };
      if (!STAT_VIEWS.includes(this.settings.stat)) this.settings.stat = DEFAULT_SETTINGS.stat;
    }
    const sess = loadSession<Session>();
    if (sess) this.session = { ...this.session, ...sess, passes: sess.passes ?? {} };
    this.activities = loadActivities();

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
}

export const app = new AppState();
