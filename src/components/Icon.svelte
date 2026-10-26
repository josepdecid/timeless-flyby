<script lang="ts" module>
  const PATHS = {
    play: 'M7 4.5v15l12-7.5z',
    pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
    restart: 'M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
    upload: 'M12 3l5 5h-3v6h-4V8H7zM5 17h14v3H5z',
    download: 'M10 3h4v6h3l-5 5-5-5h3zM5 17h14v3H5z',
    close: 'M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z',
    edit: 'M4 17.2V20h2.8l8.3-8.3-2.8-2.8zM19.7 7.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.3 1.3 2.8 2.8z',
    eye: 'M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    eyeOff:
      'M3.3 2L2 3.3l3.1 3.1C3.4 7.8 2.2 9.8 1.5 12c1.2 2.6 5 7 10.5 7 1.8 0 3.4-.5 4.8-1.2l3.9 3.9 1.3-1.3zM12 16a4 4 0 0 1-3.9-4.9l1.6 1.6a2 2 0 0 0 2.6 2.6l1.6 1.6c-.6.3-1.2.4-1.9.4zm0-11c5.5 0 9.3 4.4 10.5 7-.5 1.2-1.5 2.6-2.8 3.9l-3.3-3.3a4 4 0 0 0-4.9-4.9L9.2 5.4C10.1 5.1 11 5 12 5z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5l1 3h-2zm0 20l-1-3h2zM2 12l3-1v2zm20 0l-3 1v-2zM4.9 4.9l2.8 1.4-1.4 1.4zm14.2 14.2l-2.8-1.4 1.4-1.4zM4.9 19.1l1.4-2.8 1.4 1.4zM19.1 4.9l-1.4 2.8-1.4-1.4z',
    moon: 'M14.5 2.5A9.5 9.5 0 1 0 21.5 15 7.5 7.5 0 0 1 14.5 2.5z',
    auto: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z',
    warn: 'M12 2L1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z',
    flag: 'M5 2h2v20H5zm3 1h11l-2.5 4L19 11H8z',
    crosshair: 'M11 2h2v4h-2zm0 16h2v4h-2zM2 11h4v2H2zm16 0h4v2h-4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    trash: 'M9 3h6l1 1h4v2H4V4h4zM6 8h12l-1 13H7z',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d={PATHS[name]} fill-rule="evenodd" />
</svg>
