/**
 * Builds the theme as Jellymorph loads it: one ES module (index.js) and one style sheet
 * (index.css) next to theme.json and the preview picture from public/. Copy the output folder
 * dist/<id> into the container's folder /custom/themes.
 *
 * React, the translations and the theme building blocks are not bundled: the imports point to
 * the plugin interface the app serves (/plugin-api/v1/), so the theme uses the app's own copies.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const { id } = JSON.parse(readFileSync(new URL('public/theme.json', import.meta.url), 'utf8')) as {
  id: string;
};

/** Jellymorph's plugin interface, version 1 (matches "api": 1 in theme.json). */
const PLUGIN_API: Record<string, string> = {
  react: '/plugin-api/v1/react.js',
  'react/jsx-runtime': '/plugin-api/v1/react-jsx-runtime.js',
  'react-dom': '/plugin-api/v1/react-dom.js',
  'react-i18next': '/plugin-api/v1/react-i18next.js',
  jellymorph: '/plugin-api/v1/jellymorph.js',
};

export default defineConfig({
  root,
  plugins: [react()],
  // Class names start with the theme id, so they never meet the app's or another theme's.
  css: { modules: { generateScopedName: `${id}__[local]_[hash:base64:5]` } },
  build: {
    // THEME_OUT_DIR lets the Jellymorph repository build the example into its test fixtures.
    outDir: process.env.THEME_OUT_DIR ?? `dist/${id}`,
    emptyOutDir: true,
    // Fonts and pictures stay files: the app's Content Security Policy allows no data: fonts.
    assetsInlineLimit: 0,
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(PLUGIN_API),
      output: { paths: PLUGIN_API },
    },
  },
});
