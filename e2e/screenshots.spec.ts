import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openApp, openUserMenu, signInAs } from './helpers';

/**
 * Review screenshots for the Definition of Done (CLAUDE.md §9). Not part of the normal E2E run:
 *   npm run shots   →  artifacts/screenshots/<page>-<width>x<height>[-light].png
 */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

const OUTPUT = join(import.meta.dirname, '..', 'artifacts', 'screenshots');
mkdirSync(OUTPUT, { recursive: true });

async function shoot(page: Page, name: string, suffix = '') {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  // Let entrance animations settle so screenshots show the resting state.
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(OUTPUT, `${name}-${width}x${height}${suffix}.png`) });
}

test.describe('screenshots @shots', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      test('sign-in screens', async ({ page }) => {
        await openApp(page);
        await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible();
        await shoot(page, '01-profiles');

        await page.getByRole('button', { name: /^Mika/ }).click();
        await page.getByLabel('Passwort', { exact: true }).fill('falsch');
        await page.keyboard.press('Enter');
        await expect(page.getByText('Benutzername oder Passwort ist falsch.')).toBeVisible();
        await shoot(page, '02-password-error');

        await page.getByRole('button', { name: 'Mit Quick Connect anmelden' }).click();
        await expect(page.getByText('Warte auf Bestätigung …')).toBeVisible();
        await shoot(page, '03-quick-connect');
      });

      test('home and user menu', async ({ page }) => {
        await signInAs(page, 'Alex');
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await shoot(page, '04-home');
        await openUserMenu(page);
        await shoot(page, '05-user-menu');
      });

      test('server selection', async ({ page }) => {
        await page.route('**/config.js', (route) =>
          route.fulfill({
            contentType: 'text/javascript',
            body: 'window.__APP_CONFIG__ = { demoMode: false };',
          }),
        );
        await page.addInitScript(() => {
          localStorage.setItem(
            'jellymorph.servers',
            JSON.stringify({
              currentServerId: null,
              servers: [
                {
                  id: 's1',
                  name: 'Wohnzimmer',
                  url: 'https://media.example.com',
                  version: '12.0.1',
                  fixed: false,
                  lastUsedAt: 2,
                },
                {
                  id: 's2',
                  name: 'Ferienhaus',
                  url: 'http://192.168.178.20:8096',
                  version: '10.11.2',
                  fixed: false,
                  lastUsedAt: 1,
                },
              ],
            }),
          );
        });
        await openApp(page, '/servers');
        await page.getByLabel('Server-Adresse').fill('http://127.0.0.1:9');
        await page.getByRole('button', { name: 'Verbinden' }).click();
        await expect(page.getByText(/Der Server antwortet nicht/)).toBeVisible({ timeout: 20_000 });
        await shoot(page, '06-servers');
      });
    });
  }

  test.describe('light color scheme', () => {
    test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });

    test('profiles and home', async ({ page }) => {
      await openApp(page);
      await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible();
      await shoot(page, '01-profiles', '-light');
      await page.getByRole('button', { name: 'Alex' }).click();
      await expect(page.getByRole('heading', { name: 'Hallo, Alex!' })).toBeVisible();
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await shoot(page, '04-home', '-light');
    });
  });
});
