import type { ParsedActivity, TrackPoint } from '../types';
import { byName, childText, first, num, parseXml } from './xml';

export function parseTcx(text: string): ParsedActivity {
  const doc = parseXml(text);
  const activity = byName(doc, 'Activity')[0];
  const sport = activity?.getAttribute('Sport') ?? '';
  const name = (activity && childText(activity, 'Notes')) || '';

  const points: TrackPoint[] = [];
  for (const el of byName(doc, 'Trackpoint')) {
    const time = childText(el, 'Time');
    const pos = first(el, 'Position');
    if (!time || !pos) continue; // indoor / paused samples carry no position
    const lat = num(childText(pos, 'LatitudeDegrees'));
    const lon = num(childText(pos, 'LongitudeDegrees'));
    const t = Date.parse(time);
    if (lat === undefined || lon === undefined || !Number.isFinite(t)) continue;

    const p: TrackPoint = { t, lat, lon };
    const ele = num(childText(el, 'AltitudeMeters'));
    if (ele !== undefined) p.ele = ele;
    const hrEl = first(el, 'HeartRateBpm');
    const hr = hrEl ? num(childText(hrEl, 'Value')) : undefined;
    if (hr !== undefined) p.hr = hr;
    const cad = num(childText(el, 'Cadence')) ?? num(first(el, 'RunCadence')?.textContent);
    if (cad !== undefined) p.cad = cad;
    const pwr = num(first(el, 'Watts')?.textContent);
    if (pwr !== undefined) p.pwr = pwr;
    points.push(p);
  }
  return { name, sport, points };
}
