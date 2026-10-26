// Deterministic synthetic activities, for tests and the bundled demo files.
import { cumulativeDistance, locate, lerp } from './geo';
import type { LatLon, TrackPoint } from './types';

export interface SynthOptions {
  /** Waypoints of the course; the track follows straight lines between them. */
  route: LatLon[];
  /** Approach path walked/run before reaching route[0] (e.g. a warm-up). */
  prefix?: LatLon[];
  /** Speed in m/s as a function of distance along the course (0..length). */
  speed: (d: number, length: number) => number;
  prefixSpeed?: number;
  start: Date;
  /** Seconds between samples. */
  interval?: number;
  /** Std deviation of GPS noise in metres. */
  noise?: number;
  /** Stops at given course distances, in seconds. */
  stops?: { at: number; seconds: number }[];
  seed?: number;
  hr?: (d: number, length: number) => number;
  cad?: number;
  ele?: (d: number, length: number) => number;
  /** Seconds of recording before moving off. */
  idleBefore?: number;
}

export function synthTrack(o: SynthOptions): TrackPoint[] {
  const rand = mulberry32(o.seed ?? 1);
  const gauss = () => {
    const u = Math.max(1e-9, rand());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const path = [...(o.prefix ?? []), ...o.route];
  const cum = cumulativeDistance(path);
  const prefixLen = o.prefix?.length ? cum[o.prefix.length] : 0;
  const total = cum[cum.length - 1];
  const courseLen = total - prefixLen;
  const dt = o.interval ?? 1;
  // GPS error drifts slowly rather than jumping every sample: AR(1) noise.
  const sigma = o.noise ?? 3;
  const keep = 0.97;
  const kick = Math.sqrt(1 - keep * keep) * sigma;
  let nx = 0;
  let ny = 0;
  const stops = [...(o.stops ?? [])].sort((a, b) => a.at - b.at);

  const out: TrackPoint[] = [];
  let t = o.start.getTime();
  let d = 0;
  let stopIdx = 0;
  let stoppedFor = -(o.idleBefore ?? 0);
  while (d < total) {
    const { i, f } = locate(cum, d);
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    const course = d - prefixLen;
    nx = keep * nx + kick * gauss();
    ny = keep * ny + kick * gauss();
    const p: TrackPoint = {
      t,
      lat: lerp(a.lat, b.lat, f) + ny / 111_320,
      lon: lerp(a.lon, b.lon, f) + nx / (111_320 * Math.cos((a.lat * Math.PI) / 180)),
    };
    if (o.ele) p.ele = Math.round(o.ele(Math.max(0, course), courseLen) * 10) / 10;
    if (o.hr) p.hr = Math.round(o.hr(Math.max(0, course), courseLen) + gauss() * 1.5);
    if (o.cad) p.cad = Math.round(o.cad + gauss());
    out.push(p);

    t += dt * 1000;
    if (stoppedFor < 0) {
      stoppedFor += dt;
      continue;
    }
    if (stopIdx < stops.length && course >= stops[stopIdx].at) {
      stoppedFor += dt;
      if (stoppedFor < stops[stopIdx].seconds) continue;
      stopIdx++;
      stoppedFor = 0;
    }
    const v = course < 0 ? (o.prefixSpeed ?? 2.5) : o.speed(course, courseLen);
    d += v * dt;
  }
  return out;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Out along `route`, then back the same way. */
export function outAndBack(route: LatLon[]): LatLon[] {
  return [...route, ...route.slice(0, -1).reverse()];
}

export function toGpx(name: string, sport: string, points: TrackPoint[]): string {
  const pts = points
    .map((p) => {
      const ext =
        p.hr != null || p.cad != null
          ? `<extensions><gpxtpx:TrackPointExtension>${p.hr != null ? `<gpxtpx:hr>${p.hr}</gpxtpx:hr>` : ''}${
              p.cad != null ? `<gpxtpx:cad>${p.cad}</gpxtpx:cad>` : ''
            }</gpxtpx:TrackPointExtension></extensions>`
          : '';
      const ele = p.ele != null ? `<ele>${p.ele}</ele>` : '';
      return `   <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}<time>${new Date(p.t).toISOString().replace(".000Z", "Z")}</time>${ext}</trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="timeless-flyby synthetic sample" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <metadata><name>${name}</name><time>${new Date(points[0].t).toISOString()}</time></metadata>
 <trk>
  <name>${name}</name>
  <type>${sport}</type>
  <trkseg>
${pts}
  </trkseg>
 </trk>
</gpx>
`;
}
