<script lang="ts">
  import Chart, { type ChartSeries } from './Chart.svelte';
  import Legend from './Legend.svelte';
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import { distanceValue, elevationValue, fmtGap } from '../lib/format';
  import type { MetricKey } from '../lib/types';

  let { mode }: { mode: 'gap' | 'metrics' } = $props();

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

  const gapSeries = $derived(seriesFor('ahead'));
  const speedSeries = $derived(robust(seriesFor('speed', view.speed.value)));
  const eleSeries = $derived(seriesFor('ele', (v) => elevationValue(v, app.settings.units)));
  const hrSeries = $derived(seriesFor('hr'));
  const cadSeries = $derived(seriesFor('cad'));
  const pwrSeries = $derived(robust(seriesFor('pwr')));

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

  const speedLabel = $derived(view.speed.mode === 'pace' ? 'Pace' : 'Speed');
  const eleUnit = $derived(app.settings.units === 'imperial' ? 'ft' : 'm');
</script>

{#if cmp}
  <div class="panel">
    <Legend />
    {#if mode === 'gap'}
      {#if cmp.tracks.length < 2}
        <p class="muted hint">Add another activity to see where time was gained or lost.</p>
      {:else}
        <Chart
          title="Time ahead of the reference"
          unit="above zero = ahead, below = behind"
          x={view.x}
          series={gapSeries}
          yFormat={fmtGap}
          xFormat={view.xFormat}
          height={260}
          zeroLine
          timeTicks
          markers={markersFor(gapSeries)}
          onhover={hover}
          onclick={seek}
        />
      {/if}
      <Chart
        title={speedLabel}
        unit={view.speed.unit}
        x={view.x}
        series={speedSeries}
        yFormat={view.speed.label}
        xFormat={view.xFormat}
        height={170}
        invert={view.speed.mode === 'pace'}
        timeTicks={view.speed.mode === 'pace'}
        markers={markersFor(speedSeries)}
        onhover={hover}
        onclick={seek}
      />
    {:else}
      <Chart
        title={speedLabel}
        unit={view.speed.unit}
        x={view.x}
        series={speedSeries}
        yFormat={view.speed.label}
        xFormat={view.xFormat}
        height={170}
        invert={view.speed.mode === 'pace'}
        timeTicks={view.speed.mode === 'pace'}
        markers={markersFor(speedSeries)}
        onhover={hover}
        onclick={seek}
      />
      {#if eleSeries.length}
        <Chart
          title="Elevation"
          unit={eleUnit}
          x={view.x}
          series={eleSeries}
          yFormat={(v) => `${Math.round(v)}`}
          xFormat={view.xFormat}
          height={150}
          markers={markersFor(eleSeries)}
          onhover={hover}
          onclick={seek}
        />
      {/if}
      {#if hrSeries.length}
        <Chart
          title="Heart rate"
          unit="bpm"
          x={view.x}
          series={hrSeries}
          yFormat={(v) => `${Math.round(v)}`}
          xFormat={view.xFormat}
          height={150}
          markers={markersFor(hrSeries)}
          onhover={hover}
          onclick={seek}
        />
      {/if}
      {#if cadSeries.length}
        <Chart
          title="Cadence"
          unit="rpm / spm"
          x={view.x}
          series={cadSeries}
          yFormat={(v) => `${Math.round(v)}`}
          xFormat={view.xFormat}
          height={150}
          markers={markersFor(cadSeries)}
          onhover={hover}
          onclick={seek}
        />
      {/if}
      {#if pwrSeries.length}
        <Chart
          title="Power"
          unit="W"
          x={view.x}
          series={pwrSeries}
          yFormat={(v) => `${Math.round(v)}`}
          xFormat={view.xFormat}
          height={150}
          markers={markersFor(pwrSeries)}
          onhover={hover}
          onclick={seek}
        />
      {/if}
      {#if !eleSeries.length && !hrSeries.length && !cadSeries.length && !pwrSeries.length}
        <p class="muted hint">These files carry no elevation, heart rate, cadence or power data.</p>
      {/if}
    {/if}
    <p class="muted foot">Hover to see everyone at that point on the map · click to jump the replay there</p>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .hint {
    margin: 8px 4px;
  }
  .foot {
    font-size: 12px;
    margin: 0 4px;
  }
</style>
