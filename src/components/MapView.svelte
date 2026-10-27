<script lang="ts">
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { matchOnRoute, positionAt, snapToRoute } from '../lib/align';
  import { positionAtX, routeBetween, segmentStats, type Comparison } from '../lib/analysis';
  import { divergingColor, divergingLegend } from '../lib/colors';
  import {
    app,
    clampCount,
    MAX_EVEN_SEGMENTS,
    SEGMENT_LENGTHS,
    type BaseMap,
    type MapColorMode,
    type MapSegment,
  } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import Icon from './Icon.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import ReplayBar from './ReplayBar.svelte';

  let el: HTMLDivElement;
  let wrap: HTMLDivElement;
  let full = $state(false);
  /** Floating cards at the bottom; their height is kept clear when fitting the route. */
  let dock: HTMLDivElement | undefined = $state();
  let map = $state.raw<L.Map | null>(null);
  let base: L.TileLayer | null = null;
  const routes = L.layerGroup();
  const flags = L.layerGroup();
  const hover = L.layerGroup();
  const segEdit = L.layerGroup();
  const runners = L.layerGroup();
  let runnerMarkers = new Map<string, L.CircleMarker>();
  let markerRenderer: L.Renderer;
  let lastFitKey = '';

  // Keyless tile sources only. "Default" is OSM, toned down (and inverted in dark mode) by CSS
  // so the data colours stand out.
  const TILES: Record<Exclude<BaseMap, 'auto'>, { url: string; attribution: string; maxZoom: number }> = {
    osm: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      maxZoom: 17,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    },
  };

  const ll = (p: { lat: number; lon: number }): L.LatLngTuple => [p.lat, p.lon];

  function css(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  onMount(() => {
    // Attribution goes top-right so the bottom cards can sit as close to the edge as the sides.
    const m = L.map(el, { preferCanvas: true, zoomControl: true, attributionControl: false }).setView([41.39, 2.17], 12);
    L.control.attribution({ position: 'topright' }).addTo(m);
    // Runner and hover markers get their own pane above the route lines, which are redrawn often.
    m.createPane('tf-markers').style.zIndex = '450';
    markerRenderer = L.canvas({ pane: 'tf-markers' });
    map = m;
    routes.addTo(map);
    flags.addTo(map);
    segEdit.addTo(map);
    hover.addTo(map);
    runners.addTo(map);
    const ro = new ResizeObserver(() => map?.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  });

  onDestroy(() => map?.remove());

  // Real fullscreen where the browser allows it; otherwise (iPhone Safari) cover the window.
  const nativeFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  function toggleFull() {
    if (!nativeFullscreen) {
      full = !full;
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrap.requestFullscreen().catch(() => (full = true));
    }
  }

  // Base layer
  $effect(() => {
    if (!map) return;
    const t = TILES[app.settings.baseMap === 'auto' ? 'osm' : app.settings.baseMap];
    base?.remove();
    base = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom, detectRetina: false }).addTo(map);
    base.bringToBack();
  });

  // Route lines
  $effect(() => {
    const cmp = app.comparison;
    const mode = app.settings.mapColorMode;
    const focus = app.focusIndex;
    const segments = app.mapSegments;
    void app.dark;
    void view.colors;
    if (!map) return;
    drawRoutes(cmp, mode, focus, segments);
    drawFlags(cmp);
    const fitKey = cmp ? `${cmp.refId}|${cmp.tracks.map((t) => t.activity.id).join(',')}` : '';
    if (cmp && fitKey !== lastFitKey) {
      lastFitKey = fitKey;
      const b = L.latLngBounds(cmp.tracks.flatMap((t) => t.activity.points.filter((_, i) => i % 10 === 0).map(ll)));
      map.invalidateSize();
      if (b.isValid()) map.fitBounds(b, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + untrack(() => dock?.offsetHeight ?? 0)] });
    }
  });

  function drawRoutes(cmp: Comparison | null, mode: MapColorMode, focus: number, segments: MapSegment[]) {
    routes.clearLayers();
    if (!cmp) return;
    const casing = css('--surface');
    const dark = app.dark;

    // Each track's own GPS line: faint outside the section, bold inside.
    for (const tr of cmp.tracks) {
      const color = view.colors.get(tr.activity.id) ?? '#888';
      const pts = tr.activity.points;
      const inside = pts.filter((p) => p.t >= tr.aligned.tStart && p.t <= tr.aligned.tEnd).map(ll);
      L.polyline(pts.map(ll), { color, weight: 2, opacity: 0.35, interactive: false }).addTo(routes);
      if (mode === 'tracks' && inside.length > 1) {
        L.polyline(inside, { color: casing, weight: 7, opacity: 0.9, interactive: false }).addTo(routes);
        L.polyline(inside, { color, weight: 4, opacity: 1 })
          .bindTooltip(view.names.get(tr.activity.id) ?? '', { sticky: true, className: 'tf-tip' })
          .addTo(routes);
      }
    }
    if (mode === 'tracks' || cmp.tracks.length < 2) return;

    // Colour the reference line segment by segment; custom segments may leave gaps, drawn as casing only.
    L.polyline(cmp.routeAt.map(ll), { color: casing, weight: 9, opacity: 0.95, interactive: false }).addTo(routes);
    const stats = segmentStats(cmp, segments);
    stats.forEach((s, i) => {
      const tk = s.times[focus];
      const t0 = s.times[0];
      // Relative time difference vs the reference; positive = slower.
      const rel = tk != null && t0 != null && t0 > 0 ? (tk - t0) / t0 : NaN;
      const color =
        mode === 'gain'
          ? divergingColor(rel, dark)
          : s.fastest >= 0
            ? (view.colors.get(cmp.tracks[s.fastest].activity.id) ?? '#888')
            : css('--muted');
      const tip =
        mode === 'gain'
          ? Number.isFinite(rel)
            ? `${Math.abs(rel * 100).toFixed(1)}% ${rel > 0 ? 'slower' : 'faster'} than the reference`
            : 'Not covered'
          : s.fastest >= 0
            ? `Fastest: ${view.names.get(cmp.tracks[s.fastest].activity.id)}`
            : '';
      const name = segments[i].name;
      L.polyline(routeBetween(cmp, s.from, s.to).map(ll), { color, weight: 6, opacity: 1, lineCap: 'butt' })
        .bindTooltip(name ? `<strong>${escapeHtml(name)}</strong><br>${tip}` : tip, { sticky: true, className: 'tf-tip' })
        .addTo(routes);
    });
  }

  function flagIcon(kind: 'start' | 'finish') {
    return L.divIcon({
      className: `tf-flag tf-flag-${kind}`,
      html: `<i></i><span>${kind === 'start' ? 'Start' : 'Finish'}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  function drawFlags(cmp: Comparison | null) {
    flags.clearLayers();
    if (!cmp) return;
    const make = (kind: 'start' | 'finish', d: number) => {
      const m = L.marker(ll(positionAt(cmp.ref, d)), {
        icon: flagIcon(kind),
        draggable: true,
        keyboard: true,
        title: `Drag to move the ${kind} along the reference route`,
        zIndexOffset: 1000,
      });
      m.on('drag', () => {
        const p = m.getLatLng();
        const snapped = positionAt(cmp.ref, snapToRoute(cmp.ref, { lat: p.lat, lon: p.lng }));
        m.setLatLng(ll(snapped));
      });
      m.on('dragend', () => {
        const startM = kind === 'start' ? m.getLatLng() : L.latLng(ll(positionAt(cmp.ref, cmp.section.startD)));
        const endM = kind === 'finish' ? m.getLatLng() : L.latLng(ll(positionAt(cmp.ref, cmp.section.endD)));
        app.setSection({
          start: { lat: startM.lat, lon: startM.lng },
          end: { lat: endM.lat, lon: endM.lng },
        });
      });
      m.addTo(flags);
    };
    make('start', cmp.section.startD);
    make('finish', cmp.section.endD);
  }

  function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // Custom segments, while the Segments tab is open: each one outlined, the selected one with
  // draggable ends that slide along the reference route.
  $effect(() => {
    const cmp = app.comparison;
    const placed = app.placedSegments;
    const selected = app.selectedSegment;
    const editing = app.settings.stat === 'segments';
    void app.dark;
    segEdit.clearLayers();
    if (!map || !cmp || !editing) return;
    const accent = css('--accent');
    const casing = css('--surface');
    for (const { segment, range } of placed) {
      if (!range) continue;
      const isSel = segment.id === selected;
      const pts = routeBetween(cmp, range.from, range.to).map(ll);
      L.polyline(pts, { color: casing, weight: isSel ? 12 : 9, opacity: 0.9, interactive: false }).addTo(segEdit);
      const line = L.polyline(pts, {
        color: accent,
        weight: isSel ? 7 : 4,
        opacity: isSel ? 1 : 0.7,
        dashArray: isSel ? undefined : '6 6',
        lineCap: 'butt',
      })
        .bindTooltip(escapeHtml(segment.name), { sticky: true, className: 'tf-tip' })
        .on('click', () => (app.selectedSegment = segment.id))
        .addTo(segEdit);
      if (!isSel) continue;
      const ends = { from: range.from, to: range.to };
      const handle = (which: 'from' | 'to') => {
        const m = L.marker(ll(positionAt(cmp.ref, cmp.section.startD + ends[which])), {
          icon: L.divIcon({ className: 'tf-seg-end', html: '<i></i>', iconSize: [0, 0], iconAnchor: [0, 0] }),
          draggable: true,
          keyboard: true,
          title: `Drag to move the segment ${which === 'from' ? 'start' : 'end'} along the reference route`,
          zIndexOffset: 900,
        });
        m.on('drag', () => {
          const p = m.getLatLng();
          const q = { lat: p.lat, lon: p.lng };
          // Stay on the same pass of a loop while the pointer is near the route.
          const d = matchOnRoute(cmp.ref, q, cmp.section.startD + ends[which], 60) ?? snapToRoute(cmp.ref, q);
          const x = Math.min(cmp.length, Math.max(0, d - cmp.section.startD));
          ends[which] = which === 'from' ? Math.min(x, ends.to - 5) : Math.max(x, ends.from + 5);
          m.setLatLng(ll(positionAt(cmp.ref, cmp.section.startD + ends[which])));
          line.setLatLngs(routeBetween(cmp, ends.from, ends.to).map(ll));
        });
        m.on('dragend', () => app.moveSegment(segment.id, ends.from, ends.to));
        m.addTo(segEdit);
      };
      handle('from');
      handle('to');
    }
  });

  // Replay markers
  $effect(() => {
    const cmp = app.comparison;
    const states = view.replay;
    void app.dark;
    if (!map || !cmp) {
      runners.clearLayers();
      runnerMarkers = new Map();
      return;
    }
    const ring = css('--surface');
    const seen = new Set<string>();
    for (const st of states) {
      seen.add(st.id);
      let m = runnerMarkers.get(st.id);
      const color = view.colors.get(st.id) ?? '#888';
      if (!m) {
        m = L.circleMarker(ll(st.pos), {
          radius: 7,
          weight: 3,
          color: ring,
          fillColor: color,
          fillOpacity: 1,
          pane: 'tf-markers',
          renderer: markerRenderer,
        })
          .bindTooltip(view.names.get(st.id) ?? '', { className: 'tf-tip', direction: 'top', offset: [0, -8] })
          .addTo(runners);
        runnerMarkers.set(st.id, m);
      } else {
        m.setLatLng(ll(st.pos));
        m.setStyle({ color: ring, fillColor: color });
      }
    }
    for (const [id, m] of runnerMarkers) {
      if (!seen.has(id)) {
        m.remove();
        runnerMarkers.delete(id);
      }
    }
  });

  // Follow the leader during replay
  let lastPan = 0;
  $effect(() => {
    const lead = view.standings[0];
    if (!map || !app.settings.follow || !app.playing || !lead) return;
    const now = performance.now();
    if (now - lastPan < 200) return;
    lastPan = now;
    const p = view.replay[lead.k]?.pos;
    if (p && !map.getBounds().pad(-0.25).contains(ll(p))) map.panTo(ll(p), { animate: true, duration: 0.5 });
  });

  // Chart hover: where was everyone at this distance?
  $effect(() => {
    const cmp = app.comparison;
    const x = app.hoverX;
    hover.clearLayers();
    if (!map || !cmp || x == null) return;
    for (const tr of cmp.tracks) {
      const p = positionAtX(cmp, tr, x);
      if (!p) continue;
      L.circleMarker(ll(p), {
        radius: 6,
        weight: 3,
        color: view.colors.get(tr.activity.id),
        fillColor: css('--surface'),
        fillOpacity: 1,
        interactive: false,
        pane: 'tf-markers',
        renderer: markerRenderer,
      }).addTo(hover);
    }
  });

  const legend = $derived(divergingLegend(app.dark));
  const focusName = $derived(
    app.comparison && app.focusIndex > 0 ? view.names.get(app.comparison.tracks[app.focusIndex].activity.id) : '',
  );
</script>

<svelte:document onfullscreenchange={() => (full = document.fullscreenElement === wrap)} />
<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && full && !document.fullscreenElement) full = false;
  }}
/>

{#snippet mapControls(where: 'top' | 'docked', tracks: number)}
<div class="controls card {where}">
  <div class="seg" role="group" aria-label="Map colouring">
    <button aria-pressed={app.settings.mapColorMode === 'tracks'} onclick={() => (app.settings.mapColorMode = 'tracks')}>
      Tracks
    </button>
    <button
      aria-pressed={app.settings.mapColorMode === 'gain'}
      disabled={tracks < 2}
      onclick={() => (app.settings.mapColorMode = 'gain')}>Gain / loss</button
    >
    <button
      aria-pressed={app.settings.mapColorMode === 'fastest'}
      disabled={tracks < 2}
      onclick={() => (app.settings.mapColorMode = 'fastest')}>Fastest</button
    >
  </div>
  {#if app.settings.mapColorMode !== 'tracks' && tracks > 1}
    <div class="segctl">
      <select class="input" bind:value={app.settings.segmentMode} aria-label="How the route is split for colouring">
        <option value="even">Even splits</option>
        <option value="distance">By distance</option>
        <option value="custom">Custom segments</option>
      </select>
      {#if app.settings.segmentMode === 'even'}
        <input
          class="input count num"
          type="number"
          min="1"
          max={MAX_EVEN_SEGMENTS}
          value={app.settings.segmentCount}
          onchange={(e) => {
            app.settings.segmentCount = clampCount(e.currentTarget.valueAsNumber);
            e.currentTarget.value = String(app.settings.segmentCount);
          }}
          aria-label="Number of even splits (up to {MAX_EVEN_SEGMENTS})"
          title="Number of even splits (up to {MAX_EVEN_SEGMENTS})"
        />
      {:else if app.settings.segmentMode === 'distance'}
        <select
          class="input"
          value={app.segmentLength}
          onchange={(e) => (app.settings.segmentLength = +e.currentTarget.value)}
          aria-label="Split length"
        >
          {#each SEGMENT_LENGTHS[app.settings.units] as [v, label] (v)}
            <option value={v}>Every {label}</option>
          {/each}
        </select>
      {:else}
        <button class="btn" onclick={() => (app.settings.stat = 'segments')}>
          {app.mapSegments.length ? `${app.mapSegments.length} on route` : 'None yet'} · Edit
        </button>
      {/if}
    </div>
  {/if}
  <select class="input" bind:value={app.settings.baseMap} aria-label="Base map">
    <option value="auto">Map: default</option>
    <option value="osm">Map: OpenStreetMap</option>
    <option value="topo">Map: topographic</option>
    <option value="satellite">Map: satellite</option>
  </select>
</div>
{/snippet}

<div class="mapwrap" class:full bind:this={wrap}>
  <div
    class="map"
    class:muted-tiles={app.settings.baseMap === 'auto' && !app.dark}
    class:dark-tiles={app.settings.baseMap === 'auto' && app.dark}
    bind:this={el}
  ></div>

  <button
    class="fs"
    onclick={toggleFull}
    aria-pressed={full}
    aria-label={full ? 'Exit fullscreen' : 'Fullscreen map'}
    title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
  >
    <Icon name={full ? 'collapse' : 'expand'} size={18} />
  </button>

  {#if app.comparison}
    {@render mapControls('top', app.comparison.tracks.length)}

    <Leaderboard />

    <div class="dock" bind:this={dock}>
      {#if app.settings.mapColorMode === 'gain' && app.comparison.tracks.length > 1}
        <div class="scale card">
          <div class="scale-title">
            <select
              class="input compact"
              value={app.comparison.tracks[app.focusIndex]?.activity.id}
              onchange={(e) => (app.session.focusId = e.currentTarget.value)}
              aria-label="Track compared with the reference"
            >
              {#each app.comparison.tracks.slice(1) as tr (tr.activity.id)}
                <option value={tr.activity.id}>{view.names.get(tr.activity.id)}</option>
              {/each}
            </select>
            <span class="secondary">vs reference</span>
          </div>
          <div class="bins">
            {#each legend as b (b.label)}
              <div class="bin">
                <span class="chip" style:background={b.color}></span>
                <span class="muted">{b.label}</span>
              </div>
            {/each}
          </div>
          <div class="ends"><span>faster</span><span>slower</span></div>
          <span class="sr-only">Showing {focusName}</span>
        </div>
      {/if}
      {@render mapControls('docked', app.comparison.tracks.length)}
      <ReplayBar />
    </div>
  {/if}
</div>

<style>
  .mapwrap {
    position: relative;
    height: 100%;
  }
  .map {
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
    overflow: hidden;
    z-index: 0;
  }
  .mapwrap.full {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--page);
  }
  .mapwrap.full .map {
    border-radius: 0;
  }
  /* Styled like Leaflet's zoom bar, stacked under it. */
  .fs {
    position: absolute;
    top: 82px;
    left: 10px;
    z-index: 500;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    background: var(--surface);
    background-clip: padding-box;
    color: var(--text-2);
  }
  .fs:hover {
    color: var(--text);
  }
  .controls {
    position: absolute;
    top: 10px;
    left: 54px;
    z-index: 500;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px;
    box-shadow: var(--shadow);
  }
  /* Bottom cards (gain/loss scale, replay bar) stack here instead of overlapping. */
  .dock {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 500;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    pointer-events: none;
  }
  .dock > :global(*) {
    pointer-events: auto;
  }
  .dock > :global(.bar) {
    align-self: stretch;
    box-shadow: var(--shadow);
  }
  .controls.docked {
    display: none;
    position: static;
  }
  .controls .input,
  .controls .btn {
    height: 30px;
    font-size: 13px;
  }
  .segctl {
    display: flex;
    gap: 6px;
  }
  .input.count {
    width: 64px;
  }
  .seg button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .scale {
    padding: 8px 10px;
    box-shadow: var(--shadow);
    font-size: 12px;
  }
  .scale-title {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .input.compact {
    height: 26px;
    font-size: 12px;
    max-width: 180px;
  }
  .bins {
    display: flex;
    gap: 2px;
  }
  .bin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 30px;
  }
  .chip {
    width: 100%;
    height: 8px;
    border-radius: 2px;
  }
  .bin .muted {
    font-size: 10px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    color: var(--text-2);
    margin-top: 2px;
  }
  .muted-tiles :global(.leaflet-tile-pane) {
    filter: grayscale(0.85) contrast(0.9) brightness(1.04);
  }
  .dark-tiles :global(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) grayscale(0.8) brightness(0.85) contrast(0.9);
  }
  :global(.tf-seg-end i) {
    position: absolute;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border-radius: 50%;
    background: var(--surface);
    border: 3px solid var(--accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    cursor: grab;
  }
  /* Start label sits up-left of its pin and Finish up-right, so they don't collide on loops. */
  :global(.tf-flag i) {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    border: 2px solid var(--surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    cursor: grab;
  }
  :global(.tf-flag span) {
    position: absolute;
    bottom: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    cursor: grab;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  :global(.tf-flag-start i),
  :global(.tf-flag-start span) {
    background: var(--text);
    color: var(--surface);
  }
  :global(.tf-flag-start span) {
    right: 2px;
  }
  :global(.tf-flag-finish i) {
    background: var(--surface);
    border-color: var(--text);
  }
  :global(.tf-flag-finish span) {
    left: 2px;
    background: var(--surface);
    color: var(--text);
    border: 1.5px solid var(--text);
  }
  @media (max-width: 640px) {
    .controls.top {
      display: none;
    }
    .controls.docked {
      display: flex;
    }
  }
</style>
