import { t } from './i18n.svelte';

// Categorical slots from the validated reference palette (fixed order, never cycled).
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const MAX_TRACKS = SERIES_LIGHT.length;

export function seriesColor(slot: number, dark: boolean): string {
  return (dark ? SERIES_DARK : SERIES_LIGHT)[slot % MAX_TRACKS];
}

/**
 * Diverging blue (faster) ↔ red (slower) with a neutral grey midpoint. Arms run from small to
 * large difference; on dark maps the strong end is lighter so it still stands out.
 */
const DIVERGING = {
  light: {
    neutral: '#a3a29c',
    faster: ['#86b6ef', '#5598e7', '#2a78d6', '#184f95'],
    slower: ['#f2a19f', '#ea7472', '#e34948', '#b02f2f'],
  },
  dark: {
    neutral: '#6b6a66',
    faster: ['#1c5cab', '#3987e5', '#6da7ec', '#9ec5f4'],
    slower: ['#9a2c2c', '#d03b3b', '#e66767', '#f29a99'],
  },
};

/** Bin edges for |relative difference|; below the first edge counts as "even". */
export const DIVERGING_BINS = [0.01, 0.03, 0.06, 0.1];

/** rel > 0 means slower than the reference. */
export function divergingColor(rel: number, dark: boolean): string {
  const p = dark ? DIVERGING.dark : DIVERGING.light;
  if (!Number.isFinite(rel)) return p.neutral;
  const mag = Math.abs(rel);
  let bin = -1;
  for (let i = 0; i < DIVERGING_BINS.length; i++) if (mag >= DIVERGING_BINS[i]) bin = i;
  if (bin < 0) return p.neutral;
  return (rel > 0 ? p.slower : p.faster)[bin];
}

export function divergingLegend(dark: boolean): { color: string; label: string }[] {
  const p = dark ? DIVERGING.dark : DIVERGING.light;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return [
    ...p.faster.map((c, i) => ({ color: c, label: `−${pct(DIVERGING_BINS[i])}` })).reverse(),
    { color: p.neutral, label: t.map.evenBin },
    ...p.slower.map((c, i) => ({ color: c, label: `+${pct(DIVERGING_BINS[i])}` })),
  ];
}
