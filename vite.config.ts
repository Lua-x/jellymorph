/// <reference types="vitest/config" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';
import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';

/** Path under which the dev server proxies a real Jellyfin server (same as in the container). */
const PROXY_PATH = '/jellyfin';

/** Keep in sync with src/config/theme-ids.ts and docker/entrypoint.sh. */
const THEME_IDS = ['default', 'neon-grid', 'crimson', 'glass', 'horizon', 'constellation'];

/** The file types the container serves from /custom (docker/nginx.conf.template). */
const CUSTOM_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** Own style sheets in CUSTOM_DIR, found like the container entrypoint finds them in /custom. */
function customCssIn(folder: string | null) {
  const has = (name: string) => folder !== null && existsSync(resolve(folder, name));
  return { all: has('custom.css'), themes: THEME_IDS.filter((id) => has(`${id}.css`)) };
}

/**
 * Serves /config.js during development and `vite preview`.
 * In production the container entrypoint writes this file from environment variables.
 */
/** Environment variable value, or null when unset or blank. */
function readEnv(env: Record<string, string | undefined>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function devAppConfig(env: Record<string, string | undefined>): Plugin {
  const devUrl = readEnv(env, 'JELLYFIN_DEV_URL');
  const demoMode = readEnv(env, 'DEMO_MODE');
  const customDir = readEnv(env, 'CUSTOM_DIR');
  const customRoot = customDir === null ? null : resolve(customDir);
  const config = {
    jellyfinUrl: readEnv(env, 'JELLYFIN_URL'),
    lockServer: readEnv(env, 'LOCK_SERVER') === 'true',
    proxyPath: devUrl ? PROXY_PATH : null,
    defaultTheme: readEnv(env, 'DEFAULT_THEME') ?? 'default',
    appTitle: readEnv(env, 'APP_TITLE') ?? 'Jellymorph',
    demoMode: demoMode === null ? devUrl === null : demoMode === 'true',
    customCss: customCssIn(customRoot),
  };
  const body = `window.__APP_CONFIG__ = ${JSON.stringify(config)};\n`;
  const serve = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/config.js', (_request, response) => {
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache');
      response.end(body);
    });
    // The mounted folder of the container, for development and the end-to-end tests.
    server.middlewares.use('/custom/', (request, response) => {
      const name = decodeURIComponent((request.url ?? '').split('?')[0] ?? '').replace(/^\/+/, '');
      const file = customRoot === null ? null : resolve(customRoot, name);
      const inside = customRoot !== null && file?.startsWith(customRoot + sep) === true;
      const type = CUSTOM_TYPES[extname(name).toLowerCase()];
      if (!file || !type || !inside || !existsSync(file) || !statSync(file).isFile()) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('Content-Type', type);
      response.setHeader('Cache-Control', 'no-cache');
      response.end(readFileSync(file));
    });
  };
  return { name: 'jellymorph:dev-config', configureServer: serve, configurePreviewServer: serve };
}

export default defineConfig(({ mode }) => {
  const env: Record<string, string | undefined> = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };
  const devUrl = readEnv(env, 'JELLYFIN_DEV_URL');

  const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  ) as {
    version: string;
  };

  return {
    plugins: [react(), msw({ mode: 'worker-only' }), devAppConfig(env)],
    define: { __APP_VERSION__: JSON.stringify(version) },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: devUrl
        ? {
            [PROXY_PATH]: {
              target: devUrl,
              changeOrigin: true,
              ws: true,
              rewrite: (path) => path.slice(PROXY_PATH.length) || '/',
            },
          }
        : undefined,
    },
    build: {
      target: ['chrome111', 'edge111', 'firefox128', 'safari16.4'],
      manifest: true,
      // Size is enforced on gzip output by scripts/check-bundle.ts (250 KB base budget);
      // the minified-size warning would only add noise.
      chunkSizeWarningLimit: 1000,
      // Fonts are never inlined as data: URLs: the container's CSP allows fonts only from the own
      // origin (font-src 'self'). Small subsets (e.g. Manrope's Cyrillic Extended, 2.5 KB) would
      // otherwise fall under Vite's 4 KB inline limit. Other assets keep the default.
      assetsInlineLimit: (file) => (/\.(?:woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      restoreMocks: true,
      // Theme token files are read as text by the contrast and scoping tests.
      css: { include: [/themes\/[\w-]+\/(tokens|global)\.css/] },
    },
  };
});
