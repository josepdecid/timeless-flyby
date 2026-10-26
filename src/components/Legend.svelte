<script lang="ts">
  import { app } from '../lib/state.svelte';
  import { view } from '../lib/view.svelte';
</script>

{#if app.comparison && app.comparison.tracks.length > 1}
  <ul class="legend" aria-label="Legend">
    {#each app.comparison.tracks as tr (tr.activity.id)}
      <li>
        <span class="swatch line" style:background={view.colors.get(tr.activity.id)}></span>
        <span>{view.names.get(tr.activity.id)}</span>
        {#if tr.activity.id === app.comparison.refId}<span class="muted">· reference</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .legend {
    list-style: none;
    margin: 0;
    padding: 0 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 13px;
    color: var(--text-2);
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
