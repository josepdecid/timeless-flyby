<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { app } from '../lib/state.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="notices" aria-live="polite">
  {#each app.notices as n (n.id)}
    <div class="notice card" class:error={n.kind === 'error'}>
      {#if n.kind === 'error'}<Icon name="warn" />{/if}
      <span>{n.text}</span>
      <button class="btn ghost icon" onclick={() => app.dismiss(n.id)} aria-label={t.common.dismiss}><Icon name="close" size={14} /></button>
    </div>
  {/each}
</div>

<style>
  .notices {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(520px, calc(100% - 32px));
  }
  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 12px;
    box-shadow: var(--shadow);
    font-size: 13px;
  }
  .notice span {
    flex: 1;
  }
  .error :global(svg:first-child) {
    color: var(--critical);
    flex: none;
  }
  .btn.icon {
    width: 26px;
    height: 26px;
  }
</style>
