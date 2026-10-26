<script lang="ts">
  import { fmtDistance } from '../lib/format';
  import { app } from '../lib/state.svelte';
</script>

<div class="settings">
  {#if app.comparison}
    <div class="field">
      <div class="label">
        <span>Compared section</span>
        {#if app.session.section}
          <button class="link" onclick={() => app.setSection(null)}>Reset to auto</button>
        {/if}
      </div>
      <div class="value num">
        {fmtDistance(app.comparison.length, app.settings.units)}
        <span class="muted">· {app.session.section ? 'manual' : 'auto-detected common route'}</span>
      </div>
      <p class="hint muted">Drag the Start and Finish flags on the map to trim it.</p>
    </div>
  {/if}

  <div class="field">
    <div class="label">Time</div>
    <div class="seg" role="group" aria-label="Time mode">
      <button aria-pressed={app.settings.timeMode === 'elapsed'} onclick={() => (app.settings.timeMode = 'elapsed')}>
        Elapsed
      </button>
      <button aria-pressed={app.settings.timeMode === 'moving'} onclick={() => (app.settings.timeMode = 'moving')}>
        Moving
      </button>
    </div>
    <p class="hint muted">
      {app.settings.timeMode === 'elapsed'
        ? 'Stops count against you, as in a race.'
        : 'Stopped time (traffic lights, breaks) is removed.'}
    </p>
  </div>

  <div class="field">
    <div class="label">Speed as</div>
    <div class="seg" role="group" aria-label="Speed display">
      <button aria-pressed={app.settings.speedMode === 'auto'} onclick={() => (app.settings.speedMode = 'auto')}>Auto</button>
      <button aria-pressed={app.settings.speedMode === 'pace'} onclick={() => (app.settings.speedMode = 'pace')}>Pace</button>
      <button aria-pressed={app.settings.speedMode === 'speed'} onclick={() => (app.settings.speedMode = 'speed')}>Speed</button>
    </div>
  </div>

  {#if app.persistFailed}
    <p class="hint warn">These activities are too large to keep after a reload; they'll stay until you close the tab.</p>
  {:else if app.activities.length}
    <p class="hint muted">Saved in this browser only. Nothing is uploaded.</p>
  {/if}
  {#if app.activities.length}
    <button class="btn ghost danger" onclick={() => app.clearAll()}>Remove all activities</button>
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
  .danger {
    align-self: flex-start;
    color: var(--text-2);
    padding: 0 6px;
    font-size: 13px;
  }
  .danger:hover {
    color: var(--critical);
  }
</style>
