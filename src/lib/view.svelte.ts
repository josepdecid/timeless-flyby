// Derived, display-ready values shared by several components.
import { replayState, elapsedAt, type ReplayState, type TrackSeries } from './analysis';
import { seriesColor } from './colors';
import { distanceUnit, distanceValue, fmtDistance, speedFormat } from './format';
import { app } from './state.svelte';

class View {
  colors = $derived.by(() => {
    const dark = app.dark;
    const map = new Map<string, string>();
    for (const a of app.activities) map.set(a.id, seriesColor(a.slot, dark));
    return map;
  });

  names = $derived.by(() => {
    const map = new Map<string, string>();
    for (const a of app.activities) map.set(a.id, a.name);
    return map;
  });

  /** Grid distances in display units, for chart x axes. */
  x = $derived(app.comparison ? app.comparison.grid.map((m) => distanceValue(m, app.settings.units)) : []);

  speed = $derived(speedFormat(app.speedMode, app.settings.units, app.refActivity?.sport ?? ''));

  xFormat = $derived.by(() => {
    const unit = distanceUnit(app.settings.units);
    return (v: number) => `${+v.toFixed(2)} ${unit}`;
  });

  /** Replay state of every track at the current clock. */
  replay: ReplayState[] = $derived.by(() => {
    const cmp = app.comparison;
    if (!cmp) return [];
    const e = app.clock;
    return cmp.tracks.map((tr) => replayState(cmp, tr, e));
  });

  replayActive = $derived(app.playing || app.clock > 0);

  /** Standings at the current clock: finished first (by time), then by distance covered. */
  standings = $derived.by(() => {
    const cmp = app.comparison;
    if (!cmp) return [];
    const rows = cmp.tracks.map((tr, k) => ({ tr, k, st: this.replay[k] }));
    rows.sort((a, b) => {
      const fa = a.st.finished && a.tr.aligned.finished;
      const fb = b.st.finished && b.tr.aligned.finished;
      if (fa && fb) return a.tr.duration - b.tr.duration;
      if (fa !== fb) return fa ? -1 : 1;
      return b.st.x - a.st.x;
    });
    const leader = rows[0];
    return rows.map((r, rank) => {
      let gap = '';
      if (rank > 0 && leader) {
        if (r.st.finished && leader.st.finished) {
          gap = `+${fmtSeconds(r.tr.duration - leader.tr.duration)}`;
        } else {
          const leaderAt = elapsedAt(cmp, leader.tr, r.st.x);
          gap =
            leaderAt != null
              ? `+${fmtSeconds(Math.max(0, Math.min(app.clock, r.tr.duration) - leaderAt))}`
              : `−${fmtDistance(leader.st.x - r.st.x, app.settings.units)}`;
        }
      }
      return { ...r, rank: rank + 1, gap, speed: speedAt(r.tr, r.st.x, cmp.grid) };
    });
  });
}

function fmtSeconds(s: number): string {
  const v = Math.round(s);
  const m = Math.floor(v / 60);
  return `${m}:${String(v % 60).padStart(2, '0')}`;
}

function speedAt(tr: TrackSeries, x: number, grid: number[]): number | null {
  const s = tr.metrics.speed;
  if (!s || !grid.length) return null;
  const step = grid[1] ?? 1;
  const j = Math.min(grid.length - 1, Math.max(0, Math.round(x / step)));
  return s[j];
}

export const view = new View();
