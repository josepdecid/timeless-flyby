import type { ParsedActivity, TrackPoint } from '../types';

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

interface FitRecord {
  timestamp?: Date;
  positionLat?: number;
  positionLong?: number;
  enhancedAltitude?: number;
  altitude?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
}

export async function parseFit(buffer: ArrayBuffer): Promise<ParsedActivity> {
  // The SDK ships the whole FIT profile (~hundreds of KB); only load it when needed.
  const { Decoder, Stream } = await import('@garmin/fitsdk');
  const decoder = new Decoder(Stream.fromArrayBuffer(buffer));
  if (!decoder.isFIT()) throw new Error('Not a FIT file');
  const { messages, errors } = decoder.read();
  const records = (messages.recordMesgs ?? []) as FitRecord[];
  if (!records.length && errors.length) throw new Error(`Could not decode FIT file: ${errors[0]}`);

  const session = (messages.sessionMesgs ?? [])[0] as { sport?: string; subSport?: string } | undefined;
  const sport = session?.sport ?? '';

  const points: TrackPoint[] = [];
  for (const r of records) {
    if (!r.timestamp || r.positionLat == null || r.positionLong == null) continue;
    const p: TrackPoint = {
      t: r.timestamp.getTime(),
      lat: r.positionLat * SEMICIRCLE_TO_DEG,
      lon: r.positionLong * SEMICIRCLE_TO_DEG,
    };
    const ele = r.enhancedAltitude ?? r.altitude;
    if (ele != null) p.ele = ele;
    if (r.heartRate != null) p.hr = r.heartRate;
    if (r.cadence != null) p.cad = r.cadence;
    if (r.power != null) p.pwr = r.power;
    points.push(p);
  }
  return { name: '', sport, points };
}
