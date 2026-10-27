<script lang="ts">
  import { LOCALES, t, type Locale } from '../lib/i18n.svelte';
  import { app, type Theme } from '../lib/state.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  // Same native-modal approach as ConfirmDialog: backdrop, focus trap and Esc for free.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  const THEMES: { value: Theme; label: string; icon: IconName }[] = $derived([
    { value: 'system', label: t.settings.system, icon: 'auto' },
    { value: 'light', label: t.settings.light, icon: 'sun' },
    { value: 'dark', label: t.settings.dark, icon: 'moon' },
  ]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  aria-labelledby="settings-title"
  onclose={() => (open = false)}
  onclick={(e) => {
    // A click on the backdrop lands on the dialog itself.
    if (e.target === dialog) open = false;
  }}
>
  <div class="body">
    <div class="head">
      <h2 id="settings-title">{t.common.settings}</h2>
      <button class="btn ghost icon" onclick={() => (open = false)} aria-label={t.common.close} title={t.common.close}>
        <Icon name="close" />
      </button>
    </div>

    <div class="field">
      <div class="label">{t.settings.units}</div>
      <div class="seg" role="group" aria-label={t.settings.units}>
        <button aria-pressed={app.settings.units === 'metric'} onclick={() => (app.settings.units = 'metric')}>km</button>
        <button aria-pressed={app.settings.units === 'imperial'} onclick={() => (app.settings.units = 'imperial')}>mi</button>
      </div>
    </div>

    <div class="field">
      <div class="label">{t.settings.theme}</div>
      <div class="seg" role="group" aria-label={t.settings.theme}>
        {#each THEMES as t (t.value)}
          <button aria-pressed={app.settings.theme === t.value} onclick={() => (app.settings.theme = t.value)}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="field">
      <label class="label" for="settings-language">{t.settings.language}</label>
      <select id="settings-language" class="input" bind:value={app.settings.language}>
        {#each Object.entries(LOCALES) as [code, name] (code)}
          <option value={code as Locale} lang={code}>{name}</option>
        {/each}
      </select>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(360px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 14px 16px 20px 20px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .head .btn {
    color: var(--muted);
  }
  .head .btn:hover {
    color: var(--text);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-weight: 600;
    font-size: 13px;
  }
  .seg {
    align-self: flex-start;
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
</style>
