<script lang="ts">
  import { parseStravaLink, stravaGpxExportUrl } from '../lib/strava';
  import Icon from './Icon.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  let value = $state('');
  const result = $derived(value.trim() ? parseStravaLink(value) : null);
  const id = $derived(compact ? 'side' : 'main');
</script>

<div class="strava" class:compact>
  <div class="head">
    <label class="label" for="strava-link-{id}">Have a Strava link?</label>
    <button class="info" type="button" aria-label="Why a link?" aria-describedby="strava-why-{id}">
      <Icon name="info" size={14} />
    </button>
    <p class="tip" id="strava-why-{id}" role="tooltip">
      Strava doesn't allow other sites to download activity files, so this can't load it directly. Paste the link to get
      a one-click GPX download from Strava (you need to be logged in there), then drop the file here.
    </p>
  </div>
  <div class="row">
    <input
      id="strava-link-{id}"
      class="input"
      type="url"
      inputmode="url"
      placeholder="strava.com/activities/…"
      autocomplete="off"
      spellcheck="false"
      bind:value
    />
    {#if result?.kind === 'activity'}
      <a class="btn primary" href={stravaGpxExportUrl(result.id)} target="_blank" rel="noopener noreferrer" onclick={() => (value = '')}>
        <Icon name="download" /> GPX
      </a>
    {/if}
  </div>
  {#if result?.kind === 'short'}
    <p class="hint warn">App share links don't include the activity ID. Open it in a browser and paste the strava.com address instead.</p>
  {:else if result?.kind === 'invalid'}
    <p class="hint warn">That doesn't look like a Strava activity link.</p>
  {/if}
</div>

<style>
  .strava {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .label {
    font-weight: 600;
  }
  .info {
    display: grid;
    place-items: center;
    padding: 2px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: help;
  }
  .info:hover,
  .info:focus-visible {
    color: var(--text);
  }
  /* Shown on hover, keyboard focus, or tap (which focuses the button). */
  .tip {
    position: absolute;
    top: 24px;
    left: 0;
    right: 0;
    z-index: 20;
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text-2);
    font-size: 12px;
    line-height: 1.4;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.12s,
      visibility 0.12s;
  }
  .info:hover + .tip,
  .info:focus + .tip {
    opacity: 1;
    visibility: visible;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .input {
    flex: 1;
    min-width: 0;
  }
  .row .btn {
    text-decoration: none;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
  }
  .warn {
    color: var(--bad);
  }
  .compact {
    margin-top: 10px;
  }
</style>
