import type { LatLon } from './types';

const R = 6371008.8; // mean Earth radius, metres
const RAD = Math.PI / 180;

export function haversine(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function cumulativeDistance(points: LatLon[]): Float64Array {
  const out = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) out[i] = out[i - 1] + haversine(points[i - 1], points[i]);
  return out;
}

/**
 * Local equirectangular projection to metres around an origin. Plenty accurate for
 * point-to-segment matching over the extent of a single activity.
 */
export class LocalProjection {
  private readonly kx: number;
  private readonly ky = R * RAD;
  constructor(private readonly origin: LatLon) {
    this.kx = R * RAD * Math.cos(origin.lat * RAD);
  }
  /** Interleaved [x0, y0, x1, y1, ...] */
  project(points: LatLon[]): Float64Array {
    const out = new Float64Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      out[2 * i] = (points[i].lon - this.origin.lon) * this.kx;
      out[2 * i + 1] = (points[i].lat - this.origin.lat) * this.ky;
    }
    return out;
  }
}

/** Index of the first element strictly greater than `x` (arr sorted ascending). */
export function upperBound(arr: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Piecewise-linear interpolation of ys at x over ascending xs. Repeated xs are allowed:
 * the segment *after* a plateau is used for x past it, the one before for x before it.
 * Clamps outside the range.
 */
export function interp(xs: ArrayLike<number>, ys: ArrayLike<number>, x: number): number {
  const n = xs.length;
  if (n === 0) return NaN;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const i = upperBound(xs, x);
  const x0 = xs[i - 1];
  const x1 = xs[i];
  if (x1 === x0) return ys[i];
  const f = (x - x0) / (x1 - x0);
  return ys[i - 1] + f * (ys[i] - ys[i - 1]);
}

/** Like interp, but returns the lower bracketing index and fraction (for multi-column lookups). */
export function locate(xs: ArrayLike<number>, x: number): { i: number; f: number } {
  const n = xs.length;
  if (n < 2 || x <= xs[0]) return { i: 0, f: 0 };
  if (x >= xs[n - 1]) return { i: n - 2, f: 1 };
  const i = upperBound(xs, x) - 1;
  const span = xs[i + 1] - xs[i];
  return { i, f: span > 0 ? (x - xs[i]) / span : 0 };
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}
