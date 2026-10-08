import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  directPlayable,
  expectNoA11yViolations,
  layoutAnimations,
  openUserMenu,
  signInAs,
  unwatched,
} from './helpers';

/** Theme Neon Grid (phase 6): boot sequence, terminal search, dossier, HUD player, effects. */

async function useNeonGrid(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Neon Grid', 'neon-grid');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

/** Titles decode themselves for a moment; checks and screenshots wait until they are done. */
async function waitForScramble(page: Page) {
  await page.waitForFunction(() => !document.querySelector('[data-active]'));
}

/** What hover changes on the element or its first child (cards glow on their picture frame). */
async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const read = (target: Element | null) => {
      if (!target) return null;
      const style = getComputedStyle(target);
      return {
        background: style.backgroundColor,
        color: style.color,
        transform: style.transform,
        filter: style.filter,
        border: style.borderColor,
      };
    };
    return { self: read(element), child: read(element.firstElementChild) };
  });
}

async function compareHoverAndFocus(page: Page, locator: Locator) {
  await page.mouse.move(0, 0);
  await locator.hover();
  await page.waitForTimeout(450);
  const hovered = await look(locator);
  await page.mouse.move(1, 1);
  await page.keyboard.press('Shift');
  await locator.focus();
  await page.waitForTimeout(450);
  const focused = await look(locator);
  await locator.blur();
  expect(focused).toEqual(hovered);
}

test('the whole app switches to Neon Grid without a reload', async ({ page }) => {
  await useNeonGrid(page);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(fonts).toContain('Rajdhani');
  await expect(page.getByRole('region', { name: 'Empfohlen' })).toBeVisible();
  await expect(page.getByText('Sektoren', { exact: true })).toBeVisible();
});

test('the boot sequence runs once per session and can be skipped', async ({ page }) => {
  await useNeonGrid(page);
  await openUserMenu(page);
  await page.getByRole('button', { name: 'Profil wechseln' }).click();

  const boot = page.getByRole('main', { name: 'Systemstart' });
  await expect(boot).toBeVisible();
  // Any key ends it; Escape must not also go back a page.
  await page.keyboard.press('Escape');
  await expect(boot).toBeHidden();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Profil auswählen' })).toBeVisible();

  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
  await openUserMenu(page);
  await page.getByRole('button', { name: 'Profil wechseln' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil auswählen' })).toBeVisible();
  await expect(boot).toHaveCount(0);
});

test('search is a terminal with a cursor and prints grouped results', async ({ page }) => {
  await useNeonGrid(page);
  await page.goto('/search');
  const input = page.getByRole('searchbox', { name: 'Suchbegriff' });
  await expect(input).toBeFocused();
  await input.fill('ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Filme/ })).toBeVisible();
});

test('details show HUD data fields and the actions', async ({ page }) => {
  await useNeonGrid(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: 'Laufzeit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abspielen', exact: true })).toBeVisible();
  await waitForScramble(page);
  await expectNoA11yViolations(page);
});

test('the player HUD shows readouts and opens the track menu', async ({ page }) => {
  await useNeonGrid(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/play/${movie.Id}?start=0`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  // Phones keep the picture free: the readouts are for larger screens.
  if ((page.viewportSize()?.width ?? 0) > 640) {
    await expect(player.getByRole('term').filter({ hasText: 'Systemzeit' })).toBeVisible();
  }
  await player.getByRole('button', { name: 'Audio und Untertitel' }).click();
  const menu = page.getByRole('dialog', { name: 'Audio und Untertitel' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('radio', { checked: true }).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(player.getByRole('slider', { name: 'Zeitleiste' })).toBeVisible();
});

test('arrow keys reach the cards; focus looks like hover @desktop-only', async ({ page }) => {
  await useNeonGrid(page);
  await waitForScramble(page);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('region', { name: 'Weiterschauen' }).locator(':focus')).toHaveCount(
    1,
  );

  await compareHoverAndFocus(
    page,
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Suche' }),
  );
  await compareHoverAndFocus(page, page.getByRole('link', { name: 'Details' }).first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Weiterschauen' }).getByRole('link').first(),
  );
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link').first(),
  );
});

test('home and search are accessible @desktop-only', async ({ page }) => {
  await useNeonGrid(page);
  await waitForScramble(page);
  await expectNoA11yViolations(page);
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useNeonGrid(page);
  // Load the styles of every Neon Grid screen: details, search, player, settings.
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await page.goto(`/play/${movie.Id}?start=0`);
  await expect(page.getByRole('group', { name: 'Videoplayer' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  expect(await layoutAnimations(page)).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('skips the boot sequence and the decoding titles', async ({ page }) => {
    await useNeonGrid(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await openUserMenu(page);
    await page.getByRole('button', { name: 'Profil wechseln' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profil auswählen' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Systemstart' })).toHaveCount(0);
    await expect(page.locator('[data-active]')).toHaveCount(0);
  });
});
