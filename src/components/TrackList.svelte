<script lang="ts">
  import { fmtDateTime, fmtDistance, fmtDuration, fmtGap, sportLabel } from '../lib/format';
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
  import Icon from './Icon.svelte';

  let editing = $state<string | null>(null);

  const byId = $derived(new Map(app.comparison?.tracks.map((t) => [t.activity.id, t]) ?? []));
  const refTrack = $derived(app.comparison?.tracks[0]);

  function avgSpeed(id: string): string {
    const tr = byId.get(id);
    const cmp = app.comparison;
    if (!tr || !cmp || tr.duration <= 0) return '–';
    const covered = tr.aligned.reachedD - cmp.section.startD;
    return `${view.speed.label(view.speed.value(covered / tr.duration))}${view.speed.unit}`;
  }

  function commitName(id: string, value: string) {
    // Removing the input can fire a late blur after Enter/Escape already settled the edit.
    if (editing !== id) return;
    const a = app.activities.find((x) => x.id === id);
    if (a && value.trim()) a.name = value.trim();
    editing = null;
  }
</script>

<ul class="list">
  {#each app.activities as a (a.id)}
    {@const tr = byId.get(a.id)}
    {@const isRef = a.id === app.refId}
    <li class="item" class:excluded={!a.included}>
      <div class="row">
        <span class="swatch big" style:background={view.colors.get(a.id)}></span>
        <div class="title">
          {#if editing === a.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="input name-input"
              value={a.name}
              autofocus
              onblur={(e) => commitName(a.id, e.currentTarget.value)}
              onkeydown={(e) => {
                if (e.key === 'Enter') commitName(a.id, e.currentTarget.value);
                if (e.key === 'Escape') editing = null;
              }}
            />
          {:else}
            <button class="name" title="Rename" onclick={() => (editing = a.id)}>
              {a.name}
            </button>
          {/if}
          <div class="meta muted">{sportLabel(a.sport)} · {fmtDateTime(a.points[0].t)}</div>
        </div>
        <div class="actions">
          <button class="btn ghost icon" onclick={() => (editing = a.id)} aria-label="Rename {a.name}" title="Rename">
            <Icon name="edit" />
          </button>
          <button
            class="btn ghost icon"
            onclick={() => (a.included = !a.included)}
            aria-label={a.included ? 'Exclude from comparison' : 'Include in comparison'}
            title={a.included ? 'Exclude from comparison' : 'Include in comparison'}
          >
            <Icon name={a.included ? 'eye' : 'eyeOff'} />
          </button>
          <button class="btn ghost icon" onclick={() => app.remove(a.id)} aria-label="Remove {a.name}" title="Remove">
            <Icon name="close" />
          </button>
        </div>
      </div>

      {#if a.included}
        <div class="stats">
          <button
            class="ref-toggle"
            class:active={isRef}
            onclick={() => app.setReference(a.id)}
            aria-pressed={isRef}
            title={isRef ? 'This is the reference' : 'Use as reference'}
          >
            <Icon name="star" size={13} />
            {isRef ? 'Reference' : 'Set as ref'}
          </button>
          {#if tr}
            <span class="stat num" title="Time over the compared section">
              {tr.aligned.finished ? fmtDuration(tr.duration) : `DNF · ${fmtDistance(tr.aligned.reachedD - (app.comparison?.section.startD ?? 0), app.settings.units)}`}
            </span>
            <span class="stat num muted">{avgSpeed(a.id)}</span>
            {#if !isRef && refTrack && tr.aligned.finished && refTrack.aligned.finished}
              {@const d = tr.duration - refTrack.duration}
              <span class="stat num delta" class:faster={d < -0.5} class:slower={d > 0.5}>{fmtGap(d)}</span>
            {/if}
          {/if}
        </div>
        {#if tr && tr.aligned.passCount > 1}
          <label class="pass">
            <span class="muted">Passes the start {tr.aligned.passCount}×, using</span>
            <select
              class="input compact"
              value={tr.aligned.passUsed}
              onchange={(e) => (app.session.passes[a.id] = Number(e.currentTarget.value))}
            >
              {#each { length: tr.aligned.passCount } as _, i (i)}
                <option value={i}>pass {i + 1}</option>
              {/each}
            </select>
          </label>
        {/if}
        {#if tr && !isRef && tr.aligned.offRoute > 0.2}
          <p class="warn"><Icon name="warn" size={13} /> {Math.round(tr.aligned.offRoute * 100)}% of this track is off the reference route.</p>
        {/if}
      {/if}
    </li>
  {/each}
</ul>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 8px 8px 10px;
    background: var(--surface);
  }
  .item.excluded {
    opacity: 0.6;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .swatch.big {
    width: 12px;
    height: 12px;
    margin-top: 5px;
  }
  .title {
    flex: 1;
    min-width: 0;
  }
  .name {
    display: block;
    max-width: 100%;
    background: none;
    border: 0;
    padding: 0;
    font-weight: 600;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .name:hover {
    text-decoration: underline dotted;
  }
  .name-input {
    width: 100%;
    height: 26px;
  }
  .meta {
    font-size: 12px;
  }
  .actions {
    display: flex;
    margin: -4px -4px 0 0;
  }
  .actions .btn {
    width: 28px;
    height: 28px;
    color: var(--muted);
  }
  .actions .btn:hover {
    color: var(--text);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin: 6px 0 0 22px;
    font-size: 13px;
  }
  .ref-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 12px;
  }
  .ref-toggle:hover {
    color: var(--text);
  }
  .ref-toggle.active {
    background: var(--text);
    color: var(--surface);
    border-color: transparent;
  }
  .stat {
    font-weight: 600;
  }
  .stat.muted {
    font-weight: 400;
  }
  .faster {
    color: var(--good);
  }
  .slower {
    color: var(--bad);
  }
  .pass {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 6px 0 0 22px;
    font-size: 12px;
  }
  .input.compact {
    height: 24px;
    font-size: 12px;
    padding: 0 4px;
  }
  .warn {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 6px 0 0 22px;
    font-size: 12px;
    color: var(--text-2);
  }
  .warn :global(svg) {
    color: #fab219;
    flex: none;
  }
</style>
