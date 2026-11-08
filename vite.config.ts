import { defineConfig } from 'vite';

// Relative base so the build works from GitHub Pages subpaths and inside the Capacitor WebView.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: {
    // Shown on screen so you can confirm which build is on the phone.
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? 'dev'),
  },
});
