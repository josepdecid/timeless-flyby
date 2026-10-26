import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Relative base so dist/ works from any sub-path (GitHub Pages, S3, etc.)
  base: './',
  plugins: [svelte()],
});
