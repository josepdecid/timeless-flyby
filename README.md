# Timeless Flyby

Compare GPS activities on the same route, whenever they were recorded. Drop GPX, TCX or FIT files and every
activity is aligned to the same start line and replayed as if everyone set off together: you against
yourself months ago, or a group that ran the same course on different days. Works for any sport with a GPS
track.

Everything runs in the browser. Files are never uploaded; activities and settings are kept in
`localStorage` so they survive a reload.

Have a Strava link instead of a file? Paste it and the app gives you a one-click link to that activity's GPX
export on Strava. Strava doesn't allow other sites to download activity files, so you still save the file and
drop it in, but you skip digging through Strava's menus.

## Features

- **Replay** on the map with live standings, play/pause/scrub, 1×–600× speed and follow-the-leader.
- **Gap chart**: time ahead or behind the reference at every point along the route.
- **Difference map**: the route coloured by how much faster or slower a track was than the reference, or by
  who was fastest on each stretch. Stretches are even splits (up to 120), a fixed distance, or your own segments.
- **Splits** of any length, with per-split and cumulative deltas.
- **Segments**: mark your own stretches (a climb, a sprint) by distance or by dragging their ends on the map,
  and compare everyone's time on each. They're saved and reused with other activities over the same road.
- **Metric overlays**: pace/speed, elevation, heart rate, cadence and power over distance, when present.
- **Elapsed or moving time**: moving time drops stops (traffic lights, breaks) from the comparison.

## How the alignment works

1. One activity is the **reference** (any of them; click "Set as ref"). Its GPS line becomes the route, with
   stationary drift removed.
2. The **common section** is the longest stretch of that route which every other track also covers, in the
   same direction and in the same order. Warm-ups, cool-downs and detours fall outside it. You can override it
   by dragging the Start/Finish flags on the map.
3. Each track is **projected onto the route** sample by sample within a sliding window that only moves
   forward, and is heading-aware. That keeps laps, loops and out-and-back legs from snapping onto the wrong
   pass of the same road.
4. Start and finish times are interpolated where each track crosses the section's start and end. If a track
   passes the start line several times (a warm-up through the start, laps), the most efficient pass is used,
   and you can choose another.

Everything downstream (gap, splits, metrics, replay) is computed against distance along the reference
route, so all tracks are measured on the same ruler.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # alignment, parser and FIT round-trip tests
npm run check     # svelte-check / TypeScript
npm run build     # static site in dist/
npm run samples   # regenerate the synthetic demo files in public/samples/
npm run og        # re-render public/og-image.png and apple-touch-icon.png (needs Chrome)
```

`dist/` is plain static files with relative paths, so it can be hosted anywhere (GitHub Pages, Netlify, S3, a
sub-folder of another site). Browsers won't run ES modules from `file://`, so serve it over HTTP, e.g.
`npm run preview` or `python3 -m http.server -d dist`.

Every push to `main` is type-checked, tested, built and deployed to GitHub Pages at
<https://josepdecid.com/timeless-flyby/> by `.github/workflows/deploy.yml`.

Stack: Vite, Svelte 5, TypeScript, Leaflet (OpenStreetMap tiles), uPlot, and the Garmin FIT SDK, which is
lazy-loaded only when a FIT file is opened.
