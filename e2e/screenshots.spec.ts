import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectSignedIn, openApp, openUserMenu, signInAs } from './helpers';

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

async function shoot(page: Page, name: string, suffix = '', fullPage = false) {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  if (fullPage) {
    // Lazy images only load near the viewport: scroll through once, then back to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, 0);
    });
  }
  // Wait for visible images and let entrance animations and fades settle.
  await page.waitForFunction(
    (all) =>
      [...document.images].every((image) => {
        if (image.complete) return true;
        const rect = image.getBoundingClientRect();
        // Cards scrolled sideways out of a row never load (lazy), and that is fine.
        const outsideHorizontally = rect.right < 0 || rect.left > window.innerWidth;
        const outsideVertically = rect.bottom < 0 || rect.top > window.innerHeight;
        return outsideHorizontally || (!all && outsideVertically);
      }),
    fullPage,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(600);
  await page.screenshot({
    path: join(OUTPUT, `${name}-${width}x${height}${suffix}.png`),
    fullPage,
  });
}

async function openFromSearch(page: Page, term: string, group: string) {
  await page.goto(`/search?q=${encodeURIComponent(term)}`);
  await page
    .getByRole('region', { name: new RegExp(`^${group}`) })
    .getByRole('link', { name: new RegExp(term) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: term })).toBeVisible();
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
        await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
        await shoot(page, '04-home');
        await shoot(page, '04-home', '-full', true);
        await openUserMenu(page);
        await shoot(page, '05-user-menu');
      });

      test('library, details, search and favorites', async ({ page }) => {
        await signInAs(page, 'Alex');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await shoot(page, '07-library');
        await page.getByRole('button', { name: 'Filter', exact: true }).click();
        await page.getByRole('button', { name: 'Krimi', pressed: false }).click();
        await shoot(page, '08-library-filters');

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, '09-movie');
        await shoot(page, '09-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await expect(page.getByRole('tab', { name: 'Staffel 2', selected: true })).toBeVisible();
        await shoot(page, '10-series', '-full', true);

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, '11-search');

        await page.goto('/favorites');
        await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
        await shoot(page, '12-favorites');
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
      await expectSignedIn(page, 'Alex');
      await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
      await shoot(page, '04-home', '-light');
      await openFromSearch(page, 'Hafenviertel', 'Serien');
      await shoot(page, '10-series', '-light');
    });
  });
});
