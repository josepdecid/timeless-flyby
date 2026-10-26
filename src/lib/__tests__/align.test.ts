import { describe, expect, it } from 'vitest';
import { compare, computeSplits } from '../analysis';
import { haversine } from '../geo';
import { outAndBack, synthTrack } from '../synth';
import type { Activity, LatLon, TrackPoint } from '../types';

// ~5.5 km of Barcelona seafront, roughly.
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

describe('compare', () => {
  it('measures a constant-speed difference along an identical course', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 1 }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3.3, start: new Date('2026-09-01T18:00:00Z'), seed: 2 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const L = cmp.length;
    expect(L).toBeGreaterThan(4500);
    const [ra, rb] = cmp.tracks;
    expect(ra.aligned.finished && rb.aligned.finished).toBe(true);
    expect(Math.abs(ra.duration - L / 3) / ra.duration).toBeLessThan(0.01);
    expect(Math.abs(rb.duration - L / 3.3) / rb.duration).toBeLessThan(0.01);
    // B gains time steadily: halfway it should be about half the final gap ahead.
    const mid = Math.floor(cmp.grid.length / 2);
    const finalGap = rb.ahead[rb.ahead.length - 1]!;
    expect(Math.abs(finalGap - (L / 3 - L / 3.3))).toBeLessThan(8);
    expect(rb.ahead[mid]!).toBeGreaterThan(finalGap * 0.4);
    expect(rb.ahead[mid]!).toBeLessThan(finalGap * 0.6);
    expect(rb.aligned.offRoute).toBeLessThan(0.02);
  });

  it('ignores a warm-up before the start and an idle recording start', () => {
    const warmup: LatLon[] = [
      { lat: 41.38, lon: 2.18 },
      { lat: 41.375, lon: 2.183 },
      { lat: 41.3705, lon: 2.1885 },
    ];
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 3, idleBefore: 60 }));
    const b = act('b', synthTrack({ route: COAST, prefix: warmup, speed: () => 3, start, seed: 4 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const gap = cmp.tracks[1].ahead[cmp.grid.length - 1]!;
    expect(Math.abs(gap)).toBeLessThan(8);
    expect(Math.abs(cmp.tracks[0].duration - cmp.length / 3)).toBeLessThan(20);
  });

  it('follows an out-and-back course without snapping to the return leg', () => {
    const route = outAndBack(COAST);
    const a = act('a', synthTrack({ route, speed: () => 3, start, seed: 5 }));
    // B is fast on the way out and slow on the way back.
    const b = act('b', synthTrack({ route, speed: (d, L) => (d < L / 2 ? 3.5 : 2.6), start, seed: 6 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    expect(cmp.length).toBeGreaterThan(10_000);
    const tb = cmp.tracks[1];
    expect(tb.aligned.finished).toBe(true);
    const turn = Math.floor(cmp.grid.length / 2);
    // Max lead is at the turnaround, then it shrinks.
    expect(tb.ahead[turn]!).toBeGreaterThan(200);
    expect(tb.ahead[cmp.grid.length - 1]!).toBeLessThan(tb.ahead[turn]!);
  });

  it('has no artefacts at an out-and-back turnaround', () => {
    const route = outAndBack(COAST);
    const a = act('a', synthTrack({ route, speed: () => 3, start, seed: 15 }));
    const b = act('b', synthTrack({ route, speed: () => 3.15, start, seed: 16 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const tb = cmp.tracks[1];
    // Constant speeds: the lead grows linearly with distance, turnaround included.
    cmp.grid.forEach((x, j) => {
      const expected = x / 3 - x / 3.15;
      expect(Math.abs(tb.ahead[j]! - expected)).toBeLessThan(10);
    });
  });

  it('ignores a warm-up run the wrong way along the start of the course', () => {
    // Warm-up comes down the first ~700 m of the course in reverse, then turns and starts.
    const reverse: LatLon[] = [{ lat: 41.3765, lon: 2.1925 }, { lat: 41.3702, lon: 2.18905 }];
    const a = act('a', synthTrack({ route: COAST, prefix: reverse, speed: () => 3, start, seed: 17 }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3, start, seed: 18 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const coastLen = COAST.slice(1).reduce((s, p, i) => s + haversine(COAST[i], p), 0);
    expect(Math.abs(cmp.length - coastLen)).toBeLessThan(60);
    expect(Math.abs(cmp.tracks[1].ahead[cmp.grid.length - 1]!)).toBeLessThan(8);
    expect(cmp.tracks[0].aligned.passCount).toBe(1);
  });

  it('removes stopped time in moving mode', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 7, stops: [{ at: 2000, seconds: 90 }] }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3, start, seed: 8 }));
    const elapsed = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const moving = compare([a, b], 'a', { timeMode: 'moving' })!;
    expect(elapsed.tracks[0].duration - elapsed.tracks[1].duration).toBeGreaterThan(80);
    expect(Math.abs(moving.tracks[0].duration - moving.tracks[1].duration)).toBeLessThan(15);
  });

  it('picks the start-line pass that actually leads along the course', () => {
    // B jogs through the start line, out 600 m in another direction and back, then runs.
    const s = COAST[0];
    const away: LatLon = { lat: s.lat - 0.0054, lon: s.lon - 0.001 };
    const pre: LatLon[] = [{ lat: s.lat + 0.0001, lon: s.lon - 0.0006 }, s, away, { lat: s.lat - 0.0002, lon: s.lon }];
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 9 }));
    const b = act('b', synthTrack({ route: COAST, prefix: pre, prefixSpeed: 2.5, speed: () => 3, start, seed: 10 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const tb = cmp.tracks[1];
    expect(tb.aligned.passCount).toBeGreaterThanOrEqual(2);
    expect(Math.abs(tb.ahead[cmp.grid.length - 1]!)).toBeLessThan(8);
  });

  it('trims to the common section when the reference is longer', () => {
    const extended: LatLon[] = [...COAST, { lat: 41.415, lon: 2.229 }];
    const a = act('a', synthTrack({ route: extended, speed: () => 3, start, seed: 11 }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3, start, seed: 12 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const coastLen = COAST.slice(1).reduce((s, p, i) => s + haversine(COAST[i], p), 0);
    expect(Math.abs(cmp.length - coastLen)).toBeLessThan(60);
    expect(cmp.tracks[1].aligned.finished).toBe(true);
  });

  it('computes splits that add up to the total', () => {
    const a = act('a', synthTrack({ route: COAST, speed: () => 3, start, seed: 13 }));
    const b = act('b', synthTrack({ route: COAST, speed: () => 3.2, start, seed: 14 }));
    const cmp = compare([a, b], 'a', { timeMode: 'elapsed' })!;
    const splits = computeSplits(cmp, 1000);
    expect(splits.length).toBe(Math.ceil(cmp.length / 1000 - 0.001));
    const sum = splits.reduce((s, sp) => s + sp.times[1]!, 0);
    expect(sum).toBeCloseTo(cmp.tracks[1].duration, 3);
    expect(splits.every((sp) => sp.fastest === 1)).toBe(true);
  });
});
