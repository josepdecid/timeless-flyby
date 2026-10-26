import type { ParsedActivity, TrackPoint } from '../types';
import { haversine } from '../geo';
import { parseGpx } from './gpx';
import { parseTcx } from './tcx';
import { parseFit } from './fit';

export const ACCEPTED_EXTENSIONS = ['.gpx', '.tcx', '.fit'];

/** Anything faster than this between two samples is a GPS glitch, whatever the sport. */
const MAX_PLAUSIBLE_SPEED = 120; // m/s

export async function parseFile(file: File): Promise<ParsedActivity> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  let parsed: ParsedActivity;
  if (ext === '.fit') {
    parsed = await parseFit(await file.arrayBuffer());
  } else {
    const text = await file.text();
    if (ext === '.tcx' || /<TrainingCenterDatabase/i.test(text.slice(0, 2000))) parsed = parseTcx(text);
    else parsed = parseGpx(text);
  }
  parsed.points = cleanPoints(parsed.points);
  if (parsed.points.length < 2) {
    throw new Error('No timestamped GPS points found. Comparing needs both position and time data.');
  }
  return parsed;
}

/** Sort by time, drop duplicate timestamps and teleporting GPS spikes. */
export function cleanPoints(points: TrackPoint[]): TrackPoint[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const out: TrackPoint[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (prev) {
      const dt = (p.t - prev.t) / 1000;
      if (dt <= 0) continue;
      if (haversine(prev, p) / dt > MAX_PLAUSIBLE_SPEED) continue;
    }
    out.push(p);
  }
  return out;
}
