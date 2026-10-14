import { expect, test, type Page } from './fixtures';
import { chooseTheme, demoItems, expectNoA11yViolations, openUserMenu, signInAs } from './helpers';

/**
 * Administration of single titles (phase 13): the "Edit" menu on detail pages with identify,
 * metadata, pictures, subtitles, refresh and delete, plus "Scan library". The demo server keeps
 * changes in memory until the page is reloaded, so every test starts from the same catalog.
 */

const THEMES = [
  { name: 'Classic', id: 'default' },
  { name: 'Neon Grid', id: 'neon-grid' },
  { name: 'Crimson', id: 'crimson' },
  { name: 'Glass', id: 'glass' },
  { name: 'Horizon', id: 'horizon' },
  { name: 'Constellation', id: 'constellation' },
] as const;

/** A 1×1 PNG, as uploaded from the device. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function movieId(page: Page, name = 'Kupferherz'): Promise<string> {
  const movie = (await demoItems(page, 'Movie')).find((item) => item.Name === name);
  if (!movie) throw new Error(`${name} is missing in the demo`);
  return movie.Id;
}

async function openMovie(page: Page, name = 'Kupferherz') {
  await page.goto(`/item/${await movieId(page, name)}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Opens one entry of the "Edit" menu and returns its dialog. */
/** Opens a library and the title in it, all within the app (so there is a page to go back to). */
async function browseToMovie(page: Page, name = 'Kupferherz') {
  await page
    .getByRole('region', { name: 'Bibliotheken' })
    .getByRole('link', { name: /^Filme/ })
    .click();
  await expect(page.getByText('56 Titel')).toBeVisible();
  await page.getByRole('button', { name: `Zu ${name.charAt(0)} springen` }).click();
  await page
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function openAdmin(page: Page, entry: string, dialogName: RegExp) {
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: entry, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('as an administrator', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Alex');
  });

  test('the menu offers what fits the title and works with the keyboard', async ({ page }) => {
    await openMovie(page);
    const trigger = page.getByRole('button', { name: 'Bearbeiten', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('list', { name: 'Verwaltung von „Kupferherz“' });
    await expect(menu.getByRole('button')).toHaveText([
      'Identifizieren',
      'Metadaten bearbeiten',
      'Bilder bearbeiten',
      'Untertitel verwalten',
      'Metadaten aktualisieren',
      'Löschen',
    ]);
    // Opened from the keyboard, the focus moves into the menu; Escape returns it.
    await expect(menu.getByRole('button', { name: 'Identifizieren' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('button', { name: 'Metadaten bearbeiten' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/item\//);

    // A series has no video of its own: identify, but no subtitles.
    const series = (await demoItems(page, 'Episode'))[0]?.SeriesId ?? '';
    await page.goto(`/item/${series}`);
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Identifizieren' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Untertitel verwalten' })).toHaveCount(0);
  });

  test('metadata: edited fields are saved, the rest stays', async ({ page }) => {
    await openMovie(page);
    const dialog = await openAdmin(page, 'Metadaten bearbeiten', /^Metadaten von/);
    const title = dialog.getByLabel('Titel', { exact: true });
    await expect(title).toHaveValue('Kupferherz');
    await expect(dialog.getByLabel('Altersfreigabe')).not.toHaveValue('');

    await title.fill('');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog.getByText('Der Titel darf nicht leer sein.')).toBeVisible();
    await expect(title).toHaveAttribute('aria-invalid', 'true');

    await title.fill('Kupferherz (Restauriert)');
    await dialog.getByLabel('Slogan').fill('Neu gemastert.');
    const newGenre = dialog.getByLabel('Neuer Eintrag für Genres');
    await newGenre.fill('Klassiker');
    await newGenre.press('Enter');
    await expect(dialog.getByRole('list', { name: 'Genres' })).toContainText('Klassiker');
    await dialog.getByRole('button', { name: 'Speichern' }).click();

    await expect(page.getByText('„Kupferherz (Restauriert)“ wurde gespeichert.')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kupferherz (Restauriert)' }),
    ).toBeVisible();
    const main = page.locator('main');
    await expect(main).toContainText('Neu gemastert.');
    await expect(main).toContainText('Klassiker');
    // The description was not touched and is still there (UpdateItem clears what is left out).
    await expect(main).toContainText('Restaurierung & Neuveröffentlichung');
  });

  test('identify: search the providers and apply a match', async ({ page }) => {
    await openMovie(page);
    const dialog = await openAdmin(page, 'Identifizieren', /identifizieren$/);
    await expect(dialog.getByLabel('Demo-Archiv')).toBeVisible();
    await dialog.getByLabel('Titel').fill('Kupferherz Neu');
    await dialog.getByRole('button', { name: 'Suchen' }).click();
    const results = dialog.getByRole('region', { name: 'Treffer' });
    await expect(results.getByRole('listitem')).toHaveCount(2);
    await results.getByRole('button', { name: '„Kupferherz Neu“ übernehmen' }).first().click();
    await expect(page.getByText('„Kupferherz Neu“ ist jetzt zugeordnet.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz Neu' })).toBeVisible();
  });

  test('pictures: choose one from a provider, upload one, delete one', async ({ page }) => {
    await openMovie(page);
    const dialog = await openAdmin(page, 'Bilder bearbeiten', /^Bilder von/);
    const current = dialog.getByRole('region', { name: 'Vorhanden' });
    const poster = current.locator('img');
    await expect(poster).toHaveCount(1);
    const before = await poster.getAttribute('src');

    const online = dialog.getByRole('region', { name: 'Aus Online-Quellen' });
    await expect(online.getByRole('listitem')).toHaveCount(6);
    await dialog.getByLabel('Quelle', { exact: true }).selectOption('Plakatwand');
    await expect(online.getByRole('listitem')).toHaveCount(3);
    await online.getByRole('button', { name: 'Übernehmen' }).first().click();
    await expect(page.getByText('Bild übernommen.')).toBeVisible();
    await expect(poster).not.toHaveAttribute('src', before ?? '');

    await dialog.getByLabel('Bildtyp').selectOption('Banner');
    await expect(current.getByText('Noch kein Bild dieses Typs.')).toBeVisible();
    await expect(online.getByText('Die Quellen haben keine Bilder dieses Typs.')).toBeVisible();
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: PIXEL_PNG });
    await expect(page.getByText('Bild hochgeladen.')).toBeVisible();
    await expect(current.locator('img')).toHaveCount(1);
    await expect
      .poll(() => current.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1);

    await current.getByRole('button', { name: 'Bild löschen' }).click();
    await expect(page.getByText('Bild gelöscht.')).toBeVisible();
    await expect(current.getByText('Noch kein Bild dieses Typs.')).toBeVisible();
  });

  test('subtitles: download, upload and delete', async ({ page }) => {
    await openMovie(page);
    const dialog = await openAdmin(page, 'Untertitel verwalten', /^Untertitel von/);
    const current = dialog.getByRole('region', { name: 'Vorhanden' });
    // Subtitles inside the file cannot be deleted, only external ones.
    await expect(current.getByText('in der Datei').first()).toBeVisible();
    await expect(current.getByRole('button', { name: /löschen/ })).toHaveCount(0);

    await expect(dialog.getByLabel('Sprache').first()).toHaveValue(/^(ger|deu)$/);
    await dialog.getByRole('button', { name: 'Suchen' }).click();
    const download = dialog.getByRole('button', { name: /herunterladen$/ });
    await expect(download).toHaveCount(3);
    await download.first().click();
    await expect(page.getByText('Untertitel heruntergeladen.')).toBeVisible();
    await expect(
      current.getByRole('button', { name: /^„Deutsch - SRT - extern“ löschen$/ }),
    ).toBeVisible();

    await dialog.getByLabel('Untertiteldatei').setInputFiles({
      name: 'kupferherz.en.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHello\n'),
    });
    await dialog.getByLabel('Sprache').nth(1).selectOption({ label: 'Englisch' });
    await dialog.getByRole('checkbox', { name: 'Für Hörgeschädigte' }).check();
    await dialog.getByRole('button', { name: 'Hochladen' }).click();
    await expect(page.getByText('Untertitel hochgeladen.')).toBeVisible();
    const english = current.getByRole('button', { name: /^„English - SRT - extern“ löschen$/ });
    await expect(english).toBeVisible();

    await english.click();
    await expect(page.getByText('Untertitel gelöscht.')).toBeVisible();
    await expect(english).toHaveCount(0);
  });

  test('refresh, and delete leaves the page', async ({ page }) => {
    await browseToMovie(page);

    const refresh = await openAdmin(page, 'Metadaten aktualisieren', /aktualisieren$/);
    const images = refresh.getByRole('checkbox', { name: 'Auch alle Bilder ersetzen' });
    await refresh.getByRole('radio', { name: 'Nach neuen und geänderten Dateien suchen' }).check();
    await expect(images).toBeDisabled();
    await refresh.getByRole('radio', { name: 'Alle Metadaten ersetzen' }).check();
    await images.check();
    await refresh.getByRole('button', { name: 'Aktualisieren' }).click();
    await expect(
      page.getByText('Jellyfin aktualisiert „Kupferherz“ im Hintergrund.'),
    ).toBeVisible();

    const remove = await openAdmin(page, 'Löschen', /löschen\?$/);
    await expect(remove).toContainText('nicht rückgängig');
    await remove.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByText('„Kupferherz“ wurde gelöscht.')).toBeVisible();
    // Back where the title was opened from, and the library no longer has it.
    await expect(page.getByRole('heading', { level: 1, name: 'Filme' })).toBeVisible();
    await expect(page.getByText('55 Titel')).toBeVisible();
  });

  test('a dialog closes with Escape without leaving the page, also without focus', async ({
    page,
  }) => {
    // Opened from within the app, so there is a page that Escape could wrongly go back to.
    await browseToMovie(page);
    const url = page.url();

    const dialog = await openAdmin(page, 'Metadaten bearbeiten', /^Metadaten von/);
    await page.keyboard.press('Backspace');
    await expect(dialog).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(page.url()).toBe(url);
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeFocused();
  });

  test('long dialogs scroll inside, the page behind stays put @desktop-only', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openMovie(page);
    const dialog = await openAdmin(page, 'Metadaten bearbeiten', /^Metadaten von/);
    await expect(dialog.getByLabel('Titel', { exact: true })).toBeVisible();
    const pageScroll = await page.evaluate(() => window.scrollY);
    const box = await dialog.getByLabel('Titel', { exact: true }).boundingBox();
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 120);
    await page.mouse.wheel(0, 2000);
    await expect(dialog.getByRole('checkbox', { name: /Metadaten sperren/ })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  });

  test('Crimson: Escape closes the menu, not the details above the page', async ({ page }) => {
    await chooseTheme(page, 'Crimson', 'crimson');
    await page.goto('/search?q=Kupferherz');
    await page
      .getByRole('region', { name: /^Filme/ })
      .getByRole('link', { name: /Kupferherz/ })
      .first()
      .click();
    const details = page.getByRole('dialog', { name: 'Kupferherz' });
    await expect(details).toBeVisible();
    const trigger = details.getByRole('button', { name: 'Bearbeiten', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    // The menu stays inside the overlay's dialog (screen readers, Tab order).
    await expect(details.getByRole('button', { name: 'Identifizieren' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(details.getByRole('button', { name: 'Identifizieren' })).toBeHidden();
    await expect(details).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('the library can be scanned', async ({ page }) => {
    await page
      .getByRole('region', { name: 'Bibliotheken' })
      .getByRole('link', { name: /^Filme/ })
      .click();
    await page.getByRole('button', { name: 'Bibliothek scannen' }).click();
    await expect(
      page.getByText('Jellyfin durchsucht „Filme“ nach neuen und entfernten Dateien.'),
    ).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`${theme.name}: the edit menu and its dialogs are accessible`, async ({ page }) => {
      if (theme.id !== 'default') await chooseTheme(page, theme.name, theme.id);
      await openMovie(page);
      await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Metadaten bearbeiten' })).toBeVisible();
      // Nothing of the page clips or covers the menu (headers with overflow: hidden, rows below).
      const last = page.getByRole('button', { name: 'Löschen', exact: true });
      await last.scrollIntoViewIfNeeded();
      const onTop = await last.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return element.contains(hit);
      });
      expect(onTop).toBe(true);
      await expectNoA11yViolations(page);
      await page.getByRole('button', { name: 'Metadaten bearbeiten' }).click();
      const dialog = page.getByRole('dialog', { name: /^Metadaten von/ });
      await expect(dialog.getByLabel('Titel', { exact: true })).toHaveValue('Kupferherz');
      await expectNoA11yViolations(page);
      await dialog.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(dialog).toBeHidden();
    });
  }
});

test('other users see no administration', async ({ page }) => {
  await signInAs(page, 'Mika', 'demo');
  await openMovie(page);
  await expect(page.getByRole('button', { name: 'Als gesehen markieren' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Bibliotheken' })
    .getByRole('link', { name: /^Filme/ })
    .click();
  await expect(page.getByText('56 Titel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bibliothek scannen' })).toHaveCount(0);
  await openUserMenu(page);
  await expect(page.getByRole('link', { name: /Server-Verwaltung/ })).toHaveCount(0);
});
