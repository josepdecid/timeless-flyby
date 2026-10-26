// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compare, replayState } from '../analysis';
import { cleanPoints } from '../parse';
import { parseGpx } from '../parse/gpx';
import type { Activity } from '../types';

// The bundled demo: an out-and-back where the reference's warm-up runs down the course's
// finishing stretch, in the same direction, before turning at the start.
function load(name: string): Activity {
  const p = parseGpx(readFileSync(`public/samples/seafront-${name}.gpx`, 'utf8'));
  return { ...p, points: cleanPoints(p.points), id: name, fileName: name, slot: 0, included: true };
}

describe('bundled samples', () => {
  const cmp = compare([load('march'), load('october'), load('friend')], 'march', { timeMode: 'elapsed' })!;

  it('starts everyone at the same line', () => {
    for (const tr of cmp.tracks) {
      expect(replayState(cmp, tr, 0).x).toBeLessThan(5);
      expect(tr.aligned.finished).toBe(true);
      expect(tr.aligned.passCount).toBe(1);
    }
  });

  it('finds the out-and-back course, without the warm-up', () => {
    expect(cmp.length).toBeGreaterThan(11_300);
    expect(cmp.length).toBeLessThan(11_900);
  });
});
