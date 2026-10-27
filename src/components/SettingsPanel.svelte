<script lang="ts">
  import { fmtDistance } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import { app } from '../lib/state.svelte';
</script>

<div class="settings">
  {#if app.comparison}
    <div class="field">
      <div class="label">
        <span>{t.comparison.section}</span>
        {#if app.session.section}
          <button class="link" onclick={() => app.setSection(null)}>{t.comparison.resetAuto}</button>
        {/if}
      </div>
      <div class="value num">
        {fmtDistance(app.comparison.length, app.settings.units)}
        <span class="muted">· {app.session.section ? t.comparison.manual : t.comparison.autoDetected}</span>
      </div>
      <p class="hint muted">{t.comparison.flagsHint}</p>
    </div>
  {/if}

  <div class="field">
    <div class="label">{t.comparison.time}</div>
    <div class="seg" role="group" aria-label={t.comparison.timeAria}>
      <button aria-pressed={app.settings.timeMode === 'elapsed'} onclick={() => (app.settings.timeMode = 'elapsed')}>
        {t.comparison.elapsed}
      </button>
      <button aria-pressed={app.settings.timeMode === 'moving'} onclick={() => (app.settings.timeMode = 'moving')}>
        {t.comparison.moving}
      </button>
    </div>
    <p class="hint muted">
      {app.settings.timeMode === 'elapsed' ? t.comparison.elapsedHint : t.comparison.movingHint}
    </p>
  </div>

  <div class="field">
    <div class="label">{t.comparison.speedAs}</div>
    <div class="seg" role="group" aria-label={t.comparison.speedAria}>
      <button aria-pressed={app.settings.speedMode === 'auto'} onclick={() => (app.settings.speedMode = 'auto')}>{t.common.auto}</button>
      <button aria-pressed={app.settings.speedMode === 'pace'} onclick={() => (app.settings.speedMode = 'pace')}>{t.comparison.pace}</button>
      <button aria-pressed={app.settings.speedMode === 'speed'} onclick={() => (app.settings.speedMode = 'speed')}>{t.comparison.speed}</button>
    </div>
  </div>

  {#if app.persistFailed}
    <p class="hint warn">{t.comparison.tooLarge}</p>
  {:else if app.activities.length}
    <p class="hint muted">{t.comparison.saved}</p>
  {/if}
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    font-size: 13px;
  }
  .value {
    font-size: 15px;
    font-weight: 600;
  }
  .value .muted {
    font-weight: 400;
    font-size: 13px;
  }
  .hint {
    margin: 0;
    font-size: 12px;
  }
  .warn {
    color: var(--text-2);
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--accent);
    font-size: 12px;
    font-weight: 500;
  }
  .seg {
    align-self: flex-start;
  }
</style>
