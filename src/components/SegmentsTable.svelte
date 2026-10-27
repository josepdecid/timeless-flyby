<script lang="ts">
  import { segmentStats, type SegmentStat } from '../lib/analysis';
  import { distanceUnit, distanceValue, fmtDistance, fmtDuration, fmtGap } from '../lib/format';
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import Icon from './Icon.svelte';

  const cmp = $derived(app.comparison);
  const units = $derived(app.settings.units);
  const unitM = $derived(units === 'imperial' ? 1609.344 : 1000);

  /** Every saved segment, with its times when it lies on the compared section. */
  const rows = $derived.by(() => {
    if (!cmp) return [];
    const placed = app.placedSegments;
    const stats = segmentStats(cmp, placed.flatMap((p) => (p.range ? [p.range] : [])));
    let i = 0;
    return placed.map((p) => ({ segment: p.segment, stat: p.range ? stats[i++] : (null as SegmentStat | null) }));
  });

  function speedText(seconds: number | null, metres: number): string {
    if (seconds == null || seconds <= 0) return '–';
    return view.speed.label(view.speed.value(metres / seconds));
  }

  /** Distance input value in km / mi. */
  const inUnits = (m: number) => String(+distanceValue(m, units).toFixed(3));

  function add() {
    if (!cmp) return;
    // Start where the furthest segment ends, so repeated adds tile the route.
    const ends = rows.flatMap((r) => (r.stat ? [r.stat.to] : []));
    let from = ends.length ? Math.max(...ends) : 0;
    if (from > cmp.length - 10) from = 0;
    app.addSegment(from, Math.min(cmp.length, from + unitM));
  }

  function setEnd(e: Event & { currentTarget: HTMLInputElement }, id: string, stat: SegmentStat, which: 'from' | 'to') {
    const input = e.currentTarget;
    const x = input.valueAsNumber * unitM;
    if (cmp && Number.isFinite(x)) {
      const v = Math.min(cmp.length, Math.max(0, x));
      const from = which === 'from' ? v : stat.from;
      const to = which === 'to' ? v : stat.to;
      if (to - from >= 5) {
        app.moveSegment(id, from, to);
        return;
      }
    }
    input.value = inUnits(stat[which]);
  }

  function rename(e: Event & { currentTarget: HTMLInputElement }, id: string, current: string) {
    const name = e.currentTarget.value.trim();
    if (name) app.renameSegment(id, name);
    else e.currentTarget.value = current;
  }

  function useOnMap() {
    app.settings.segmentMode = 'custom';
    if (app.settings.mapColorMode === 'tracks' && (cmp?.tracks.length ?? 0) > 1) app.settings.mapColorMode = 'gain';
  }
</script>

{#if cmp}
  <div class="wrap">
    <div class="toolbar">
      <button class="btn" onclick={add}>+ Add segment</button>
      {#if app.settings.segmentMode !== 'custom' && cmp.tracks.length > 1}
        <button class="btn ghost" onclick={useOnMap} disabled={!app.segments.length}>Colour the map by these</button>
      {/if}
      <span class="muted">
        Select a segment to show it on the map and drag its ends · Δ is relative to the reference ·
        <strong class="secondary">bold</strong> = fastest
      </span>
    </div>
    {#if rows.length}
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="left" colspan="2">Segment</th>
              <th class="left">From · to ({distanceUnit(units)})</th>
              {#each cmp.tracks as tr (tr.activity.id)}
                <th colspan="2" class="left trackhead">
                  <span class="swatch line" style:background={view.colors.get(tr.activity.id)}></span>
                  <span class="name">{view.names.get(tr.activity.id)}</span>
                </th>
              {/each}
              <th></th>
            </tr>
            <tr class="sub">
              <th colspan="2"></th>
              <th class="left muted">length</th>
              {#each cmp.tracks as tr, k (tr.activity.id)}
                <th class="muted">time · {view.speed.unit}</th>
                <th class="muted">{k === 0 ? '' : 'Δ'}</th>
              {/each}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as { segment, stat } (segment.id)}
              {@const selected = app.selectedSegment === segment.id}
              <tr class:selected>
                <td class="pick">
                  <button
                    class="btn ghost icon"
                    aria-pressed={selected}
                    disabled={!stat}
                    onclick={() => (app.selectedSegment = selected ? null : segment.id)}
                    aria-label={selected ? `Hide ${segment.name} on the map` : `Show ${segment.name} on the map`}
                    title={selected ? 'Hide on the map' : 'Show on the map'}
                  >
                    <Icon name="crosshair" size={14} />
                  </button>
                </td>
                <td class="left">
                  <input
                    class="input name-input"
                    value={segment.name}
                    onfocus={() => stat && (app.selectedSegment = segment.id)}
                    onchange={(e) => rename(e, segment.id, segment.name)}
                    aria-label="Segment name"
                  />
                </td>
                {#if stat}
                  <td class="left num">
                    <input
                      class="input dist num"
                      type="number"
                      step="0.01"
                      min="0"
                      value={inUnits(stat.from)}
                      onfocus={() => (app.selectedSegment = segment.id)}
                      onchange={(e) => setEnd(e, segment.id, stat, 'from')}
                      aria-label="{segment.name} start, {distanceUnit(units)} into the section"
                    />
                    <input
                      class="input dist num"
                      type="number"
                      step="0.01"
                      min="0"
                      value={inUnits(stat.to)}
                      onfocus={() => (app.selectedSegment = segment.id)}
                      onchange={(e) => setEnd(e, segment.id, stat, 'to')}
                      aria-label="{segment.name} end, {distanceUnit(units)} into the section"
                    />
                    <span class="muted">{fmtDistance(stat.to - stat.from, units)}</span>
                  </td>
                  {#each cmp.tracks as _tr, k (k)}
                    {@const t = stat.times[k]}
                    {@const refT = stat.times[0]}
                    <td class="num" class:best={stat.fastest === k && cmp.tracks.length > 1}>
                      {t == null ? '–' : fmtDuration(t)}
                      <span class="muted"> · {speedText(t, stat.to - stat.from)}</span>
                    </td>
                    <td class="num">
                      {#if k > 0 && t != null && refT != null}
                        {@const d = t - refT}
                        <span class:faster={d < -0.5} class:slower={d > 0.5}>{fmtGap(d)}</span>
                      {/if}
                    </td>
                  {/each}
                {:else}
                  <td class="left muted" colspan={1 + cmp.tracks.length * 2}>Not on the compared section</td>
                {/if}
                <td>
                  <button
                    class="btn ghost icon del"
                    onclick={() => app.removeSegment(segment.id)}
                    aria-label="Delete {segment.name}"
                    title="Delete segment"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="muted empty">
        No segments yet. Add one, then type its start and end or drag them along the route on the map.
      </p>
    {/if}
    <p class="muted foot">Saved in this browser, and kept when you load other activities over the same road.</p>
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
  .toolbar .btn {
    height: 30px;
    font-size: 13px;
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
  tbody tr.selected {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  td.pick {
    padding-right: 0;
    width: 1px;
  }
  .icon[aria-pressed='true'] {
    color: var(--accent);
  }
  .input {
    height: 28px;
    font-size: 13px;
  }
  .name-input {
    width: 160px;
  }
  .dist {
    width: 76px;
    text-align: right;
  }
  .del {
    color: var(--text-2);
  }
  .del:hover {
    color: var(--critical);
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
  .empty {
    margin: 12px 4px;
    font-size: 13px;
  }
  .foot {
    font-size: 12px;
    margin: 0 4px;
  }
</style>
