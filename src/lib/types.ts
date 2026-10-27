/** A single recorded sample. `t` is epoch milliseconds. */
export interface TrackPoint {
  t: number;
  lat: number;
  lon: number;
  ele?: number;
  hr?: number;
  cad?: number;
  pwr?: number;
}

/** Output of a file parser, before the app assigns identity/colour. */
export interface ParsedActivity {
  name: string;
  sport: string;
  points: TrackPoint[];
}

export interface Activity extends ParsedActivity {
  id: string;
  fileName: string;
  /** Index into the categorical palette; follows the activity, never its rank. */
  slot: number;
  /** Excluded activities stay loaded but don't take part in the comparison. */
  included: boolean;
}

export type MetricKey = 'speed' | 'ele' | 'hr' | 'cad' | 'pwr';

export interface LatLon {
  lat: number;
  lon: number;
}

/** A stretch of road the user marked, saved by its ends so it outlives the activities. */
export interface CustomSegment {
  id: string;
  name: string;
  start: LatLon;
  end: LatLon;
  /** Distances along the reference route when last placed; picks the pass on loops and out-and-backs. */
  near: [number, number];
}
