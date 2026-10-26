import type { ParsedActivity, TrackPoint } from '../types';
import { byName, childText, first, num, parseXml } from './xml';

export function parseGpx(text: string): ParsedActivity {
  const doc = parseXml(text);
  const trk = byName(doc, 'trk')[0];
  const metadata = byName(doc, 'metadata')[0];
  const name = (trk && childText(trk, 'name')) || (metadata && childText(metadata, 'name')) || '';
  const sport = (trk && childText(trk, 'type')) || '';

  const points: TrackPoint[] = [];
  for (const el of byName(doc, 'trkpt')) {
    const lat = num(el.getAttribute('lat'));
    const lon = num(el.getAttribute('lon'));
    const time = childText(el, 'time');
    if (lat === undefined || lon === undefined || !time) continue;
    const t = Date.parse(time);
    if (!Number.isFinite(t)) continue;

    const p: TrackPoint = { t, lat, lon };
    const ele = num(childText(el, 'ele'));
    if (ele !== undefined) p.ele = ele;

    const ext = first(el, 'extensions');
    if (ext) {
      // Garmin TrackPointExtension (hr, cad), plus the common bare <power> tag.
      const hr = num(first(ext, 'hr')?.textContent);
      const cad = num(first(ext, 'cad')?.textContent);
      const pwr = num((first(ext, 'power') ?? first(ext, 'PowerInWatts'))?.textContent);
      if (hr !== undefined) p.hr = hr;
      if (cad !== undefined) p.cad = cad;
      if (pwr !== undefined) p.pwr = pwr;
    }
    points.push(p);
  }
  return { name, sport, points };
}
