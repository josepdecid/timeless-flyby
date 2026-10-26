<script lang="ts" module>
  export interface ChartSeries {
    id: string;
    label: string;
    color: string;
    /** Values aligned with the shared x data. */
    values: (number | null)[];
  }
</script>

<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import { onDestroy, onMount } from 'svelte';
  import { app } from '../lib/state.svelte';

  let {
    title,
    unit = '',
    x,
    series,
    yFormat,
    xFormat,
    height = 180,
    invert = false,
    zeroLine = false,
    timeTicks = false,
    markers = [],
    onhover,
    onclick,
  }: {
    title: string;
    unit?: string;
    /** Distances in display units. */
    x: number[];
    series: ChartSeries[];
    yFormat: (v: number) => string;
    xFormat: (v: number) => string;
    height?: number;
    /** Draw higher values lower (pace: lower is faster, so faster stays up). */
    invert?: boolean;
    zeroLine?: boolean;
    /** Values are seconds: pick ticks at whole seconds/minutes. */
    timeTicks?: boolean;
    /** Replay position per series, in x units (null = hide). */
    markers?: (number | null)[];
    onhover?: (idx: number | null) => void;
    onclick?: (idx: number) => void;
  } = $props();

  let el: HTMLDivElement;
  let plot: uPlot | null = null;
  let ro: ResizeObserver | null = null;
  // Read by the draw hook; kept outside $state so redraws don't re-create the plot.
  const live = { markers: [] as (number | null)[], series: [] as ChartSeries[], x: [] as number[] };

  const TIME_INCRS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];

  function css(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function valueAt(values: (number | null)[], xv: number): number | null {
    const xs = live.x;
    if (!xs.length) return null;
    let lo = 0;
    let hi = xs.length - 1;
    if (xv <= xs[0]) return values[0];
    if (xv >= xs[hi]) return values[hi];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= xv) lo = mid;
      else hi = mid;
    }
    const a = values[lo];
    const b = values[hi];
    if (a == null || b == null) return a ?? b;
    return a + ((b - a) * (xv - xs[lo])) / (xs[hi] - xs[lo]);
  }

  function tooltipPlugin(): uPlot.Plugin {
    let tip: HTMLDivElement;
    // Cursors are synced across charts; only the one under the pointer shows a tooltip.
    let inside = false;
    return {
      hooks: {
        init: (u) => {
          tip = document.createElement('div');
          tip.className = 'tf-chart-tip';
          tip.style.display = 'none';
          u.over.appendChild(tip);
          u.over.addEventListener('mouseenter', () => (inside = true));
          u.over.addEventListener('mouseleave', () => {
            inside = false;
            tip.style.display = 'none';
            onhover?.(null);
          });
          u.over.addEventListener('click', () => {
            if (u.cursor.idx != null) onclick?.(u.cursor.idx);
          });
        },
        setCursor: (u) => {
          const idx = u.cursor.idx;
          if (!inside) return;
          onhover?.(idx ?? null);
          if (idx == null || u.cursor.left == null || u.cursor.left < 0) {
            tip.style.display = 'none';
            return;
          }
          const rows = live.series
            .map((s, i) => {
              const v = u.data[i + 1][idx];
              return `<div class="row"><span class="swatch line" style="background:${s.color}"></span><span class="lbl">${escapeHtml(
                s.label,
              )}</span><span class="val num">${v == null ? '–' : yFormat(v as number)}</span></div>`;
            })
            .join('');
          tip.innerHTML = `<div class="hd num">${xFormat(u.data[0][idx] as number)}</div>${rows}`;
          tip.style.display = 'block';
          const left = u.cursor.left;
          const w = tip.offsetWidth;
          const flip = left + w + 16 > u.over.clientWidth;
          tip.style.left = `${flip ? left - w - 12 : left + 12}px`;
          tip.style.top = `${Math.max(0, Math.min((u.cursor.top ?? 0) - 20, u.over.clientHeight - tip.offsetHeight))}px`;
        },
      },
    };
  }

  function markersPlugin(): uPlot.Plugin {
    return {
      hooks: {
        draw: (u) => {
          const ctx = u.ctx;
          const ring = css('--surface');
          live.series.forEach((s, i) => {
            const mx = live.markers[i];
            if (mx == null) return;
            const yv = valueAt(s.values, mx);
            if (yv == null) return;
            const cx = u.valToPos(mx, 'x', true);
            const cy = u.valToPos(yv, 'y', true);
            const r = 5 * devicePixelRatio;
            ctx.beginPath();
            ctx.arc(cx, cy, r + 2 * devicePixelRatio, 0, Math.PI * 2);
            ctx.fillStyle = ring;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.fill();
          });
        },
      },
    };
  }

  function escapeHtml(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  }

  function build() {
    plot?.destroy();
    if (!el || !x.length) return;
    live.series = series;
    live.x = x;
    void app.dark; // re-read theme tokens
    const axis = {
      stroke: css('--muted'),
      grid: { stroke: css('--grid'), width: 1 },
      ticks: { stroke: css('--grid'), width: 1, size: 4 },
      font: '11px system-ui, sans-serif',
    };
    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      legend: { show: false },
      cursor: {
        sync: { key: 'tf-distance' },
        points: { size: 8, width: 2, stroke: css('--surface') } as uPlot.Cursor.Points,
        drag: { x: false, y: false },
        y: false,
      },
      scales: {
        x: { time: false },
        y: {
          dir: invert ? -1 : 1,
          range: (_u, min, max) => {
            if (min == null || max == null || !Number.isFinite(min)) return [0, 1];
            if (zeroLine) {
              const m = Math.max(Math.abs(min), Math.abs(max), 1);
              return [Math.min(min, 0) - m * 0.08, Math.max(max, 0) + m * 0.08];
            }
            const pad = (max - min) * 0.08 || 1;
            return [min - pad, max + pad];
          },
        },
      },
      axes: [
        { ...axis, values: (_u, ticks) => ticks.map((t) => xFormat(t)) },
        {
          ...axis,
          size: 56,
          values: (_u, ticks) => ticks.map((t) => yFormat(t)),
          ...(timeTicks ? { incrs: TIME_INCRS } : {}),
        },
      ],
      series: [
        {},
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          points: { show: false },
          spanGaps: false,
        })),
      ],
      plugins: [tooltipPlugin(), markersPlugin()],
      hooks: zeroLine
        ? {
            drawAxes: [
              (u: uPlot) => {
                const y0 = u.valToPos(0, 'y', true);
                const ctx = u.ctx;
                ctx.save();
                ctx.strokeStyle = css('--axis');
                ctx.lineWidth = devicePixelRatio;
                ctx.beginPath();
                ctx.moveTo(u.bbox.left, y0);
                ctx.lineTo(u.bbox.left + u.bbox.width, y0);
                ctx.stroke();
                ctx.restore();
              },
            ],
          }
        : {},
    };
    const data = [x, ...series.map((s) => s.values)] as uPlot.AlignedData;
    plot = new uPlot(opts, data, el);
  }

  onMount(() => {
    ro = new ResizeObserver(() => {
      if (plot && el.clientWidth > 0 && Math.abs(plot.width - el.clientWidth) > 1) {
        plot.setSize({ width: el.clientWidth, height });
      }
    });
    ro.observe(el);
  });

  $effect(() => {
    // Track everything that changes the plot's structure.
    void [x, series, height, invert, app.dark];
    build();
  });

  $effect(() => {
    live.markers = markers;
    plot?.redraw(false);
  });

  onDestroy(() => {
    ro?.disconnect();
    plot?.destroy();
  });
</script>

<figure class="chart">
  <figcaption>
    <span class="title">{title}</span>
    {#if unit}<span class="muted">{unit}</span>{/if}
  </figcaption>
  <div class="plot" bind:this={el}></div>
</figure>

<style>
  .chart {
    margin: 0;
    min-width: 0;
  }
  figcaption {
    display: flex;
    gap: 6px;
    align-items: baseline;
    margin: 0 0 4px 4px;
  }
  .title {
    font-weight: 600;
    font-size: 13px;
  }
  .plot {
    width: 100%;
    position: relative;
  }
  .plot :global(.tf-chart-tip) {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 12px;
    min-width: 150px;
  }
  .plot :global(.tf-chart-tip .hd) {
    color: var(--text-2);
    margin-bottom: 4px;
    font-weight: 600;
  }
  .plot :global(.tf-chart-tip .row) {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    gap: 6px;
    align-items: center;
    line-height: 1.6;
  }
  .plot :global(.tf-chart-tip .lbl) {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }
  .plot :global(.tf-chart-tip .val) {
    font-weight: 600;
  }
</style>
