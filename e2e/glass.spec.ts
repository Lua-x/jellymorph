import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  directPlayable,
  expectNoA11yViolations,
  layoutAnimations,
  signInAs,
  unwatched,
} from './helpers';

/** Theme Glass (phase 8): pill bar, hero carousel, lifting cards, glass details and player. */

async function useGlass(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Glass', 'glass');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

/** Stops the hero rotation, so checks never meet a title halfway through its fade. */
async function pauseHero(page: Page) {
  await page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('button', { name: 'Automatischen Wechsel anhalten' })
    .click();
  await page.mouse.move(5, (page.viewportSize()?.height ?? 720) - 5);
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

/** The moving tile inside a card (the link stays still, the tile lifts and leans). */
function tileOf(card: Locator): Locator {
  return card.locator('span').first();
}

/** The computed transform once the springs have come to rest. */
async function settledTransform(locator: Locator): Promise<string> {
  let previous = '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await locator.evaluate((element) => getComputedStyle(element).transform);
    if (current === previous) return current;
    previous = current;
    await locator.page().waitForTimeout(120);
  }
  return previous;
}

function scaleOf(transform: string): number {
  const values = /matrix(?:3d)?\(([^)]+)\)/.exec(transform)?.[1]?.split(',').map(Number) ?? [];
  if (values.length === 6) return Math.hypot(values[0] ?? 1, values[1] ?? 0);
  if (values.length === 16) return Math.hypot(values[0] ?? 1, values[1] ?? 0, values[2] ?? 0);
  return 1;
}

/** Whether a 3D transform leans (rotation around x or y), beyond rounding noise. */
function leans(transform: string): boolean {
  const values = /matrix3d\(([^)]+)\)/.exec(transform)?.[1]?.split(',').map(Number);
  if (!values) return false;
  // m13 and m23 are zero without a rotation around y or x.
  return Math.abs(values[2] ?? 0) > 0.01 || Math.abs(values[6] ?? 0) > 0.01;
}

async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      shadow: style.boxShadow,
      border: style.borderColor,
    };
  });
}

/** Hover and keyboard focus give the same look (after transitions and springs settle). */
async function compareHoverAndFocus(page: Page, target: Locator, styled: Locator = target) {
  await page.mouse.move(0, 0);
  await target.hover();
  const hoveredTransform = await settledTransform(styled);
  const hovered = await look(styled);
  await page.mouse.move(1, 1);
  await page.keyboard.press('Shift');
  await target.focus();
  const focusedTransform = await settledTransform(styled);
  const focused = await look(styled);
  await target.blur();
  expect(focused).toEqual(hovered);
  expect(scaleOf(focusedTransform)).toBeCloseTo(scaleOf(hoveredTransform), 2);
}

test('the whole app switches to Glass without a reload', async ({ page }) => {
  await useGlass(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Inter');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Details' })).toBeVisible();
});

test('the hero rotates on its own, and the pause button stops it @desktop-only', async ({
  page,
}) => {
  await useGlass(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const dots = hero.getByRole('group', { name: 'Empfohlene Titel' }).getByRole('button');
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');

  // Pointer away from the hero: the rotation runs and moves on after a few seconds.
  await page.evaluate(() => {
    window.scrollTo(0, window.innerHeight * 0.85);
  });
  await page.mouse.move(20, (page.viewportSize()?.height ?? 720) - 20);
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 12_000 });

  // A dot shows its title; the pause button stops the rotation.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await dots.nth(3).click();
  await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '4 von 6' })).toBeVisible();
  const pause = hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' });
  await pause.click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(20, (page.viewportSize()?.height ?? 720) - 20);
  await expect(hero.locator('[data-running]')).toHaveCount(0);
});

test('cards lift on focus and lean towards the pointer @desktop-only', async ({ page }) => {
  await useGlass(page);
  const card = cards(page, 'Neu in Filme').nth(1);
  await card.scrollIntoViewIfNeeded();
  const tile = tileOf(card);
  expect(scaleOf(await settledTransform(tile))).toBeCloseTo(1, 2);

  // Under the pointer, off the centre: lifted and leaning.
  const box = await card.boundingBox();
  if (!box) throw new Error('card not laid out');
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15);
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
  const hovered = await settledTransform(tile);
  expect(scaleOf(hovered)).toBeGreaterThan(1.05);
  expect(leans(hovered)).toBe(true);

  // Pointer gone: back to rest.
  await page.mouse.move(5, 5);
  expect(scaleOf(await settledTransform(tile))).toBeCloseTo(1, 2);

  // Keyboard focus: lifted straight up.
  await page.keyboard.press('Shift');
  await card.focus();
  const focused = await settledTransform(tile);
  expect(scaleOf(focused)).toBeGreaterThan(1.05);
  expect(leans(focused)).toBe(false);
});

test('details fill the window with the title, glass buttons, cast and facts', async ({ page }) => {
  await useGlass(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: /Abspielen|Fortsetzen/ }).first()).toBeFocused();
  await expect(page.getByRole('region', { name: 'Besetzung und Crew' })).toBeVisible();
  const info = page.getByRole('region', { name: 'Informationen' });
  await expect(info.getByRole('term').filter({ hasText: 'Erschienen' })).toBeVisible();
});

test('series show seasons as pills and the episodes as a shelf', async ({ page }) => {
  await useGlass(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Staffeln' });
  const selected = tabs.getByRole('tab', { selected: true });
  await expect(selected).toBeVisible();
  const before = await selected.textContent();
  await selected.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { selected: true })).not.toHaveText(before ?? '');
  await expect(tabs.getByRole('tab', { selected: true })).toBeFocused();
  await expect(page).toHaveURL(/season=/);

  const episodes = page.getByRole('tabpanel');
  await expect(episodes.getByRole('listitem').first()).toBeVisible();
  const details = episodes.getByRole('link', { name: /^Details zu/ }).first();
  await details.click();
  await expect(page).toHaveURL(/\/item\//);
  await expect(page.getByRole('link', { name: 'Hafenviertel' })).toBeVisible();
});

test('the player is a panel of glass with the remaining time and menus', async ({ page }) => {
  await useGlass(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/play/${movie.Id}?start=0`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  await expect(player.getByText(movie.Name, { exact: true })).toBeVisible();
  await expect(player.getByText(/^noch /)).toHaveCount(1);
  await player.getByRole('button', { name: 'Wiedergabe-Einstellungen' }).click();
  const menu = page.getByRole('dialog', { name: 'Wiedergabe-Einstellungen' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect
    .poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.locator('video').evaluate((video: HTMLVideoElement) => {
    video.pause();
  });
  await expect(player).toHaveAttribute('data-status', 'paused');
  await expect(player.getByRole('button', { name: 'Abspielen' })).toHaveCount(2);
});

test('the light scheme keeps the glass readable and accessible @desktop-only', async ({ page }) => {
  await useGlass(page);
  await page.goto('/settings');
  await page
    .getByRole('radiogroup', { name: 'Farbschema', exact: true })
    .getByRole('radio', { name: 'Hell' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
  await pauseHero(page);
  const tab = page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .first()
    .getByRole('link', { name: 'Filme' });
  expect(await tab.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(27, 27, 31)');
  await expectNoA11yViolations(page);
});

test('arrow keys reach the shelves; focus looks like hover @desktop-only', async ({ page }) => {
  await useGlass(page);
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  // The hero's indicator sits beside the buttons, so the next row is one step down.
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('region', { name: 'Weiterschauen', exact: true }).locator(':focus'),
  ).toHaveCount(1);
  const first = cards(page, 'Weiterschauen').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cards(page, 'Weiterschauen').nth(1)).toBeFocused();

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await compareHoverAndFocus(page, nav.getByRole('link', { name: 'Filme' }));
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Abspielen' }).first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Empfohlen' }).getByRole('link', { name: 'Details' }),
  );
  const card = cards(page, 'Neu in Filme').first();
  await card.scrollIntoViewIfNeeded();
  await compareHoverAndFocus(page, card, tileOf(card));
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link').first(),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useGlass(page);
  await pauseHero(page);
  await expectNoA11yViolations(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('tablist', { name: 'Staffeln' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useGlass(page);
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

  test('the hero stands still and cards lift without leaning @desktop-only', async ({ page }) => {
    await useGlass(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    await expect(hero.locator('[data-running]')).toHaveCount(0);

    const card = cards(page, 'Neu in Filme').nth(1);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error('card not laid out');
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15);
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
    const transform = await settledTransform(tileOf(card));
    expect(scaleOf(transform)).toBeGreaterThan(1.05);
    expect(leans(transform)).toBe(false);
  });
});
