<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { fmtDuration } from '../lib/format';
  import { app } from '../lib/state.svelte';
  import Icon from './Icon.svelte';

  const SPEEDS = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600];

  const max = $derived(app.comparison?.maxDuration ?? 0);
  // "Auto" picks a speed that replays the whole thing in about a minute.
  const autoSpeed = $derived(SPEEDS.find((s) => max / s <= 75) ?? SPEEDS[SPEEDS.length - 1]);
  const speed = $derived(app.settings.replaySpeed || autoSpeed);

  let raf = 0;
  let last = 0;

  function frame(now: number) {
    const dt = (now - last) / 1000;
    last = now;
    const next = app.clock + dt * speed;
    if (next >= max) {
      app.clock = max;
      app.playing = false;
      return;
    }
    app.clock = next;
    raf = requestAnimationFrame(frame);
  }

  $effect(() => {
    if (app.playing) {
      // Only (re)start on play/pause; reading the clock here would restart every frame.
      untrack(() => {
        if (app.clock >= max) app.clock = 0;
      });
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    return () => cancelAnimationFrame(raf);
  });

  onDestroy(() => cancelAnimationFrame(raf));

  function toggle() {
    app.playing = !app.playing;
  }

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (!app.comparison) return;
    if (e.code === 'Space') {
      e.preventDefault();
      toggle();
    } else if (e.code === 'ArrowRight') {
      app.clock = Math.min(max, app.clock + speed * 2);
    } else if (e.code === 'ArrowLeft') {
      app.clock = Math.max(0, app.clock - speed * 2);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if app.comparison}
  <div class="bar card">
    <button class="btn primary icon" onclick={toggle} aria-label={app.playing ? 'Pause replay' : 'Play replay'} title="Space">
      <Icon name={app.playing ? 'pause' : 'play'} />
    </button>
    <button
      class="btn ghost icon"
      onclick={() => {
        app.playing = false;
        app.clock = 0;
      }}
      aria-label="Back to start"
      disabled={app.clock === 0}
    >
      <Icon name="restart" />
    </button>
    <span class="clock num"><strong>{fmtDuration(app.clock)}</strong><span class="muted"> / {fmtDuration(max)}</span></span>
    <input
      class="scrub"
      type="range"
      min="0"
      max={max}
      step="1"
      bind:value={app.clock}
      oninput={() => (app.playing = false)}
      aria-label="Replay position"
    />
    <label class="opt">
      <span class="sr-only">Replay speed</span>
      <select class="input" bind:value={app.settings.replaySpeed}>
        <option value={0}>Auto ({autoSpeed}×)</option>
        {#each SPEEDS as s (s)}
          <option value={s}>{s}×</option>
        {/each}
      </select>
    </label>
    <label class="opt check">
      <input type="checkbox" bind:checked={app.settings.follow} />
      <span>Follow</span>
    </label>
  </div>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    flex-wrap: wrap;
  }
  .clock {
    min-width: 120px;
    font-size: 13px;
  }
  .scrub {
    flex: 1 1 200px;
    accent-color: var(--accent);
    min-width: 140px;
  }
  .opt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .check {
    color: var(--text-2);
    cursor: pointer;
  }
  .check input {
    accent-color: var(--accent);
  }
</style>
