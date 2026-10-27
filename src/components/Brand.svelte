<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import Icon from './Icon.svelte';
  import SettingsDialog from './SettingsDialog.svelte';

  const SUPPORT_URL = 'https://buymeacoffee.com/josepdecid';

  let settingsOpen = $state(false);
</script>

<div class="brand">
  <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M4 21c4-9 8-12 11-8s7 1 13-8" fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round" />
    <path d="M4 27c4-9 8-12 11-8s7 1 13-8" fill="none" stroke="#eb6834" stroke-width="3.2" stroke-linecap="round" />
  </svg>
  <h1 class="name">Timeless Flyby</h1>
  <a
    class="btn ghost icon support"
    href={SUPPORT_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={t.common.support}
    title={t.common.support}
  >
    <Icon name="heart" />
  </a>
  <button class="btn ghost icon" onclick={() => (settingsOpen = true)} aria-label={t.common.settings} title={t.common.settings}>
    <Icon name="settings" />
  </button>
</div>

<SettingsDialog bind:open={settingsOpen} />

<style>
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name {
    margin: 0;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .btn {
    width: 28px;
    height: 28px;
    color: var(--muted);
  }
  .btn:hover {
    color: var(--text);
  }
  .support {
    margin-left: auto;
  }
  .support:hover {
    color: #e5484d;
  }
</style>
