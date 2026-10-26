<script lang="ts">
  import { computeSplits } from '../lib/analysis';
  import { fmtDistance, fmtDuration, fmtGap } from '../lib/format';
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';

  const cmp = $derived(app.comparison);
  const splits = $derived(cmp ? computeSplits(cmp, app.splitLength) : []);
  const units = $derived(app.settings.units);

  function speedText(seconds: number | null, metres: number): string {
    if (seconds == null || seconds <= 0) return '–';
    const v = view.speed.value(metres / seconds);
    return `${view.speed.label(v)}`;
  }

  const options = $derived(
    units === 'imperial'
      ? [
          [0, 'Auto'],
          [402.336, '¼ mi'],
          [804.672, '½ mi'],
          [1609.344, '1 mi'],
          [8046.72, '5 mi'],
          [16093.44, '10 mi'],
        ]
      : [
          [0, 'Auto'],
          [200, '200 m'],
          [400, '400 m'],
          [500, '500 m'],
          [1000, '1 km'],
          [5000, '5 km'],
          [10000, '10 km'],
        ],
  );
</script>

{#if cmp}
  <div class="wrap">
    <div class="toolbar">
      <label>
        <span class="secondary">Split length</span>
        <select class="input" bind:value={app.settings.splitLength}>
          {#each options as [v, label] (v)}
            <option value={v}>{label}</option>
          {/each}
        </select>
      </label>
      <span class="muted">
        Split times along the reference route · Δ is relative to the reference · <strong class="secondary">bold</strong> = fastest
        split
      </span>
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="left">Split</th>
            {#each cmp.tracks as tr (tr.activity.id)}
              <th colspan="2" class="left trackhead">
                <span class="swatch line" style:background={view.colors.get(tr.activity.id)}></span>
                <span class="name">{view.names.get(tr.activity.id)}</span>
              </th>
            {/each}
          </tr>
          <tr class="sub">
            <th class="left muted">to</th>
            {#each cmp.tracks as tr, k (tr.activity.id)}
              <th class="muted">time · {view.speed.unit}</th>
              <th class="muted">{k === 0 ? 'cumulative' : 'Δ split · total'}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each splits as sp (sp.index)}
            <tr>
              <td class="left num">{fmtDistance(sp.to, units)}</td>
              {#each cmp.tracks as _tr, k (k)}
                {@const t = sp.times[k]}
                {@const refT = sp.times[0]}
                <td class="num" class:best={sp.fastest === k && cmp.tracks.length > 1}>
                  {t == null ? '–' : fmtDuration(t)}
                  <span class="muted"> · {speedText(t, sp.to - sp.from)}</span>
                </td>
                <td class="num">
                  {#if k === 0}
                    <span class="secondary">{sp.cumulative[0] == null ? '–' : fmtDuration(sp.cumulative[0])}</span>
                  {:else if t != null && refT != null}
                    {@const d = t - refT}
                    {@const tot = sp.cumulative[k]! - sp.cumulative[0]!}
                    <span class:faster={d < -0.5} class:slower={d > 0.5}>{fmtGap(d)}</span>
                    <span class="muted"> · {fmtGap(tot)}</span>
                  {:else}
                    <span class="muted">–</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td class="left">Total</td>
            {#each cmp.tracks as tr, k (tr.activity.id)}
              <td class="num">
                {tr.aligned.finished ? fmtDuration(tr.duration) : 'DNF'}
                <span class="muted"> · {tr.aligned.finished ? speedText(tr.duration, cmp.length) : '–'}</span>
              </td>
              <td class="num">
                {#if k > 0 && tr.aligned.finished && cmp.tracks[0].aligned.finished}
                  {@const d = tr.duration - cmp.tracks[0].duration}
                  <span class:faster={d < -0.5} class:slower={d > 0.5}>{fmtGap(d)}</span>
                {/if}
              </td>
            {/each}
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
{/if}

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    font-size: 13px;
  }
  .toolbar label {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
    white-space: nowrap;
  }
  th,
  td {
    padding: 6px 10px;
    text-align: right;
    border-bottom: 1px solid var(--grid);
  }
  .left {
    text-align: left;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--surface-2);
    font-weight: 600;
  }
  thead tr.sub th {
    font-weight: 500;
    font-size: 12px;
  }
  .trackhead {
    border-left: 1px solid var(--grid);
  }
  .trackhead .name {
    display: inline-block;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    margin-left: 4px;
  }
  tbody tr:hover {
    background: var(--surface-2);
  }
  td.best {
    font-weight: 700;
  }
  .faster {
    color: var(--good);
    font-weight: 600;
  }
  .slower {
    color: var(--bad);
    font-weight: 600;
  }
  tfoot td {
    font-weight: 600;
    border-bottom: 0;
    background: var(--surface-2);
  }
</style>
