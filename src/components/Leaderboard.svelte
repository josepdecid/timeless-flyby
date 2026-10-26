<script lang="ts">
  import { fmtDistance } from '../lib/format';
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';

  let open = $state(true);
</script>

{#if app.comparison && view.standings.length > 1}
  <section class="board card" aria-label="Standings at the replay time">
    <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
      <span>Standings</span>
      <span class="muted">{open ? '−' : '+'}</span>
    </button>
    {#if open}
      <ol>
        {#each view.standings as row (row.tr.activity.id)}
          <li>
            <span class="rank num muted">{row.rank}</span>
            <span class="swatch" style:background={view.colors.get(row.tr.activity.id)}></span>
            <span class="name">{view.names.get(row.tr.activity.id)}</span>
            <span class="gap num">
              {#if row.rank === 1}
                <span class="secondary">{row.st.finished && row.tr.aligned.finished ? 'finished' : 'leader'}</span>
              {:else}
                {row.gap}
              {/if}
            </span>
            <span class="meta num muted">
              {fmtDistance(row.st.x, app.settings.units)}
              {#if row.speed != null && !row.st.finished && view.replayActive}
                · {view.speed.label(view.speed.value(row.speed))}{view.speed.unit}
              {/if}
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}

<style>
  .board {
    position: absolute;
    /* Below the map attribution line in the corner. */
    top: 26px;
    right: 10px;
    z-index: 500;
    width: 270px;
    max-width: calc(100% - 20px);
    box-shadow: var(--shadow);
    font-size: 13px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: 0;
    padding: 8px 10px;
    font-weight: 600;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0 10px 8px;
  }
  li {
    display: grid;
    grid-template-columns: 14px 12px 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 6px;
    align-items: center;
    padding: 4px 0;
    border-top: 1px solid var(--grid);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gap {
    font-weight: 600;
  }
  .meta {
    grid-column: 3 / 5;
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .board {
      width: 220px;
    }
  }
</style>
