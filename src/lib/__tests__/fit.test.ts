import { Encoder, Profile } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { parseFit } from '../parse/fit';

const DEG_TO_SEMI = 2 ** 31 / 180;
// The SDK's typings don't list per-message fields.
const mesg = (m: Record<string, unknown>) => m as unknown as Parameters<Encoder['onMesg']>[1];

describe('parseFit', () => {
  it('reads positions, time and sensor data from records', async () => {
    const enc = new Encoder();
    const t0 = new Date('2026-05-01T09:00:00Z');
    enc.onMesg(Profile.MesgNum.FILE_ID, mesg({ type: 'activity', manufacturer: 'development', product: 0, timeCreated: t0 }));
    for (let i = 0; i < 5; i++) {
      enc.onMesg(Profile.MesgNum.RECORD, mesg({
        timestamp: new Date(t0.getTime() + i * 1000),
        positionLat: Math.round((41.38 + i * 1e-4) * DEG_TO_SEMI),
        positionLong: Math.round(2.17 * DEG_TO_SEMI),
        heartRate: 140 + i,
        cadence: 85,
        power: 200 + i,
        enhancedAltitude: 12.5,
      }));
    }
    enc.onMesg(Profile.MesgNum.SESSION, mesg({ sport: 'cycling', startTime: t0, timestamp: new Date(t0.getTime() + 5000) }));
    const bytes: Uint8Array = enc.close();
    const parsed = await parseFit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(parsed.sport).toBe('cycling');
    expect(parsed.points).toHaveLength(5);
    expect(parsed.points[2].lat).toBeCloseTo(41.3802, 5);
    expect(parsed.points[2].lon).toBeCloseTo(2.17, 5);
    expect(parsed.points[2].t).toBe(t0.getTime() + 2000);
    expect(parsed.points[2]).toMatchObject({ hr: 142, cad: 85, pwr: 202 });
    expect(parsed.points[2].ele).toBeCloseTo(12.5, 0); // FIT altitude resolution is 0.2 m
  });
});
