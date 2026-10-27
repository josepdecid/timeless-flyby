<script lang="ts">
  import Brand from './components/Brand.svelte';
  import ChartsPanel from './components/ChartsPanel.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Icon from './components/Icon.svelte';
  import MapView from './components/MapView.svelte';
  import Notices from './components/Notices.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import StravaLink from './components/StravaLink.svelte';
  import TrackList from './components/TrackList.svelte';
  import Welcome from './components/Welcome.svelte';
  import { MAX_TRACKS } from './lib/colors';
  import { t } from './lib/i18n.svelte';
  import { ACCEPTED_EXTENSIONS } from './lib/parse';
  import { app, DEFAULT_CHART_HEIGHT } from './lib/state.svelte';

  let fileInput: HTMLInputElement;
  let dragDepth = $state(0);
  let confirmClear = $state(false);

  function browse() {
    fileInput.click();
  }

  function accept(files: FileList | null | undefined) {
    if (!files?.length) return;
    const list = Array.from(files);
    const ok = list.filter((f) => ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)));
    for (const f of list) if (!ok.includes(f)) app.notify('error', t.app.unsupportedFile(f.name));
    if (ok.length) app.addFiles(ok);
  }

  function hasFiles(e: DragEvent) {
    return e.dataTransfer?.types.includes('Files') ?? false;
  }

  // Map/chart divider. The map keeps at least MAP_MIN; the chart card at least CHART_MIN.
  const MAP_MIN = 240;
  const CHART_MIN = 220;
  const DIVIDER = 12;
  let content: HTMLDivElement | undefined = $state();
  let dragFrom: { y: number; h: number } | null = $state(null);

  function chartMax() {
    return Math.max(CHART_MIN, (content?.clientHeight ?? 0) - MAP_MIN - DIVIDER);
  }
  function setChartHeight(h: number) {
    app.settings.chartHeight = Math.round(Math.min(chartMax(), Math.max(CHART_MIN, h)));
  }
  function dragStart(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Start from what's on screen; a stale saved height may be capped by the viewport.
    const shown = Math.min(app.settings.chartHeight, chartMax());
    dragFrom = { y: e.clientY, h: shown };
  }
  function dragMove(e: PointerEvent) {
    if (dragFrom) setChartHeight(dragFrom.h + dragFrom.y - e.clientY);
  }
  function dragKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 80 : 20;
    const current = Math.min(app.settings.chartHeight, chartMax());
    if (e.key === 'ArrowUp') setChartHeight(current + step);
    else if (e.key === 'ArrowDown') setChartHeight(current - step);
    else if (e.key === 'Home') setChartHeight(chartMax());
    else if (e.key === 'End') setChartHeight(CHART_MIN);
    else return;
    e.preventDefault();
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
  {#if app.activities.length === 0}
    <main class="empty">
      <Welcome onbrowse={browse} />
    </main>
  {:else}
    <main class="layout">
      <div class="brandcell">
        <Brand />
      </div>
      <aside class="side">
        <section>
          <div class="sechead">
            <h2>{t.app.activities} <span class="muted">{app.activities.length}/{MAX_TRACKS}</span></h2>
            <button class="btn ghost danger" onclick={() => (confirmClear = true)}>{t.app.removeAll}</button>
          </div>
          <TrackList />
          {#if app.activities.length < MAX_TRACKS}
            <button class="add" onclick={browse} disabled={app.loading}>
              {app.loading ? t.app.reading : t.app.addMore}
            </button>
            <StravaLink compact />
          {/if}
        </section>
        <section>
          <h2>{t.app.comparison}</h2>
          <SettingsPanel />
        </section>
      </aside>

      <div class="content" class:dragging={!!dragFrom} bind:this={content} style:--map-min="{MAP_MIN + DIVIDER}px">
        {#if app.comparison}
          <div class="mapcell">
            <MapView />
          </div>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div
            class="divider"
            role="separator"
            aria-orientation="horizontal"
            aria-label={t.app.resizeAria}
            aria-valuenow={app.settings.chartHeight}
            aria-valuemin={CHART_MIN}
            title={t.app.resizeHint}
            tabindex="0"
            onpointerdown={dragStart}
            onpointermove={dragMove}
            onpointerup={() => (dragFrom = null)}
            onpointercancel={() => (dragFrom = null)}
            ondblclick={() => setChartHeight(DEFAULT_CHART_HEIGHT)}
            onkeydown={dragKey}
          ></div>
          <ChartsPanel />
        {:else}
          <div class="card nothing">
            <p>{t.app.allExcludedBefore} <Icon name="eye" size={14} /> {t.app.allExcludedAfter}</p>
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
      <strong>{t.app.dropToAdd}</strong>
    </div>
  </div>
{/if}

<ConfirmDialog bind:open={confirmClear} title={t.app.removeAllTitle} confirmLabel={t.app.removeAll} onconfirm={() => app.clearAll()}>
  <p>{t.app.removeAllBody(app.activities.length)}</p>
</ConfirmDialog>

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
  .empty {
    flex: 1;
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 16px;
    padding: 16px;
    min-height: 0;
  }
  /* The brand row tops the sidebar column but stays put while the activity list scrolls. */
  .brandcell {
    grid-column: 1;
    grid-row: 1;
  }
  .side {
    grid-column: 1;
    grid-row: 2;
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
  .sechead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .sechead h2 {
    margin: 0;
  }
  .danger {
    height: 26px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--critical);
  }
  .danger:hover {
    background: color-mix(in srgb, var(--critical) 10%, transparent);
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
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .content.dragging {
    cursor: row-resize;
    user-select: none;
  }
  .mapcell {
    flex: 1;
    min-height: 240px;
  }
  /* A slim grip line in a taller hit area between the map and the chart. */
  .divider {
    flex: none;
    height: 12px;
    cursor: row-resize;
    touch-action: none;
    display: grid;
    place-items: center;
    outline: none;
  }
  .divider::before {
    content: '';
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-strong);
    transition:
      background 0.15s,
      width 0.15s;
  }
  .divider:hover::before,
  .divider:focus-visible::before,
  .content.dragging .divider::before {
    width: 64px;
    background: var(--accent);
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
      grid-template-rows: none;
      padding: 12px 16px;
    }
    .brandcell,
    .side,
    .content {
      grid-column: auto;
      grid-row: auto;
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
    /* Stacked layout scrolls, so there's nothing to share; a fixed chart height instead. */
    .content {
      gap: 12px;
    }
    .divider {
      display: none;
    }
    .content :global(.panel:not(.full)) {
      height: 300px;
      max-height: none;
    }
  }
</style>
