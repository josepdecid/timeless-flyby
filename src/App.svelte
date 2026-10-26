<script lang="ts">
  import ChartsPanel from './components/ChartsPanel.svelte';
  import Icon from './components/Icon.svelte';
  import MapView from './components/MapView.svelte';
  import Notices from './components/Notices.svelte';
  import ReplayBar from './components/ReplayBar.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import SplitsTable from './components/SplitsTable.svelte';
  import TrackList from './components/TrackList.svelte';
  import Welcome from './components/Welcome.svelte';
  import { MAX_TRACKS } from './lib/colors';
  import { ACCEPTED_EXTENSIONS } from './lib/parse';
  import { app, type Tab, type Theme } from './lib/state.svelte';

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

  const TABS: { id: Tab; label: string }[] = [
    { id: 'gap', label: 'Gap' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'splits', label: 'Splits' },
  ];
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

<div class="app">
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
          <ReplayBar />
          <div class="tabs card">
            <div class="tabbar" role="tablist">
              {#each TABS as t (t.id)}
                <button
                  role="tab"
                  aria-selected={app.settings.tab === t.id}
                  class:active={app.settings.tab === t.id}
                  onclick={() => (app.settings.tab = t.id)}>{t.label}</button
                >
              {/each}
            </div>
            <div class="tabpanel" role="tabpanel">
              {#if app.settings.tab === 'splits'}
                <SplitsTable />
              {:else}
                <ChartsPanel mode={app.settings.tab} />
              {/if}
            </div>
          </div>
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
    align-items: start;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 69px;
    max-height: calc(100vh - 85px);
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
  }
  .mapcell {
    height: clamp(340px, 52vh, 640px);
  }
  .tabs {
    padding: 0 12px 16px;
  }
  .tabbar {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;
  }
  .tabbar button {
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    padding: 10px 12px 8px;
    color: var(--text-2);
    font-weight: 600;
    margin-bottom: -1px;
  }
  .tabbar button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
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
  }
  @media (max-width: 520px) {
    .hide-sm {
      display: none;
    }
    .mapcell {
      height: 60vh;
    }
  }
</style>
