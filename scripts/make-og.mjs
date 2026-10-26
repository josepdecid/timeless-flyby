// Renders the social preview card and touch icon from scripts/og/*.html into public/ (run: npm run og).
// Needs a local Chrome/Chromium; set CHROME to its binary if it is not in a default location.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chrome = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!chrome) throw new Error('Chrome not found; set CHROME=/path/to/chrome');

const outputs = [
  { src: 'og/card.html', out: '../public/og-image.png', width: 1200, height: 630 },
  { src: 'og/icon.html', out: '../public/apple-touch-icon.png', width: 180, height: 180 },
];

for (const { src, out, width, height } of outputs) {
  const file = fileURLToPath(new URL(out, import.meta.url));
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=2000',
    `--screenshot=${file}`,
    new URL(src, import.meta.url).href,
  ], { stdio: 'ignore' });
  console.log(`wrote ${file}`);
}
