<script lang="ts">
  import Chart, { type ChartOverlay, type ChartSeries } from './Chart.svelte';
  import Icon from './Icon.svelte';
  import Legend from './Legend.svelte';
  import SegmentsTable from './SegmentsTable.svelte';
  import SplitsTable from './SplitsTable.svelte';
  import { app, type StatView } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import { distanceValue, elevationValue, fmtGap, speedFormat } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import type { MetricKey } from '../lib/types';

  const cmp = $derived(app.comparison);

  function seriesFor(key: MetricKey | 'ahead', transform: (v: number) => number = (v) => v): ChartSeries[] {
    if (!cmp) return [];
    return cmp.tracks
      .filter((tr) => key === 'ahead' || tr.metrics[key])
      .map((tr) => {
        const raw = key === 'ahead' ? tr.ahead : tr.metrics[key]!;
        const isRef = tr.activity.id === cmp.refId;
        return {
          id: tr.activity.id,
          label: (view.names.get(tr.activity.id) ?? tr.activity.name) + (isRef && key === 'ahead' ? t.charts.referenceSuffix : ''),
          color: view.colors.get(tr.activity.id) ?? '#888',
          values: raw.map((v) => (v == null ? null : transform(v))),
        };
      });
  }

  /** Clip spikes (a stop makes pace shoot to infinity) so they don't flatten everything else. */
  function robust(list: ChartSeries[]): ChartSeries[] {
    const all = list.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
    if (all.length < 10) return list;
    all.sort((a, b) => a - b);
    const lo = all[Math.floor(all.length * 0.02)];
    const hi = all[Math.floor(all.length * 0.98)];
    const span = hi - lo || Math.abs(hi) || 1;
    const min = lo - span * 0.5;
    const max = hi + span * 0.5;
    return list.map((s) => ({
      ...s,
      values: s.values.map((v) => (v == null || !Number.isFinite(v) ? null : Math.min(max, Math.max(min, v)))),
    }));
  }

  const sport = $derived(app.refActivity?.sport ?? '');
  const speedFmt = $derived(speedFormat('speed', app.settings.units, sport));
  const paceFmt = $derived(speedFormat('pace', app.settings.units, sport));
  const eleUnit = $derived(app.settings.units === 'imperial' ? 'ft' : 'm');
  const round = (v: number) => `${Math.round(v)}`;

  interface ChartSpec {
    title: string;
    unit: string;
    series: ChartSeries[];
    yFormat: (v: number) => string;
    invert?: boolean;
    zeroLine?: boolean;
    timeTicks?: boolean;
  }

  // Only the selected chart's series are computed.
  const spec: ChartSpec | null = $derived.by(() => {
    switch (active) {
      case 'ahead':
        return {
          title: t.charts.timeAheadTitle,
          unit: t.charts.timeAheadUnit,
          series: seriesFor('ahead'),
          yFormat: fmtGap,
          zeroLine: true,
          timeTicks: true,
        };
      case 'speed':
        return { title: t.charts.speed, unit: speedFmt.unit, series: robust(seriesFor('speed', speedFmt.value)), yFormat: speedFmt.label };
      case 'pace':
        return {
          title: t.charts.pace,
          unit: paceFmt.unit,
          series: robust(seriesFor('speed', paceFmt.value)),
          yFormat: paceFmt.label,
          invert: true,
          timeTicks: true,
        };
      case 'ele':
        return {
          title: t.charts.elevation,
          unit: eleUnit,
          series: seriesFor('ele', (v) => elevationValue(v, app.settings.units)),
          yFormat: round,
        };
      case 'hr':
        return { title: t.charts.heartRate, unit: 'bpm', series: seriesFor('hr'), yFormat: round };
      case 'cad':
        return { title: t.charts.cadence, unit: t.charts.cadenceUnit, series: seriesFor('cad'), yFormat: round };
      case 'pwr':
        return { title: t.charts.power, unit: 'W', series: robust(seriesFor('pwr')), yFormat: round };
      default:
        return null;
    }
  });

  const has = (key: MetricKey) => !!cmp?.tracks.some((tr) => tr.metrics[key]);
  const multi = $derived((cmp?.tracks.length ?? 0) > 1);

  /** Optional metrics only appear when some file carries them. */
  const options: { id: StatView; label: string; disabled?: boolean }[] = $derived(
    [
      { id: 'ahead' as const, label: t.charts.timeAhead, disabled: !multi },
      { id: 'speed' as const, label: t.charts.speed },
      { id: 'pace' as const, label: t.charts.pace },
      has('ele') && { id: 'ele' as const, label: t.charts.elevation },
      has('hr') && { id: 'hr' as const, label: t.charts.heartRate },
      has('cad') && { id: 'cad' as const, label: t.charts.cadence },
      has('pwr') && { id: 'pwr' as const, label: t.charts.power },
      { id: 'splits' as const, label: t.charts.splits },
      { id: 'segments' as const, label: t.charts.segments },
    ].filter((o) => !!o),
  );

  /** The stored choice, unless it isn't available for the current files. */
  const active: StatView = $derived(
    options.some((o) => o.id === app.settings.stat && !o.disabled) ? app.settings.stat : app.speedMode,
  );

  /** Elevation can sit behind any other chart; it's the same route, so one profile is enough. */
  const tabular = $derived(active === 'splits' || active === 'segments');
  const canOverlay = $derived(has('ele') && active !== 'ele' && !tabular);
  const overlay: ChartOverlay | null = $derived.by(() => {
    if (!cmp || !canOverlay || !app.settings.eleOverlay) return null;
    const tr = cmp.tracks.find((t) => t.activity.id === cmp.refId && t.metrics.ele) ?? cmp.tracks.find((t) => t.metrics.ele);
    if (!tr) return null;
    return {
      label: t.charts.elevation,
      values: tr.metrics.ele!.map((v) => (v == null ? null : elevationValue(v, app.settings.units))),
      format: (v) => `${Math.round(v)} ${eleUnit}`,
    };
  });

  /** Replay position per activity id, in display distance units. */
  const markers = $derived(
    new Map(view.replayActive ? view.replay.map((r) => [r.id, distanceValue(r.x, app.settings.units)]) : []),
  );
  function markersFor(list: ChartSeries[]) {
    return markers.size ? list.map((s) => markers.get(s.id) ?? null) : [];
  }

  let panel: HTMLDivElement | undefined = $state();
  let full = $state(false);

  // Same approach as the map: real fullscreen where allowed, otherwise cover the window.
  const nativeFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  function toggleFull() {
    if (!nativeFullscreen) {
      full = !full;
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      panel?.requestFullscreen().catch(() => (full = true));
    }
  }

  function hover(idx: number | null) {
    app.hoverX = idx == null || !cmp ? null : cmp.grid[idx];
  }
  function seek(idx: number) {
    if (!cmp) return;
    const t = cmp.tracks[0].time[idx];
    if (t != null) {
      app.playing = false;
      app.clock = t;
    }
  }
</script>

<svelte:document onfullscreenchange={() => (full = !!panel && document.fullscreenElement === panel)} />
<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && full && !document.fullscreenElement) full = false;
  }}
/>

{#if cmp}
  <div class="panel card" class:full bind:this={panel} style:--panel-h="{app.settings.chartHeight}px">
    <div class="head">
      <select
        class="input"
        value={active}
        onchange={(e) => (app.settings.stat = e.currentTarget.value as StatView)}
        aria-label={t.charts.statAria}
      >
        {#each options as o (o.id)}
          <option value={o.id} disabled={o.disabled}>{o.label}{o.disabled ? t.charts.needsTwo : ''}</option>
        {/each}
      </select>
      {#if canOverlay}
        <label class="check">
          <input type="checkbox" bind:checked={app.settings.eleOverlay} />
          <span>{t.charts.elevation}</span>
        </label>
      {/if}
      <Legend />
      <button
        class="btn ghost icon fs"
        onclick={toggleFull}
        aria-pressed={full}
        aria-label={full ? t.common.exitFullscreen : t.charts.fullscreen}
        title={full ? t.common.exitFullscreenEsc : t.charts.fullscreen}
      >
        <Icon name={full ? 'collapse' : 'expand'} size={18} />
      </button>
    </div>
    <div class="body" class:scroll={tabular}>
      {#if active === 'splits'}
        <SplitsTable />
      {:else if active === 'segments'}
        <SegmentsTable />
      {:else if spec}
        <Chart
          title={spec.title}
          unit={spec.unit}
          x={view.x}
          series={spec.series}
          yFormat={spec.yFormat}
          xFormat={view.xFormat}
          invert={spec.invert}
          zeroLine={spec.zeroLine}
          timeTicks={spec.timeTicks}
          markers={markersFor(spec.series)}
          {overlay}
          onhover={hover}
          onclick={seek}
        />
        <p class="muted foot">{t.charts.hoverHint}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* The divider in App sets the height; the max keeps room for the map above. */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px 8px;
    height: var(--panel-h);
    max-height: calc(100% - var(--map-min, 0px));
    min-height: 0;
    flex: none;
  }
  .panel.full {
    position: fixed;
    inset: 0;
    z-index: 2000;
    height: auto;
    max-height: none;
    border: 0;
    border-radius: 0;
    padding: 14px 18px 12px;
  }
  /* Native fullscreen sizes the element itself. */
  .panel:fullscreen {
    height: 100%;
    max-height: none;
    border-radius: 0;
    padding: 14px 18px 12px;
  }
  .fs {
    margin-left: auto;
    color: var(--text-2);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-2);
    cursor: pointer;
  }
  .check input {
    accent-color: var(--accent);
  }
  /* Takes the panel's remaining height, so switching views never resizes the map above. */
  .body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .body.scroll {
    display: block;
    overflow-y: auto;
  }
  .body > :global(.chart) {
    flex: 1 1 0;
    min-height: 0;
  }
  .foot {
    font-size: 12px;
    margin: 2px 4px 0;
  }
</style>
