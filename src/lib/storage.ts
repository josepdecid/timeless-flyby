import type { Activity, TrackPoint } from './types';

// Everything lives in this browser's localStorage only; nothing leaves the machine.
const KEYS = {
  settings: 'tf:settings:v1',
  session: 'tf:session:v1',
  activities: 'tf:activities:v1',
  segments: 'tf:segments:v1',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused (quota, private mode, storage disabled). */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return false;
  }
}

export const loadSettings = <T>() => read<Partial<T>>(KEYS.settings);
export const saveSettings = (s: unknown) => write(KEYS.settings, s);
export const loadSession = <T>() => read<Partial<T>>(KEYS.session);
export const saveSession = (s: unknown) => write(KEYS.session, s);
export const loadSegments = <T>() => read<T[]>(KEYS.segments);
export const saveSegments = (s: unknown) => write(KEYS.segments, s);

/**
 * Compact column encoding: integers, delta-coded where values change slowly. Roughly 15–20
 * bytes per point instead of ~100 for naive JSON, so a few long activities fit the ~5 MB quota.
 */
interface Packed {
  id: string;
  name: string;
  fileName: string;
  sport: string;
  slot: number;
  included: boolean;
  t0: number;
  t: number[]; // deciseconds, delta
  lat: number[]; // 1e-6 deg, delta
  lon: number[];
  ele?: (number | null)[]; // decimetres, delta over present values
  hr?: (number | null)[];
  cad?: (number | null)[];
  pwr?: (number | null)[];
}

function deltas(values: number[]): number[] {
  let prev = 0;
  return values.map((v) => {
    const d = v - prev;
    prev = v;
    return d;
  });
}

function undelta(ds: number[]): number[] {
  let acc = 0;
  return ds.map((d) => (acc += d));
}

export function pack(a: Activity): Packed {
  const t0 = a.points[0].t;
  const p: Packed = {
    id: a.id,
    name: a.name,
    fileName: a.fileName,
    sport: a.sport,
    slot: a.slot,
    included: a.included,
    t0,
    t: deltas(a.points.map((pt) => Math.round((pt.t - t0) / 100))),
    lat: deltas(a.points.map((pt) => Math.round(pt.lat * 1e6))),
    lon: deltas(a.points.map((pt) => Math.round(pt.lon * 1e6))),
  };
  if (a.points.some((pt) => pt.ele != null)) {
    let prev = 0;
    p.ele = a.points.map((pt) => {
      if (pt.ele == null) return null;
      const v = Math.round(pt.ele * 10);
      const d = v - prev;
      prev = v;
      return d;
    });
  }
  for (const k of ['hr', 'cad', 'pwr'] as const) {
    if (a.points.some((pt) => pt[k] != null)) p[k] = a.points.map((pt) => (pt[k] == null ? null : Math.round(pt[k]!)));
  }
  return p;
}

export function unpack(p: Packed): Activity {
  const t = undelta(p.t);
  const lat = undelta(p.lat);
  const lon = undelta(p.lon);
  let eleAcc = 0;
  const points: TrackPoint[] = t.map((dt, i) => {
    const pt: TrackPoint = { t: p.t0 + dt * 100, lat: lat[i] / 1e6, lon: lon[i] / 1e6 };
    const de = p.ele?.[i];
    if (de != null) {
      eleAcc += de;
      pt.ele = eleAcc / 10;
    }
    for (const k of ['hr', 'cad', 'pwr'] as const) {
      const v = p[k]?.[i];
      if (v != null) pt[k] = v;
    }
    return pt;
  });
  return {
    id: p.id,
    name: p.name,
    fileName: p.fileName,
    sport: p.sport,
    slot: p.slot,
    included: p.included,
    points,
  };
}

export function loadActivities(): Activity[] {
  const packed = read<Packed[]>(KEYS.activities);
  if (!Array.isArray(packed)) return [];
  const out: Activity[] = [];
  for (const p of packed) {
    try {
      out.push(unpack(p));
    } catch {
      /* skip corrupt entry */
    }
  }
  return out;
}

export function saveActivities(list: Activity[]): boolean {
  return write(KEYS.activities, list.map(pack));
}
