<script lang="ts">
  import { parseStravaLink, stravaGpxExportUrl } from '../lib/strava';
  import Icon from './Icon.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  let value = $state('');
  const result = $derived(value.trim() ? parseStravaLink(value) : null);
</script>

<div class="strava" class:compact>
  <label class="label" for="strava-link-{compact ? 'side' : 'main'}">Have a Strava link?</label>
  <div class="row">
    <input
      id="strava-link-{compact ? 'side' : 'main'}"
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
  {:else}
    <p class="hint muted">
      Strava doesn't allow other sites to download activity files, so this can't load it directly. Paste the link to get
      a one-click GPX download from Strava (you need to be logged in there), then drop the file here.
    </p>
  {/if}
</div>

<style>
  .strava {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .label {
    font-weight: 600;
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
