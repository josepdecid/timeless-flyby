import { haversine } from './geo';
import type { TrackPoint } from './types';

/** Below this speed a sample counts as stopped. */
export const MOVING_SPEED = 0.5; // m/s
/** Speed is measured over ±this many ms, so GPS drift while standing still doesn't count. */
const WINDOW = 5_000;

/** moving[i] says whether the athlete was moving between samples i-1 and i (moving[0] = 0). */
export function movingMask(points: TrackPoint[]): Uint8Array {
  const n = points.length;
  const out = new Uint8Array(n);
  let a = 0;
  let b = 0;
  for (let i = 1; i < n; i++) {
    const mid = (points[i].t + points[i - 1].t) / 2;
    while (points[a].t < mid - WINDOW) a++;
    while (b < n - 1 && points[b].t < mid + WINDOW) b++;
    const lo = Math.min(a, i - 1);
    const hi = Math.max(b, i);
    const v = (haversine(points[lo], points[hi]) * 1000) / (points[hi].t - points[lo].t);
    out[i] = v >= MOVING_SPEED ? 1 : 0;
  }
  return out;
}
