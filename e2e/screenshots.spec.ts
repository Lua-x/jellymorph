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

      test('administration', async ({ page }) => {
        test.setTimeout(180_000);
        await signInAs(page, 'Alex');
        await openFromSearch(page, 'Kupferherz', 'Filme');
        const openEntry = async (entry: string, dialogName: RegExp) => {
          await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
          await page.getByRole('button', { name: entry, exact: true }).click();
          const dialog = page.getByRole('dialog', { name: dialogName });
          await expect(dialog).toBeVisible();
          return dialog;
        };

        await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Metadaten bearbeiten' })).toBeVisible();
        await shoot(page, 'a1-admin-menu');
        await page.keyboard.press('Escape');

        const metadata = await openEntry('Metadaten bearbeiten', /^Metadaten von/);
        await expect(metadata.getByLabel('Titel', { exact: true })).toHaveValue('Kupferherz');
        await shoot(page, 'a2-admin-metadata');
        await page.keyboard.press('Escape');

        const identify = await openEntry('Identifizieren', /identifizieren$/);
        await identify.getByRole('button', { name: 'Suchen' }).click();
        await expect(identify.getByRole('region', { name: 'Treffer' })).toBeVisible();
        await shoot(page, 'a3-admin-identify');
        await page.keyboard.press('Escape');

        const images = await openEntry('Bilder bearbeiten', /^Bilder von/);
        await expect(
          images.getByRole('region', { name: 'Aus Online-Quellen' }).getByRole('listitem'),
        ).toHaveCount(6);
        await shoot(page, 'a4-admin-images');
        await page.keyboard.press('Escape');

        const subtitles = await openEntry('Untertitel verwalten', /^Untertitel von/);
        await subtitles.getByRole('button', { name: 'Suchen' }).click();
        await expect(subtitles.getByRole('button', { name: /herunterladen$/ })).toHaveCount(3);
        await shoot(page, 'a5-admin-subtitles');
        await page.keyboard.press('Escape');

        await openEntry('Metadaten aktualisieren', /aktualisieren$/);
        await shoot(page, 'a6-admin-refresh');
        await page.keyboard.press('Escape');
        await openEntry('Löschen', /löschen\?$/);
        await shoot(page, 'a7-admin-delete');
        await page.keyboard.press('Escape');

        for (const theme of [
          { name: 'Neon Grid', id: 'neon-grid' },
          { name: 'Crimson', id: 'crimson' },
          { name: 'Glass', id: 'glass' },
          { name: 'Horizon', id: 'horizon' },
          { name: 'Constellation', id: 'constellation' },
          { name: 'Cobalt', id: 'cobalt' },
          { name: 'Onyx', id: 'onyx' },
          { name: 'Moonshot', id: 'moonshot' },
        ]) {
          // Crimson shows details above the page; start each theme from home.
          await page.goto('/');
          await chooseTheme(page, theme.name, theme.id);
          await openFromSearch(page, 'Kupferherz', 'Filme');
          await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Metadaten bearbeiten' })).toBeVisible();
          await shoot(page, `a8-admin-menu-${theme.id}`);
          await page.getByRole('button', { name: 'Metadaten bearbeiten' }).click();
          await expect(page.getByRole('dialog', { name: /^Metadaten von/ })).toBeVisible();
          await shoot(page, `a9-admin-metadata-${theme.id}`);
          await page.keyboard.press('Escape');
        }
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

      test('arrangement', async ({ page }) => {
        test.setTimeout(90_000);
        await signInAs(page, 'Alex');
        await page.goto('/settings');
        const heading = page.getByRole('heading', { level: 2, name: 'Anordnung' });
        await heading.evaluate((element) => {
          element.scrollIntoView({ block: 'start' });
        });
        const home = page.getByRole('list', { name: 'Startseite', exact: true });
        const genresUp = home.getByRole('button', { name: '„Genres“ nach oben' });
        for (let step = 0; step < 6; step += 1) await genresUp.click();
        await home.getByRole('button', { name: '„Nächste Folgen“ anzeigen' }).click();
        await heading.evaluate((element) => {
          element.scrollIntoView({ block: 'start' });
        });
        await shoot(page, 'b1-arrangement');

        await page.getByRole('radio', { name: 'Alle (Vorgabe)' }).click();
        await page
          .getByRole('list', { name: 'Navigation', exact: true })
          .getByRole('button', { name: '„Anime“ anzeigen' })
          .click();
        await expect(page.getByText('Die Vorgabe hat ungespeicherte Änderungen.')).toBeVisible();
        await shoot(page, 'b2-arrangement-default');

        await page.goto('/');
        await expect(page.getByRole('region', { name: 'Genres' })).toBeVisible();
        await shoot(page, 'b3-home-arranged');
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
        // The home page has an h1 and an entry point too: wait for the details' play button.
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator('main article [data-autofocus]').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, '80-glass-tv-details');
      });
    });
  }

  /** Theme Horizon (phase 9): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`horizon ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('horizon', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Horizon', 'horizon');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        // Resting on the hero holds the rotation for the picture.
        await page.mouse.move(viewport.width * 0.7, 200);
        await shoot(page, '81-horizon-home');
        await page.mouse.move(0, 0);
        await shoot(page, '81-horizon-home', '-full', true);

        // A card unfolded downwards (not on phones, they have no hover).
        if (viewport.width > 640) {
          const card = page
            .getByRole('region', { name: 'Neu in Filme', exact: true })
            .getByRole('list')
            .getByRole('link')
            .nth(1);
          await card.scrollIntoViewIfNeeded();
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 0.25);
          });
          await card.hover();
          await expect(page.getByRole('group', { name: /^Mehr zu / })).toBeVisible();
          await shoot(page, '82-horizon-card');
          await page.mouse.move(0, 0);
        }

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, '83-horizon-movie');
        await shoot(page, '83-horizon-movie', '-full', true);
        await page.getByRole('tab', { name: 'Details' }).click();
        await page.getByRole('tablist', { name: 'Bereiche' }).scrollIntoViewIfNeeded();
        await shoot(page, '83-horizon-movie', '-details');

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, '84-horizon-series');
        await page.getByRole('tablist', { name: 'Bereiche' }).scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await shoot(page, '84-horizon-series', '-episodes');

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, '85-horizon-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(0, 0);
        await shoot(page, '86-horizon-library');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, '87-horizon-player');
        await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
        await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
        await shoot(page, '88-horizon-player-tracks');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, '89-horizon-settings');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`horizon TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('horizon TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Horizon', 'horizon');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, '90-horizon-tv-home');
        await page.keyboard.press('Enter');
        // The home page has an h1 and an entry point too: wait for the details' play button.
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator('main article [data-autofocus]').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, '91-horizon-tv-details');
      });
    });
  }

  /** Theme Constellation (phase 10): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`constellation ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('constellation', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Constellation', 'constellation');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        // Resting on the banner holds the rotation and shows its glowing frame.
        await page.mouse.move(viewport.width * 0.6, viewport.width > 640 ? 220 : 160);
        await shoot(page, '92-constellation-home');
        await page.mouse.move(viewport.width - 2, viewport.height - 2);
        await shoot(page, '92-constellation-home', '-full', true);

        // Pointer effects and the unfolded rail (not on phones, they have no hover or rail).
        if (viewport.width > 640) {
          const tiles = page.getByRole('region', { name: 'Bibliotheken und Sammlungen' });
          await tiles.scrollIntoViewIfNeeded();
          await tiles.getByRole('link').nth(1).hover();
          await shoot(page, '93-constellation-tile');
          await resume.getByRole('list').getByRole('link').nth(1).hover();
          await shoot(page, '93-constellation-card');
          await page.evaluate(() => {
            window.scrollTo(0, 0);
          });
          await page
            .getByRole('navigation', { name: 'Hauptnavigation' })
            .getByRole('link', { name: 'Filme' })
            .hover();
          await shoot(page, '94-constellation-rail');
          await page.mouse.move(viewport.width - 2, viewport.height - 2);
        }

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, '95-constellation-movie');
        await shoot(page, '95-constellation-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, '96-constellation-series');
        await page.getByRole('region', { name: 'Episoden' }).scrollIntoViewIfNeeded();
        await page.mouse.move(viewport.width - 2, viewport.height - 2);
        await shoot(page, '96-constellation-series', '-episodes');

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, '97-constellation-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken und Sammlungen' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(viewport.width - 2, viewport.height - 2);
        await shoot(page, '97-constellation-library');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, '97-constellation-settings');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, '98-constellation-player');
        await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
        await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
        await shoot(page, '98-constellation-player-tracks');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`constellation TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('constellation TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Constellation', 'constellation');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, '99-constellation-tv-home');

        // Left from the first card opens the rail with the remote.
        const rail = page.getByRole('banner');
        await expect(async () => {
          if ((await rail.locator(':focus').count()) === 0) await page.keyboard.press('ArrowLeft');
          await expect(rail.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, '99-constellation-tv-rail');

        await page.keyboard.press('ArrowRight');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.keyboard.press('Enter');
        // The home page has an h1 and an entry point too: wait for the details' play button.
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator('main article [data-autofocus]').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, '99-constellation-tv-details');
      });
    });
  }

  /** Theme Cobalt (phase 15): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`cobalt ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('cobalt', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Cobalt', 'cobalt');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        // Resting on the stage holds the filmstrip's progress for the picture.
        await page.mouse.move(viewport.width * 0.7, 200);
        await shoot(page, 'c1-cobalt-home');
        await page.mouse.move(0, 0);
        await shoot(page, 'c1-cobalt-home', '-full', true);

        // A poster under the pointer: frame, enlargement, title and year (not on phones).
        if (viewport.width > 640) {
          const card = page
            .getByRole('region', { name: 'Neu in Filme', exact: true })
            .getByRole('list')
            .getByRole('link')
            .nth(1);
          await card.scrollIntoViewIfNeeded();
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 0.2);
          });
          await card.hover();
          await page.waitForTimeout(400);
          await shoot(page, 'c2-cobalt-card');
          await page.mouse.move(0, 0);
        }

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, 'c3-cobalt-movie');
        await shoot(page, 'c3-cobalt-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, 'c4-cobalt-series');
        await page.getByRole('heading', { name: 'Episoden' }).scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await shoot(page, 'c4-cobalt-series', '-episodes');

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, 'c5-cobalt-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(0, 0);
        await shoot(page, 'c6-cobalt-library');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, 'c7-cobalt-player');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, 'c8-cobalt-settings');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`cobalt TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('cobalt TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Cobalt', 'cobalt');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, 'c9-cobalt-tv-home');
        await page.keyboard.press('Enter');
        // The home page has an h1 and an entry point too: wait for the details' play button.
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator('main article [data-autofocus]').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, 'c9-cobalt-tv-details');
      });
    });
  }

  /** Theme Onyx (phase 16): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`onyx ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('onyx', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Onyx', 'onyx');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        // Resting on the spotlight holds its rotation for the picture.
        await page.mouse.move(viewport.width * 0.7, 200);
        await shoot(page, 'd1-onyx-home');
        await page.mouse.move(0, 0);
        await shoot(page, 'd1-onyx-home', '-full', true);

        const ranked = page.getByRole('region', { name: 'Am besten bewertet' });
        await ranked.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
          window.scrollBy(0, -120);
        });
        await shoot(page, 'd2-onyx-ranked');

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, 'd3-onyx-movie');
        await shoot(page, 'd3-onyx-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, 'd4-onyx-series');
        await page.getByRole('heading', { name: 'Episoden' }).evaluate((heading) => {
          window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 120);
        });
        await page.mouse.move(0, 0);
        await shoot(page, 'd4-onyx-series', '-episodes');

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, 'd5-onyx-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(0, 0);
        await shoot(page, 'd6-onyx-library');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, 'd7-onyx-player');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, 'd8-onyx-settings');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`onyx TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('onyx TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Onyx', 'onyx');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, 'd9-onyx-tv-home');

        // Left from the first card reaches the side panel with the remote.
        const panel = page.getByRole('banner');
        await expect(async () => {
          if ((await panel.locator(':focus').count()) === 0) await page.keyboard.press('ArrowLeft');
          await expect(panel.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(500);
        await shoot(page, 'd9-onyx-tv-panel');
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
  /** Theme Moonshot (phase 18): every screen it designs, in all four sizes. */
  for (const viewport of VIEWPORTS) {
    test.describe(`moonshot ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('moonshot', async ({ page }) => {
        test.setTimeout(150_000);
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Moonshot', 'moonshot');
        await page.goto('/');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        // Resting on the stage holds the tab's progress for the picture.
        await page.mouse.move(viewport.width * 0.7, 200);
        await shoot(page, 'm1-moonshot-home');
        await page.mouse.move(0, 0);
        await shoot(page, 'm1-moonshot-home', '-full', true);

        // A card under the pointer: the panel jumps up with a red shadow (not on phones).
        if (viewport.width > 640) {
          const card = page
            .getByRole('region', { name: 'Neu in Filme', exact: true })
            .getByRole('list')
            .getByRole('link')
            .nth(1);
          await card.scrollIntoViewIfNeeded();
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 0.2);
          });
          await card.hover();
          await page.waitForTimeout(400);
          await shoot(page, 'm2-moonshot-card');
          await page.mouse.move(0, 0);
        }

        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, 'm3-moonshot-movie');
        await shoot(page, 'm3-moonshot-movie', '-full', true);

        await openFromSearch(page, 'Hafenviertel', 'Serien');
        await shoot(page, 'm4-moonshot-series');
        await page.getByRole('heading', { name: 'Episoden' }).scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await shoot(page, 'm4-moonshot-series', '-episodes');

        await page.goto('/search?q=or');
        await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
        await shoot(page, 'm5-moonshot-search');

        await page.goto('/');
        await page
          .getByRole('region', { name: 'Bibliotheken' })
          .getByRole('link', { name: /^Filme/ })
          .click();
        await expect(page.getByText('56 Titel')).toBeVisible();
        await page.mouse.move(0, 0);
        await shoot(page, 'm6-moonshot-library');

        const movie = (await demoItems(page, 'Movie')).find(directPlayable);
        if (!movie) throw new Error('Missing demo title');
        await pausedPlayer(page, movie.Id, 22);
        await shoot(page, 'm7-moonshot-player');

        await page.goto('/settings');
        await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
        await shoot(page, 'm8-moonshot-settings');
      });
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]) {
    test.describe(`moonshot TV ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('moonshot TV mode', async ({ page }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem('jellymorph.settings');
          const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'jellymorph.settings',
            JSON.stringify({ ...settings, deviceMode: 'tv', overscan: 0.03 }),
          );
        });
        await signInAs(page, 'Alex');
        await chooseTheme(page, 'Moonshot', 'moonshot');
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
        const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
        await expect(resume.getByRole('list').getByRole('link').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(async () => {
          if ((await resume.locator(':focus').count()) === 0)
            await page.keyboard.press('ArrowDown');
          await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
        }).toPass({ timeout: 8000 });
        await page.waitForTimeout(700);
        await shoot(page, 'm9-moonshot-tv-home');
        await page.keyboard.press('Enter');
        // The home page has an h1 and an entry point too: wait for the details' play button.
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator('main article [data-autofocus]').first()).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(700);
        await shoot(page, 'm9-moonshot-tv-details');
      });
    });
  }

  /** Plugin themes (phase 17): the example "Starter" from theme-starter/ and its tile. */
  for (const viewport of VIEWPORTS) {
    test.describe(`plugin ${String(viewport.width)}x${String(viewport.height)}`, () => {
      test.use({ viewport });

      test('plugin theme', async ({ page }) => {
        await signInAs(page, 'Alex');
        await page.goto('/settings');
        const tile = page
          .getByRole('radiogroup', { name: 'Theme' })
          .getByRole('radio', { name: /^Starter/ });
        await tile.click();
        await tile.scrollIntoViewIfNeeded();
        await expect(page.locator('.theme-preview section').first()).toBeVisible();
        await shoot(page, 'e1-plugin-settings');
        await page.getByRole('button', { name: 'Starter übernehmen' }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'starter');

        await page.goto('/');
        await expect(page.getByRole('region', { name: 'Tipp des Tages' })).toBeVisible();
        await expect(
          page
            .getByRole('region', { name: 'Weiterschauen', exact: true })
            .getByRole('link')
            .first(),
        ).toBeVisible();
        await shoot(page, 'e2-plugin-home');
        await shoot(page, 'e2-plugin-home', '-full', true);

        // A page the plugin leaves to Classic, in the plugin's colors.
        await openFromSearch(page, 'Kupferherz', 'Filme');
        await shoot(page, 'e3-plugin-movie');
      });
    });
  }
});
