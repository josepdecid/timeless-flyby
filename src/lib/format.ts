import { i18n, t } from './i18n.svelte';

export type Units = 'metric' | 'imperial';
export type SpeedMode = 'pace' | 'speed';

const MI = 1609.344;
const FT = 0.3048;
const YD = 0.9144;

const PACE_SPORTS = /run|walk|hik|trail|trek|swim|row|ski_?mountain|snowshoe/i;
const SWIM = /swim/i;

export function defaultSpeedMode(sport: string): SpeedMode {
  return PACE_SPORTS.test(sport) ? 'pace' : 'speed';
}

export function sportLabel(sport: string): string {
  if (!sport) return t.common.activity;
  const s = sport.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return t.sports[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDistance(m: number, units: Units, digits?: number): string {
  if (units === 'imperial') {
    const mi = m / MI;
    return `${mi.toFixed(digits ?? (mi < 10 ? 2 : 1))} mi`;
  }
  if (m < 1000 && digits === undefined) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(digits ?? (m < 10_000 ? 2 : 1))} km`;
}

/** Distance in the display unit (km or mi), for chart axes. */
export function distanceValue(m: number, units: Units): number {
  return units === 'imperial' ? m / MI : m / 1000;
}

export function distanceUnit(units: Units): string {
  return units === 'imperial' ? 'mi' : 'km';
}

export function fmtShortDistance(m: number, units: Units): string {
  return units === 'imperial' ? `${Math.round(m / FT)} ft` : `${Math.round(m)} m`;
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  const neg = seconds < 0;
  const s = Math.round(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const body = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  return neg ? `−${body}` : body;
}

/** Signed time difference: "+0:12", "−1:05", "0:00". */
export function fmtGap(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  if (Math.round(Math.abs(seconds)) === 0) return '0:00';
  return (seconds > 0 ? '+' : '−') + fmtDuration(Math.abs(seconds));
}

export interface SpeedFormat {
  mode: SpeedMode;
  unit: string;
  /** m/s → displayed value (pace values are seconds per unit distance). */
  value: (mps: number) => number;
  /** displayed value → label */
  label: (v: number) => string;
}

export function speedFormat(mode: SpeedMode, units: Units, sport: string): SpeedFormat {
  if (mode === 'speed') {
    const k = units === 'imperial' ? 3600 / MI : 3.6;
    return {
      mode,
      unit: units === 'imperial' ? 'mph' : 'km/h',
      value: (v) => v * k,
      label: (v) => v.toFixed(1),
    };
  }
  const per = SWIM.test(sport) ? (units === 'imperial' ? 100 * YD : 100) : units === 'imperial' ? MI : 1000;
  const unit = SWIM.test(sport) ? (units === 'imperial' ? '/100yd' : '/100m') : units === 'imperial' ? '/mi' : '/km';
  return {
    mode,
    unit,
    value: (v) => (v > 0.05 ? per / v : NaN),
    label: (v) => fmtDuration(v),
  };
}

export function fmtElevation(m: number, units: Units): string {
  return units === 'imperial' ? `${Math.round(m / FT)} ft` : `${Math.round(m)} m`;
}

export function elevationValue(m: number, units: Units): number {
  return units === 'imperial' ? m / FT : m;
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(t: number): string {
  return new Date(t).toLocaleString(i18n.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
