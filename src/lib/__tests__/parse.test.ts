// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseGpx } from '../parse/gpx';
import { parseTcx } from '../parse/tcx';
import { cleanPoints } from '../parse';
import { synthTrack, toGpx } from '../synth';

describe('parsers', () => {
  it('round-trips GPX with Garmin extensions', () => {
    const pts = synthTrack({
      route: [
        { lat: 41.37, lon: 2.189 },
        { lat: 41.38, lon: 2.195 },
      ],
      speed: () => 3,
      start: new Date('2026-01-01T10:00:00Z'),
      hr: () => 150,
      cad: 170,
      ele: () => 12.3,
    });
    const parsed = parseGpx(toGpx('Morning run', 'running', pts));
    expect(parsed.name).toBe('Morning run');
    expect(parsed.sport).toBe('running');
    expect(parsed.points.length).toBe(pts.length);
    expect(parsed.points[5].lat).toBeCloseTo(pts[5].lat, 6);
    expect(parsed.points[5].t).toBe(pts[5].t);
    expect(parsed.points[5].ele).toBe(12.3);
    expect(parsed.points[5].hr).toBeGreaterThan(140);
    expect(parsed.points[5].cad).toBeGreaterThan(160);
  });

  it('parses TCX', () => {
    const tcx = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
<Activities><Activity Sport="Biking"><Id>2026-01-01T10:00:00Z</Id><Lap><Track>
<Trackpoint><Time>2026-01-01T10:00:00Z</Time><Position><LatitudeDegrees>41.1</LatitudeDegrees><LongitudeDegrees>2.1</LongitudeDegrees></Position><AltitudeMeters>10</AltitudeMeters><HeartRateBpm><Value>120</Value></HeartRateBpm><Cadence>85</Cadence><Extensions><ns3:TPX><ns3:Watts>210</ns3:Watts></ns3:TPX></Extensions></Trackpoint>
<Trackpoint><Time>2026-01-01T10:00:01Z</Time></Trackpoint>
<Trackpoint><Time>2026-01-01T10:00:02Z</Time><Position><LatitudeDegrees>41.1001</LatitudeDegrees><LongitudeDegrees>2.1</LongitudeDegrees></Position></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const p = parseTcx(tcx);
    expect(p.sport).toBe('Biking');
    expect(p.points).toHaveLength(2);
    expect(p.points[0]).toMatchObject({ lat: 41.1, lon: 2.1, ele: 10, hr: 120, cad: 85, pwr: 210 });
  });

  it('drops duplicate timestamps and GPS spikes', () => {
    const t = Date.parse('2026-01-01T10:00:00Z');
    const pts = cleanPoints([
      { t: t + 2000, lat: 41.00002, lon: 2 },
      { t, lat: 41, lon: 2 },
      { t, lat: 41, lon: 2 },
      { t: t + 1000, lat: 42, lon: 2 }, // 111 km in a second
      { t: t + 3000, lat: 41.00004, lon: 2 },
    ]);
    expect(pts.map((p) => p.t - t)).toEqual([0, 2000, 3000]);
  });
});
