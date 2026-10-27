<script lang="ts">
  import { MAX_TRACKS } from '../lib/colors';
  import { t } from '../lib/i18n.svelte';
  import { app } from '../lib/state.svelte';
  import Brand from './Brand.svelte';
  import Icon from './Icon.svelte';
  import StravaLink from './StravaLink.svelte';

  let { onbrowse }: { onbrowse: () => void } = $props();
</script>

<section class="welcome">
  <div class="inner">
    <div class="brand-wrap">
      <Brand />
    </div>
    <h2>{t.welcome.tagline}</h2>
    <p class="secondary lead">{t.welcome.lead}</p>
    <button class="drop" onclick={onbrowse}>
      <Icon name="upload" size={28} />
      <strong>{t.welcome.drop}</strong>
      <span class="muted">{t.welcome.browse(MAX_TRACKS)}</span>
    </button>
    <div class="strava-wrap">
      <StravaLink />
    </div>
    <div class="alt">
      <button class="btn" onclick={() => app.loadSamples()} disabled={app.loading}>{t.welcome.samples}</button>
      <span class="muted">{t.welcome.privacy}</span>
    </div>
    <ul class="features">
      {#each t.welcome.features as [title, text] (title)}
        <li><strong>{title}</strong><span class="muted">{text}</span></li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .welcome {
    display: grid;
    place-items: center;
    padding: 32px 16px;
    min-height: 100%;
  }
  .inner {
    max-width: 640px;
    width: 100%;
  }
  .brand-wrap {
    margin-bottom: 28px;
  }
  h2 {
    font-size: 26px;
    line-height: 1.2;
    margin: 0 0 10px;
    letter-spacing: -0.01em;
  }
  .lead {
    font-size: 15px;
    margin: 0 0 20px;
  }
  .drop {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 36px 16px;
    border: 2px dashed var(--border-strong);
    border-radius: 14px;
    background: var(--surface);
    color: var(--text);
    font-size: 15px;
  }
  .drop:hover {
    border-color: var(--accent);
  }
  .drop :global(svg) {
    color: var(--accent);
  }
  .strava-wrap {
    margin-top: 14px;
  }
  .alt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin: 14px 0 28px;
    font-size: 13px;
  }
  .features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px 20px;
  }
  .features li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
</style>
