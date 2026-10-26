<script lang="ts">
  import { app } from '../lib/state.svelte';
  import Icon from './Icon.svelte';

  let { onbrowse }: { onbrowse: () => void } = $props();
</script>

<section class="welcome">
  <div class="inner">
    <h2>Race your past self, or anyone else, on the same route.</h2>
    <p class="secondary lead">
      Drop two or more GPX, TCX or FIT files. Each one is aligned to the same start line and replayed as if everyone set off
      together, so you can see where you gained or lost time, even months apart.
    </p>
    <button class="drop" onclick={onbrowse}>
      <Icon name="upload" size={28} />
      <strong>Drop activity files here</strong>
      <span class="muted">or click to browse · .gpx .tcx .fit · up to 8</span>
    </button>
    <div class="alt">
      <button class="btn" onclick={() => app.loadSamples()} disabled={app.loading}>Try sample activities</button>
      <span class="muted">Your files are processed in this browser. Nothing is uploaded.</span>
    </div>
    <ul class="features">
      <li><strong>Replay</strong><span class="muted">Everyone starts together on the map, at any speed.</span></li>
      <li><strong>Gap chart</strong><span class="muted">Time ahead or behind at every point along the route.</span></li>
      <li><strong>Gain / loss map</strong><span class="muted">See which stretches were faster or slower.</span></li>
      <li><strong>Splits & metrics</strong><span class="muted">Splits, plus pace, elevation, HR, cadence and power overlays.</span></li>
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
