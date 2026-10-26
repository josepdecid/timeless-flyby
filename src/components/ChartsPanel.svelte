<script lang="ts">
  import Chart, { type ChartSeries } from './Chart.svelte';
  import Legend from './Legend.svelte';
  import SplitsTable from './SplitsTable.svelte';
  import { app, type StatView } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import { distanceValue, elevationValue, fmtGap, speedFormat } from '../lib/format';
  import type { MetricKey } from '../lib/types';

  const CHART_HEIGHT = 170;

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
          label: (view.names.get(tr.activity.id) ?? tr.activity.name) + (isRef && key === 'ahead' ? ' (reference)' : ''),
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
          title: 'Time ahead of the reference',
          unit: 'above zero = ahead, below = behind',
          series: seriesFor('ahead'),
          yFormat: fmtGap,
          zeroLine: true,
          timeTicks: true,
        };
      case 'speed':
        return { title: 'Speed', unit: speedFmt.unit, series: robust(seriesFor('speed', speedFmt.value)), yFormat: speedFmt.label };
      case 'pace':
        return {
          title: 'Pace',
          unit: paceFmt.unit,
          series: robust(seriesFor('speed', paceFmt.value)),
          yFormat: paceFmt.label,
          invert: true,
          timeTicks: true,
        };
      case 'ele':
        return {
          title: 'Elevation',
          unit: eleUnit,
          series: seriesFor('ele', (v) => elevationValue(v, app.settings.units)),
          yFormat: round,
        };
      case 'hr':
        return { title: 'Heart rate', unit: 'bpm', series: seriesFor('hr'), yFormat: round };
      case 'cad':
        return { title: 'Cadence', unit: 'rpm / spm', series: seriesFor('cad'), yFormat: round };
      case 'pwr':
        return { title: 'Power', unit: 'W', series: robust(seriesFor('pwr')), yFormat: round };
      default:
        return null;
    }
  });

  const has = (key: MetricKey) => !!cmp?.tracks.some((tr) => tr.metrics[key]);
  const multi = $derived((cmp?.tracks.length ?? 0) > 1);

  /** Optional metrics only appear when some file carries them. */
  const options: { id: StatView; label: string; disabled?: boolean }[] = $derived(
    [
      { id: 'ahead' as const, label: 'Time ahead', disabled: !multi },
      { id: 'speed' as const, label: 'Speed' },
      { id: 'pace' as const, label: 'Pace' },
      has('ele') && { id: 'ele' as const, label: 'Elevation' },
      has('hr') && { id: 'hr' as const, label: 'Heart rate' },
      has('cad') && { id: 'cad' as const, label: 'Cadence' },
      has('pwr') && { id: 'pwr' as const, label: 'Power' },
      { id: 'splits' as const, label: 'Splits' },
    ].filter((o) => !!o),
  );

  /** The stored choice, unless it isn't available for the current files. */
  const active: StatView = $derived(
    options.some((o) => o.id === app.settings.stat && !o.disabled) ? app.settings.stat : app.speedMode,
  );

  /** Replay position per activity id, in display distance units. */
  const markers = $derived(
    new Map(view.replayActive ? view.replay.map((r) => [r.id, distanceValue(r.x, app.settings.units)]) : []),
  );
  function markersFor(list: ChartSeries[]) {
    return markers.size ? list.map((s) => markers.get(s.id) ?? null) : [];
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

{#if cmp}
  <div class="panel card">
    <div class="head">
      <select
        class="input"
        value={active}
        onchange={(e) => (app.settings.stat = e.currentTarget.value as StatView)}
        aria-label="Stat to show"
      >
        {#each options as o (o.id)}
          <option value={o.id} disabled={o.disabled}>{o.label}{o.disabled ? ' (needs 2+ activities)' : ''}</option>
        {/each}
      </select>
      <Legend />
    </div>
    <div class="body" style:--chart-h="{CHART_HEIGHT}px">
      {#if active === 'splits'}
        <SplitsTable />
      {:else if spec}
        <Chart
          title={spec.title}
          unit={spec.unit}
          x={view.x}
          series={spec.series}
          yFormat={spec.yFormat}
          xFormat={view.xFormat}
          height={CHART_HEIGHT}
          invert={spec.invert}
          zeroLine={spec.zeroLine}
          timeTicks={spec.timeTicks}
          markers={markersFor(spec.series)}
          onhover={hover}
          onclick={seek}
        />
        <p class="muted foot">Hover to see everyone at that point on the map · click to jump the replay there</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px 8px;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  /* Fixed height so switching views never resizes the map above. */
  .body {
    height: calc(var(--chart-h) + 44px);
    overflow-y: auto;
  }
  .foot {
    font-size: 12px;
    margin: 2px 4px 0;
  }
</style>
