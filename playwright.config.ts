import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

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
    baseURL: `http://localhost:${PORT}`,
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
      grepInvert: /@desktop-only|@shots|@previews/,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { DEMO_MODE: 'true' },
    timeout: 180_000,
  },
});
