import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** A running app to test instead of `vite preview`, e.g. the container (scripts/test-container.ts). */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;

/**
 * E2E tests run against the production build in demo mode (mock Jellyfin inside the page).
 * Screenshot runs (`npm run shots`) use the same server; see e2e/screenshots.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: EXTERNAL_BASE_URL ?? `http://localhost:${PORT}`,
    locale: 'de-DE',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grepInvert: /@desktop-only|@shots|@previews|@readme/,
    },
  ],
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        // The example plugin theme first, so the server lists it (e2e/plugins.spec).
        command: `node scripts/build-starter.ts && npm run build && npm run preview -- --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        // Own style sheets and plugin themes as the container would find them in /custom
        // (e2e/customization.spec, e2e/plugins.spec).
        env: { DEMO_MODE: 'true', CUSTOM_DIR: 'e2e/fixtures/custom', THEME_PLUGINS: 'true' },
        timeout: 180_000,
      },
});
