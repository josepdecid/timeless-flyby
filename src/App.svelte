<script lang="ts">
  import ChartsPanel from './components/ChartsPanel.svelte';
  import Icon from './components/Icon.svelte';
  import MapView from './components/MapView.svelte';
  import Notices from './components/Notices.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import StravaLink from './components/StravaLink.svelte';
  import TrackList from './components/TrackList.svelte';
  import Welcome from './components/Welcome.svelte';
  import { MAX_TRACKS } from './lib/colors';
  import { ACCEPTED_EXTENSIONS } from './lib/parse';
  import { app, type Theme } from './lib/state.svelte';

  let fileInput: HTMLInputElement;
  let dragDepth = $state(0);

  function browse() {
    fileInput.click();
  }

  function accept(files: FileList | null | undefined) {
    if (!files?.length) return;
    const list = Array.from(files);
    const ok = list.filter((f) => ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)));
    for (const f of list) if (!ok.includes(f)) app.notify('error', `${f.name}: only GPX, TCX and FIT files are supported.`);
    if (ok.length) app.addFiles(ok);
  }

  function hasFiles(e: DragEvent) {
    return e.dataTransfer?.types.includes('Files') ?? false;
  }

  const THEMES: Theme[] = ['system', 'light', 'dark'];
  const themeIcon = $derived(app.settings.theme === 'system' ? 'auto' : app.settings.theme === 'light' ? 'sun' : 'moon');
  function cycleTheme() {
    app.settings.theme = THEMES[(THEMES.indexOf(app.settings.theme) + 1) % THEMES.length];
  }
</script>

<svelte:window
  ondragenter={(e) => {
    if (hasFiles(e)) dragDepth++;
  }}
  ondragleave={(e) => {
    if (hasFiles(e)) dragDepth = Math.max(0, dragDepth - 1);
  }}
  ondragover={(e) => {
    if (hasFiles(e)) e.preventDefault();
  }}
  ondrop={(e) => {
    e.preventDefault();
    dragDepth = 0;
    accept(e.dataTransfer?.files);
  }}
/>

<input
  bind:this={fileInput}
  type="file"
  multiple
  accept={ACCEPTED_EXTENSIONS.join(',')}
  class="sr-only"
  tabindex="-1"
  onchange={(e) => {
    accept(e.currentTarget.files);
    e.currentTarget.value = '';
  }}
/>

<div class="app" class:fit={app.activities.length > 0}>
  <header class="top">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 21c4-9 8-12 11-8s7 1 13-8" fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round" />
        <path d="M4 27c4-9 8-12 11-8s7 1 13-8" fill="none" stroke="#eb6834" stroke-width="3.2" stroke-linecap="round" />
      </svg>
      <h1 class="name">Timeless Flyby</h1>
    </div>
    <div class="tools">
      {#if app.activities.length}
        <button class="btn" onclick={browse} disabled={app.loading || app.activities.length >= MAX_TRACKS}>
          <Icon name="upload" /> <span class="hide-sm">Add files</span>
        </button>
      {/if}
      <div class="seg" role="group" aria-label="Units">
        <button aria-pressed={app.settings.units === 'metric'} onclick={() => (app.settings.units = 'metric')}>km</button>
        <button aria-pressed={app.settings.units === 'imperial'} onclick={() => (app.settings.units = 'imperial')}>mi</button>
      </div>
      <button class="btn ghost icon" onclick={cycleTheme} aria-label="Theme: {app.settings.theme}" title="Theme: {app.settings.theme}">
        <Icon name={themeIcon} />
      </button>
    </div>
  </header>

  {#if app.activities.length === 0}
    <main class="empty">
      <Welcome onbrowse={browse} />
    </main>
  {:else}
    <main class="layout">
      <aside class="side">
        <section>
          <h2>Activities <span class="muted">{app.activities.length}/{MAX_TRACKS}</span></h2>
          <TrackList />
          {#if app.activities.length < MAX_TRACKS}
            <button class="add" onclick={browse} disabled={app.loading}>
              {app.loading ? 'Reading…' : '+ Drop or add more files'}
            </button>
            <StravaLink compact />
          {/if}
        </section>
        <section>
          <h2>Comparison</h2>
          <SettingsPanel />
        </section>
      </aside>

      <div class="content">
        {#if app.comparison}
          <div class="mapcell">
            <MapView />
          </div>
          <ChartsPanel />
        {:else}
          <div class="card nothing">
            <p>All activities are excluded. Turn one back on with the <Icon name="eye" size={14} /> button to compare.</p>
          </div>
        {/if}
      </div>
    </main>
  {/if}
</div>

{#if dragDepth > 0}
  <div class="dropzone" aria-hidden="true">
    <div class="dropbox">
      <Icon name="upload" size={32} />
      <strong>Drop to add activities</strong>
    </div>
  </div>
{/if}

<Notices />

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* With activities loaded, the map and chart fit the viewport; only the sidebar scrolls. */
  .app.fit {
    height: 100vh;
    height: 100dvh;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand .name {
    margin: 0;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .empty {
    flex: 1;
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 16px;
    padding: 16px;
    min-height: 0;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
  }
  h2 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-2);
    margin: 0 0 8px;
    font-weight: 600;
  }
  .add {
    width: 100%;
    margin-top: 8px;
    padding: 10px;
    border: 1.5px dashed var(--border-strong);
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    font-size: 13px;
  }
  .add:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
  }
  .mapcell {
    flex: 1;
    min-height: 320px;
  }
  .nothing {
    padding: 24px;
  }
  .dropzone {
    position: fixed;
    inset: 0;
    z-index: 3000;
    background: color-mix(in srgb, var(--page) 70%, transparent);
    backdrop-filter: blur(2px);
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .dropbox {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 56px;
    border: 2px dashed var(--accent);
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .dropbox :global(svg) {
    color: var(--accent);
  }
  @media (max-width: 900px) {
    .app.fit {
      height: auto;
    }
    .layout {
      grid-template-columns: 1fr;
      padding: 12px 16px;
    }
    .side {
      position: static;
      max-height: none;
      order: 2;
    }
    .content {
      order: 1;
    }
    .mapcell {
      flex: none;
      height: 60vh;
    }
  }
  @media (max-width: 520px) {
    .hide-sm {
      display: none;
    }
  }
</style>
