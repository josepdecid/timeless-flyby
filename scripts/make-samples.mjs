// Generates the synthetic demo activities in public/samples/ (run: npm run samples).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { synthTrack, outAndBack, toGpx } = await server.ssrLoadModule('/src/lib/synth.ts');

  // Barcelona seafront promenade, Sant Sebastià → Fòrum (approximate).
  const coast = [
    { lat: 41.3685, lon: 2.189 },
    { lat: 41.3735, lon: 2.1902 },
    { lat: 41.379, lon: 2.1925 },
    { lat: 41.3835, lon: 2.1962 },
    { lat: 41.3858, lon: 2.2003 },
    { lat: 41.3905, lon: 2.2045 },
    { lat: 41.3945, lon: 2.2095 },
    { lat: 41.3985, lon: 2.2145 },
    { lat: 41.4035, lon: 2.2195 },
    { lat: 41.4075, lon: 2.2232 },
    { lat: 41.411, lon: 2.226 },
  ];
  const route = outAndBack(coast);
  const warmup = [
    { lat: 41.3805, lon: 2.1865 },
    { lat: 41.3755, lon: 2.1872 },
    { lat: 41.3712, lon: 2.1884 },
    { lat: 41.3685, lon: 2.189 },
  ];
  const ele = (d, L) => 4 + 3 * Math.sin((d / L) * Math.PI * 6) + 2 * Math.sin((d / L) * Math.PI * 17);

  const samples = [
    {
      file: 'seafront-march.gpx',
      name: 'Seafront 10K — March',
      opts: {
        route,
        prefix: warmup,
        prefixSpeed: 2.6,
        speed: (d, L) => 3.12 + 0.08 * Math.sin((d / L) * Math.PI * 4),
        start: new Date('2026-03-08T08:12:00Z'),
        stops: [{ at: 5600, seconds: 45 }],
        seed: 11,
        hr: (d, L) => 148 + 14 * (d / L),
        cad: 168,
        ele,
      },
    },
    {
      file: 'seafront-october.gpx',
      name: 'Seafront 10K — October',
      opts: {
        route,
        speed: (d, L) => (d < L / 2 ? 3.08 : 3.42) + 0.05 * Math.sin(d / 300),
        start: new Date('2026-10-18T07:46:00Z'),
        idleBefore: 25,
        seed: 23,
        hr: (d, L) => 145 + 20 * (d / L) ** 1.5,
        cad: 172,
        ele,
      },
    },
    {
      file: 'seafront-friend.gpx',
      name: 'Seafront 10K — Club mate',
      opts: {
        route,
        speed: (d, L) => 3.55 - 0.55 * (d / L),
        start: new Date('2026-10-18T07:46:00Z'),
        seed: 37,
        cad: 176,
        ele,
      },
    },
  ];

  mkdirSync('public/samples', { recursive: true });
  for (const s of samples) {
    const pts = synthTrack(s.opts);
    writeFileSync(`public/samples/${s.file}`, toGpx(s.name, 'running', pts));
    console.log(`${s.file}: ${pts.length} points`);
  }
} finally {
  await server.close();
}
