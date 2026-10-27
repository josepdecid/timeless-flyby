import { describe, expect, it } from 'vitest';
import { compare, distanceRanges, evenRanges, placeSegment, segmentGeometry, segmentStats } from '../analysis';
import { outAndBack, synthTrack } from '../synth';
import type { Activity, CustomSegment, LatLon, TrackPoint } from '../types';

const COAST: LatLon[] = [
  { lat: 41.37, lon: 2.189 },
  { lat: 41.3765, lon: 2.1925 },
  { lat: 41.3832, lon: 2.1985 },
  { lat: 41.3915, lon: 2.2085 },
  { lat: 41.4085, lon: 2.2235 },
];

function act(id: string, points: TrackPoint[]): Activity {
  return { id, name: id, fileName: `${id}.gpx`, sport: 'running', slot: 0, included: true, points };
}

const start = new Date('2026-03-01T08:00:00Z');

describe('segment ranges', () => {
  it('cuts the section into even stretches', () => {
    const r = evenRanges(1000, 4);
    expect(r).toEqual([
      { from: 0, to: 250 },
      { from: 250, to: 500 },
      { from: 500, to: 750 },
      { from: 750, to: 1000 },
    ]);
  });

  it('cuts by distance, with a shorter last stretch', () => {
    const r = distanceRanges(2500, 1000);
    expect(r.map((s) => s.to)).toEqual([1000, 2000, 2500]);
    expect(r[0].from).toBe(0);
    expect(distanceRanges(2000.5, 1000).length).toBe(2);
  });
});

describe('custom segments', () => {
  it('times every track on a stretch and finds the fastest', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 1 }));
    const b = act('b', synthTrack({ route: COAST, speed: (d) => (d > 1000 && d < 2000 ? 4 : 3), start, seed: 2 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const [inside, outside] = segmentStats(cmp, [
      { from: 1200, to: 1800 },
      { from: 2500, to: 3500 },
    ]);
    expect(Math.abs(inside.times[0]! - 600 / 3)).toBeLessThan(5);
    expect(Math.abs(inside.times[1]! - 600 / 4)).toBeLessThan(5);
    expect(inside.fastest).toBe(1);
    expect(Math.abs(outside.times[0]! - outside.times[1]!)).toBeLessThan(5);
  });

  it('places a saved segment back where it was drawn', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 3 }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3, start, seed: 4 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const seg: CustomSegment = { id: 's', name: 'S', ...segmentGeometry(cmp, 1000, 2500) };
    const r = placeSegment(cmp, seg)!;
    expect(Math.abs(r.from - 1000)).toBeLessThan(2);
    expect(Math.abs(r.to - 2500)).toBeLessThan(2);
    // Same segment against the other track as reference.
    const swapped = compare([a, b], 'b', { timeMode: 'elapsed' })!;
    const r2 = placeSegment(swapped, seg)!;
    expect(Math.abs(r2.to - r2.from - 1500)).toBeLessThan(20);
  });

  it('keeps a segment on the return leg of an out-and-back', () => {
    const route = outAndBack(COAST);
    const a = act('a', synthTrack({ route, speed: () => 3, start, seed: 5 }));
    const b = act('b', synthTrack({ route, speed: () => 3, start, seed: 6 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const from = cmp.length - 2000;
    const seg: CustomSegment = { id: 's', name: 'S', ...segmentGeometry(cmp, from, cmp.length - 500) };
    const r = placeSegment(cmp, seg)!;
    expect(Math.abs(r.from - from)).toBeLessThan(2);
  });

  it('rejects a segment off the route', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 7 }));
    const cmp = compare([a], 'a', { timeMode: 'elapsed' })!;
    const far = { lat: 41.5, lon: 2.0 };
    const seg: CustomSegment = { id: 's', name: 'S', start: far, end: far, near: [0, 0] };
    expect(placeSegment(cmp, seg)).toBeNull();
  });
});
