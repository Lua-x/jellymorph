import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  chooseTheme,
  demoItems,
  directPlayable,
  expectSignedIn,
  openApp,
  openUserMenu,
  signInAs,
} from './helpers';

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
  // Neon Grid titles decode themselves for a moment after they appear.
  await page.waitForFunction(() => !document.querySelector('[data-active]'));
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

/** Opens the player paused at `seconds` with the controls showing. */
async function pausedPlayer(page: Page, itemId: string, seconds: number) {
  await page.goto(`/play/${itemId}?start=${String(seconds)}`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  await expect
    .poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.locator('video').evaluate(async (video: HTMLVideoElement) => {
    video.pause();
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await expect(player).toHaveAttribute('data-status', 'paused');
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

      test('player', async ({ page }) => {
        await signInAs(page, 'Alex');
        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        const episode = (await demoItems(page, 'Episode')).find(directPlayable);
        const started = (await demoItems(page, 'Movie')).find(
          (item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0 && !item.UserData?.Played,
        );
        if (!movie || !episode || !started) throw new Error('Missing demo titles');

        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, '13-player');

        // Trickplay preview while hovering the timeline.
        const timeline = page.getByRole('slider', { name: 'Zeitleiste' });
        const box = await timeline.boundingBox();
        if (box) await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
        await shoot(page, '14-player-trickplay');

        await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
        await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
        await shoot(page, '15-player-tracks');

        await pausedPlayer(page, episode.Id, 50);
        await expect(page.getByRole('region', { name: 'Nächste Folge' })).toBeVisible();
        await shoot(page, '16-player-next-up');

        await page.goto(`/play/${started.Id}`);
        await expect(page.getByText('Weiterschauen?')).toBeVisible();
        await shoot(page, '17-resume-prompt');
      });

      test('settings', async ({ page }) => {
        await signInAs(page, 'Alex');
        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await expect(page.locator('.theme-preview section').first()).toBeVisible();
        await shoot(page, '18-settings');
        await shoot(page, '18-settings', '-full', true);
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

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        await expect(
          page.getByRole('region', { name: 'Weiterschauen' }).getByRole('link').first(),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await shoot(page, '19-tv-home');
        await openFromSearch(page, 'Kupferherz', 'Filme');
        await page.keyboard.press('ArrowDown');
        await shoot(page, '19-tv-movie');
      });
    });
  }

  /** Theme Neon Grid (phase 6): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`neon-grid ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('neon grid', async ({ page }) => {
        test.setTimeout(120_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Neon Grid', 'neon-grid');
        await page.goto('/');
        await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
        await shoot(page, '30-neon-home');
        await shoot(page, '30-neon-home', '-full', true);

        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await shoot(page, '31-neon-library');

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, '32-neon-movie');
        await shoot(page, '32-neon-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, '33-neon-series', '-full', true);

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, '34-neon-search');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, '35-neon-player');
        await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
        await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
        await shoot(page, '36-neon-player-tracks');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, '37-neon-settings');

        await page.goto('/');
        await openUserMenu(page);
        await page.getByRole('button', { name: 'Profil wechseln' }).click();
        await expect(page.getByRole('main', { name: 'Systemstart' })).toBeVisible();
        await page.waitForTimeout(1300);
        await page.screenshot({
          path: join(
            OUTPUT,
            `38-neon-boot-${String(viewport.width)}x${String(viewport.height)}.png`,
          ),
        });
        await page.keyboard.press('Escape');
        await expect(
          page.getByRole('heading', { level: 1, name: 'Profil auswählen' }),
        ).toBeVisible();
        await shoot(page, '39-neon-profiles');
        await page.getByRole('button', { name: /^Mika/ }).click();
        await page.getByLabel('Passwort', { exact: true }).fill('falsch');
        await page.keyboard.press('Enter');
        await expect(page.getByText('Benutzername oder Passwort ist falsch.')).toBeVisible();
        await shoot(page, '40-neon-password-error');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`neon-grid TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('neon grid TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Neon Grid', 'neon-grid');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeVisible();
        await expect(
          page.getByRole('region', { name: 'Weiterschauen' }).getByRole('link').first(),
        ).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await shoot(page, '41-neon-tv-home');
      });
    });
  }

  /** Theme Crimson (phase 7): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`crimson ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('crimson', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Crimson', 'crimson');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await shoot(page, '50-crimson-home');
        await shoot(page, '50-crimson-home', '-full', true);

        // The enlarged preview (not on phones, they have no hover).
        if (viewport.width > 640) {
          const card = page
            .getByRole('region', { name: 'Neu in Filme', exact: true })
            .getByRole('list')
            .getByRole('link')
            .nth(1);
          await card.scrollIntoViewIfNeeded();
          await card.hover();
          await expect(page.getByRole('group', { name: /^Vorschau: / })).toBeVisible();
          await shoot(page, '51-crimson-preview');
          await page.mouse.move(0, 0);
        }

        // Details as an overlay above the page, a film and a series.
        await page.goto('/search?q=Kupferherz');
        await page
          .getByRole('region', { name: /^Filme/ })
          .getByRole('link', { name: /Kupferherz/ })
          .first()
          .click();
        await expect(page.getByRole('dialog').getByRole('heading', { level: 1 })).toBeVisible();
        await shoot(page, '52-crimson-movie');
        await page.goBack();

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Neu in Serien', exact: true })
          .getByRole('list')
          .getByRole('link')
          .first()
          .click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('region', { name: 'Episoden' })).toBeVisible();
        await shoot(page, '53-crimson-series');
        await page.locator('[data-overlay-open]').evaluate((overlay) => {
          overlay.scrollTop = overlay.scrollHeight / 3;
        });
        await shoot(page, '53-crimson-series', '-episodes');

        // Opened directly: the same details as a page.
        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
        await shoot(page, '54-crimson-series-page', '', true);

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, '55-crimson-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(0, 0);
        await shoot(page, '56-crimson-library');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, '57-crimson-player');
        await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
        await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
        await shoot(page, '58-crimson-player-tracks');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('group', { name: 'Videoplayer' })).toHaveAttribute(
          'data-paused-info',
          'true',
          { timeout: 10_000 },
        );
        await shoot(page, '59-crimson-player-paused');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, '60-crimson-settings');

        await page.goto('/');
        await openUserMenu(page);
        await page.getByRole('button', { name: 'Profil wechseln' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Wer schaut?' })).toBeVisible();
        await shoot(page, '61-crimson-profiles');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`crimson TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('crimson TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Crimson', 'crimson');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await expect(resume.locator(':focus')).toHaveCount(1);
        await page.waitForTimeout(600);
        await shoot(page, '62-crimson-tv-home');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await shoot(page, '63-crimson-tv-details');
      });
    });
  }

  /** Theme Glass (phase 8): every screen it designs, in all four sizes and both schemes. */
  for (const scheme of ['dark', 'light'] as const) {
    for (const viewport of VIEWPORTS) {
      test.describe(`glass ${scheme} ${String(viewport.width)}x${String(viewport.height)}`, () => {
        test.use({ viewport, colorScheme: scheme });

        test('glass', async ({ page }) => {
          test.setTimeout(150_000);
          const suffix = scheme === 'light' ? '-light' : '';
          await signInAs(page, 'Alex');
          await chooseTheme(page, 'Glass', 'glass');
          await page.goto('/');
          const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
          await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
          // Resting in the middle of the hero holds the rotation for the picture.
          await page.mouse.move(viewport.width * 0.6, viewport.height * 0.35);
          await shoot(page, '70-glass-home', suffix);
          await shoot(page, '70-glass-home', `${suffix}-full`, true);

          // The focus effect under a pointer, off the card's centre.
          if (viewport.width > 640) {
            const card = page
              .getByRole('region', { name: 'Neu in Filme', exact: true })
              .getByRole('list')
              .getByRole('link')
              .nth(1);
            await card.scrollIntoViewIfNeeded();
            const box = await card.boundingBox();
            if (box) {
              await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2);
              await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15);
            }
            await shoot(page, '71-glass-card', suffix);
            await page.mouse.move(0, 0);
          }

          await openFromSearch(page, 'Kupferherz', 'Filme');
          await shoot(page, '72-glass-movie', suffix);
          await shoot(page, '72-glass-movie', `${suffix}-full`, true);

          await openFromSearch(page, 'Hafenviertel', 'Serien');
          await shoot(page, '73-glass-series', suffix);
          await page.getByRole('tablist', { name: 'Staffeln' }).scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await shoot(page, '73-glass-series', `${suffix}-episodes`);

          await page.goto('/search?q=or');
          await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
          await shoot(page, '74-glass-search', suffix);

          await page.goto('/');
          await page
            .getByRole('region', { name: 'Bibliotheken' })
            .getByRole('link', { name: /^Filme/ })
            .click();
          await expect(page.getByText('56 Titel')).toBeVisible();
          await page.mouse.move(0, 0);
          await shoot(page, '75-glass-library', suffix);

          if (scheme === 'dark') {
            const movie = (await demoItems(page, 'Movie')).find(directPlayable);
            if (!movie) throw new Error('Missing demo title');
            await pausedPlayer(page, movie.Id, 22);
            await shoot(page, '76-glass-player');
            await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
            await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
            await shoot(page, '77-glass-player-tracks');
          }

          await page.goto('/settings');
          await expect(
            page.getByRole('heading', { level: 1, name: 'Einstellungen' }),
          ).toBeVisible();
          await shoot(page, '78-glass-settings', suffix);
        });
      });
    }
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`glass TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('glass TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Glass', 'glass');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await expect(resume.locator(':focus')).toHaveCount(1);
        await page.waitForTimeout(700);
        await shoot(page, '79-glass-tv-home');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, '80-glass-tv-details');
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
      const movie = (await demoItems(page, 'Movie')).find(directPlayable);
      if (!movie) throw new Error('Missing demo title');
      await pausedPlayer(page, movie.Id, 22);
      await shoot(page, '13-player', '-light');
      await page.goto('/settings');
      await expect(page.locator('.theme-preview section').first()).toBeVisible();
      await shoot(page, '18-settings', '-light');
    });
  });
});
