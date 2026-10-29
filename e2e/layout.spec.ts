import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  expectNoA11yViolations,
  expectSignedIn,
  openUserMenu,
  signInAs,
} from './helpers';

/**
 * Arrangement (phase 14): users order and hide home areas, navigation entries, detail buttons
 * and facts; administrators set a default for everybody, which own arrangements override.
 */

async function openArrangement(page: Page) {
  await openUserMenu(page);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Anordnung' })).toBeVisible();
}

function list(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

async function entryNames(list: Locator): Promise<string[]> {
  return list
    .locator(':scope > li')
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector('[class*="label"]')?.firstChild?.textContent ?? ''),
    );
}

/** Names of the home areas in page order (rows, tiles, genres; the hero has a label of its own). */
async function homeOrder(page: Page): Promise<string[]> {
  await page.goto('/');
  const read = () =>
    page
      .locator('main section[aria-labelledby]')
      .evaluateAll((sections) =>
        sections.map(
          (section) =>
            document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent ??
            '',
        ),
      );
  // Rows arrive one by one: read once nothing changed for a moment.
  let last: string[] = [];
  await expect
    .poll(async () => {
      const current = await read();
      const stable = current.length > 0 && current.join('|') === last.join('|');
      last = current;
      return stable;
    })
    .toBe(true);
  return last;
}

/** Presses "up" until the entry is at the top (the button then reports itself disabled). */
async function moveToTop(list: Locator, name: string) {
  const button = list.getByRole('button', { name: `„${name}“ nach oben` });
  for (let step = 0; step < 30; step += 1) {
    if ((await button.getAttribute('aria-disabled')) === 'true') return;
    await button.click();
  }
  throw new Error(`${name} did not reach the top`);
}

async function hide(list: Locator, name: string) {
  const toggle = list.getByRole('button', { name: `„${name}“ anzeigen` });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
}

test.describe('own arrangement', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Alex');
  });

  test('home areas can be hidden and moved, and that sticks', async ({ page }) => {
    const before = await homeOrder(page);
    expect(before).toContain('Weiterschauen');
    expect(before.indexOf('Deine Favoriten')).toBeGreaterThan(before.indexOf('Weiterschauen'));

    await openArrangement(page);
    const home = list(page, 'Startseite');
    // The hero stays first and cannot be moved; "Play" is the only button that cannot hide.
    await expect(home.locator(':scope > li').first()).toContainText('Großes Titelbild');
    await expect(home.getByRole('button', { name: '„Großes Titelbild“ nach oben' })).toHaveCount(0);
    await hide(home, 'Weiterschauen');
    await moveToTop(home, 'Deine Favoriten');
    await expect(
      page.getByText('„Deine Favoriten“ steht jetzt an Stelle 2 von', { exact: false }),
    ).toBeAttached();
    expect((await entryNames(home)).slice(0, 2)).toEqual(['Großes Titelbild', 'Deine Favoriten']);

    const after = await homeOrder(page);
    expect(after).not.toContain('Weiterschauen');
    expect(after[0]).toBe('Deine Favoriten');

    // Saved on the server like every setting: a fresh start keeps it.
    await page.reload();
    await expectSignedIn(page, 'Alex');
    expect((await homeOrder(page))[0]).toBe('Deine Favoriten');

    await openArrangement(page);
    await page.getByRole('button', { name: '„Startseite“ zurücksetzen' }).click();
    expect(await homeOrder(page)).toEqual(before);
  });

  test('navigation entries follow the arrangement @desktop-only', async ({ page }) => {
    await openArrangement(page);
    const nav = list(page, 'Navigation');
    await moveToTop(nav, 'Favoriten');
    await hide(nav, 'Anime');
    const bar = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
    const links = await bar.getByRole('link').allTextContents();
    expect(links[0]).toBe('Favoriten');
    expect(links).not.toContain('Anime');
  });

  test('detail buttons and facts follow the arrangement', async ({ page }) => {
    const movie = (await demoItems(page, 'Movie')).find((item) => item.Name === 'Kupferherz');
    if (!movie) throw new Error('Kupferherz is missing in the demo');

    await openArrangement(page);
    const buttons = list(page, 'Knöpfe auf Detailseiten');
    // "Play" can be moved but never hidden.
    await expect(buttons.getByRole('button', { name: '„Abspielen“ anzeigen' })).toHaveCount(0);
    await moveToTop(buttons, 'Als gesehen markieren');
    await hide(buttons, 'Favorit');
    const facts = list(page, 'Angaben auf Detailseiten');
    await hide(facts, 'Genres');
    await hide(facts, 'Tonspuren');

    await page.goto(`/item/${movie.Id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz' })).toBeVisible();
    const row = page.getByRole('button', { name: 'Als gesehen markieren' }).locator('..');
    const names = await row.getByRole('button').allTextContents();
    expect(names[0]).toBe('Als gesehen markieren');
    await expect(page.getByRole('button', { name: 'Favorit', exact: true })).toHaveCount(0);
    const main = page.locator('main');
    await expect(main).not.toContainText('Fantasy · Dokumentation');
    await expect(main.getByText('Ton', { exact: true })).toHaveCount(0);
    await expect(main.getByText('Untertitel', { exact: true })).toBeVisible();
  });

  test('a list is reordered by dragging its handle @desktop-only', async ({ page }) => {
    await openArrangement(page);
    const home = list(page, 'Startseite');
    const rows = home.locator(':scope > li');
    const names = await entryNames(home);
    const from = names.indexOf('Genres');
    // Mouse coordinates are window coordinates: the whole list has to be on screen.
    await home.evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
    const handle = rows.nth(from).locator('[class*="handle"]');
    const target = rows.nth(1);
    const start = await handle.boundingBox();
    const end = await target.boundingBox();
    if (!start || !end) throw new Error('rows not laid out');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 10, end.y + 4, { steps: 12 });
    await page.mouse.up();
    expect((await entryNames(home))[1]).toBe('Genres');
    expect((await homeOrder(page))[0]).toBe('Genres');
  });

  test('the arrangement applies in every theme', async ({ page }) => {
    await openArrangement(page);
    await moveToTop(list(page, 'Startseite'), 'Genres');
    await chooseTheme(page, 'Crimson', 'crimson');
    expect((await homeOrder(page))[0]).toBe('Genres');
    await chooseTheme(page, 'Cobalt', 'cobalt');
    expect((await homeOrder(page))[0]).toBe('Genres');
    await chooseTheme(page, 'Onyx', 'onyx');
    expect((await homeOrder(page))[0]).toBe('Genres');
    await chooseTheme(page, 'Moon', 'moon');
    expect((await homeOrder(page))[0]).toBe('Genres');
  });

  test('the arrangement section is accessible', async ({ page }) => {
    await openArrangement(page);
    await page.getByRole('heading', { level: 2, name: 'Anordnung' }).scrollIntoViewIfNeeded();
    await expectNoA11yViolations(page);
  });
});

test('the default for everybody applies until a user arranges the list', async ({ page }) => {
  await signInAs(page, 'Alex');
  await openArrangement(page);
  await page.getByRole('radio', { name: 'Alle (Vorgabe)' }).click();
  const home = list(page, 'Startseite');
  await hide(home, 'Genres');
  await expect(page.getByText('Die Vorgabe hat ungespeicherte Änderungen.')).toBeVisible();
  await page.getByRole('button', { name: 'Für alle speichern' }).click();
  await expect(page.getByText('Vorgabe für 4 Benutzer gespeichert.')).toBeVisible();
  // Alex's own view follows the default too.
  expect(await homeOrder(page)).not.toContain('Genres');

  await openUserMenu(page);
  await page.getByRole('button', { name: 'Profil wechseln' }).click();
  await page.getByRole('button', { name: /^Mika/ }).click();
  await page.getByLabel('Passwort', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expectSignedIn(page, 'Mika');
  expect(await homeOrder(page)).not.toContain('Genres');

  // Mika has no default to edit, only an own arrangement, and it wins.
  await openArrangement(page);
  await expect(page.getByRole('radio', { name: 'Alle (Vorgabe)' })).toHaveCount(0);
  const own = list(page, 'Startseite');
  await expect(page.getByText('Folgt der Vorgabe').first()).toBeVisible();
  const genres = own.getByRole('button', { name: '„Genres“ anzeigen' });
  await expect(genres).toHaveAttribute('aria-pressed', 'false');
  await genres.click();
  expect(await homeOrder(page)).toContain('Genres');
});
