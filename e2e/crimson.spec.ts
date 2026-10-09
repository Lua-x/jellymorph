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

/** Theme Crimson (phase 7): hero, rows with preview cards, details as an overlay, player. */

async function useCrimson(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Crimson', 'crimson');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

function row(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true });
}

/** The cards of a row (its title is a link too, to the full list). */
function cards(page: Page, name: string): Locator {
  return row(page, name).getByRole('list').getByRole('link');
}

/** The title a card names for screen readers (its picture carries the title only visually). */
async function cardName(card: Locator): Promise<string> {
  const label = await card.locator('.visually-hidden').first().textContent();
  return label?.split(', ')[0]?.trim() ?? '';
}

/** What hover changes on a card or control. */
async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      transform: style.transform,
      shadow: style.boxShadow,
      border: style.borderColor,
    };
  });
}

async function compareHoverAndFocus(page: Page, locator: Locator) {
  await page.mouse.move(0, 0);
  await locator.hover();
  await page.waitForTimeout(500);
  const hovered = await look(locator);
  await page.mouse.move(1, 1);
  await page.keyboard.press('Shift');
  await locator.focus();
  await page.waitForTimeout(500);
  const focused = await look(locator);
  await locator.blur();
  expect(focused).toEqual(hovered);
}

test('the whole app switches to Crimson without a reload', async ({ page }) => {
  await useCrimson(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Inter');
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Weitere Infos' })).toBeVisible();
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
});

test('details open above the page; Back and Escape return to it unchanged', async ({ page }) => {
  await useCrimson(page);
  const card = cards(page, 'Neu in Serien').first();
  await card.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  const name = await cardName(card);
  await card.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page).toHaveURL(/\/item\//);
  // The page stays mounted underneath, inert and in place.
  await expect(page.locator('[inert]')).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  // The wheel scrolls the details, not the page.
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  await page.mouse.move(viewport.width / 2, viewport.height * 0.6);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => page.locator('[data-overlay-open]').evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

  await card.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  // Focus moves into the dialog and stays there.
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(card).toBeFocused();
});

test('a title opened from the details replaces them; Close returns to the page', async ({
  page,
}) => {
  await useCrimson(page);
  const card = cards(page, 'Neu in Serien').first();
  await card.click();
  const dialog = page.getByRole('dialog');
  const more = dialog.getByRole('region', { name: 'Mehr wie dieses' });
  const next = more.getByRole('list').getByRole('link').first();
  const nextName = await cardName(next);
  await next.click();
  await expect(dialog.getByRole('heading', { level: 1, name: nextName })).toBeVisible();
  await expect(page.locator('[data-overlay-open]')).toHaveJSProperty('scrollTop', 0);

  await dialog.getByRole('button', { name: 'Details schließen' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(card).toBeFocused();
});

test('opened directly, the details are a normal page', async ({ page }) => {
  await useCrimson(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Abspielen|Fortsetzen/ }).first()).toBeVisible();
});

test('resting on a card opens the preview with its actions @desktop-only', async ({ page }) => {
  await useCrimson(page);
  const card = cards(page, 'Neu in Filme').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  const preview = page.getByRole('group', { name: /^Vorschau: / });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  await expect(preview.getByRole('button', { name: /Favorit/ })).toBeVisible();
  await expect(preview.getByRole('link', { name: /^Mehr zu/ })).toBeVisible();

  // Moving away closes it.
  await page.mouse.move(5, 5);
  await expect(preview).toHaveCount(0);

  // Keyboard: focus opens it too; Escape closes it and keeps the focus on the card.
  await page.keyboard.press('Shift');
  await card.focus();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(card).toBeFocused();
  await expect(page).toHaveURL(/\/$/);

  // "More" opens the details of the previewed title.
  await card.hover();
  await preview.getByRole('link', { name: /^Mehr zu/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('series details list the episodes of the chosen season', async ({ page }) => {
  await useCrimson(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  const episodes = dialog.getByRole('region', { name: 'Episoden' });
  await expect(episodes.getByRole('listitem').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Abspielen|Fortsetzen/ }).first()).toBeFocused();

  // It opens on the season of the next episode; switch to another one.
  const select = episodes.getByRole('combobox', { name: 'Staffeln' });
  const current = await select.inputValue();
  const other = (
    await select
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
  ).find((value) => value !== current);
  if (!other) throw new Error('Hafenviertel needs several seasons');
  const first = await episodes.getByRole('button').first().textContent();
  await select.selectOption(other);
  await expect(episodes.getByRole('button').first()).not.toHaveText(first ?? '');
  await expect(page).toHaveURL(/season=/);
  // Still the overlay: changing the season does not leave it.
  await expect(dialog).toBeVisible();
});

test('"Who is watching?" shows the profiles as large tiles', async ({ page }) => {
  await useCrimson(page);
  await openUserMenu(page);
  await page.getByRole('button', { name: 'Profil wechseln' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wer schaut?' })).toBeVisible();
  // The remote starts on the first profile.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Alex', exact: true })).toBeFocused();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
});

test('the player has the Crimson controls and shows what is playing when paused', async ({
  page,
}) => {
  await useCrimson(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/play/${movie.Id}?start=0`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  await expect(player.getByText(movie.Name, { exact: true }).first()).toBeVisible();
  await expect(player.getByText(/^noch /)).toHaveCount(1);
  await player.getByRole('button', { name: 'Audio und Untertitel' }).click();
  const menu = page.getByRole('dialog', { name: 'Audio und Untertitel' });
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
  // After a quiet while the controls give way to "You're watching"; any input brings them back.
  await expect(player).toHaveAttribute('data-paused-info', 'true', { timeout: 9000 });
  await expect(page.getByText('Du siehst gerade')).toBeVisible();
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 320);
  await expect(player).not.toHaveAttribute('data-paused-info');
  await expect(player.getByRole('slider', { name: 'Zeitleiste' })).toBeVisible();
});

test('arrow keys reach the rows; focus looks like hover @desktop-only', async ({ page }) => {
  await useCrimson(page);
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(row(page, 'Weiterschauen').locator(':focus')).toHaveCount(1);
  // Along the row with the arrow keys.
  const first = cards(page, 'Weiterschauen').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cards(page, 'Weiterschauen').nth(1)).toBeFocused();

  await compareHoverAndFocus(
    page,
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Filme' }),
  );
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Abspielen' }).first());
  await compareHoverAndFocus(page, page.getByRole('link', { name: 'Weitere Infos' }));
  await compareHoverAndFocus(page, cards(page, 'Neu in Filme').first());
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useCrimson(page);
  await expectNoA11yViolations(page);
  await cards(page, 'Neu in Serien').first().click();
  await expect(page.getByRole('dialog').getByRole('region', { name: 'Episoden' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useCrimson(page);
  const card = cards(page, 'Neu in Filme').first();
  await card.hover();
  await expect(page.getByRole('group', { name: /^Vorschau: / })).toBeVisible();
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/play/${movie.Id}?start=0`);
  await expect(page.getByRole('group', { name: 'Videoplayer' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  expect(await layoutAnimations(page)).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the hero picture stands still', async ({ page }) => {
    await useCrimson(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const drift = await page
      .getByRole('region', { name: 'Empfohlen' })
      .locator('[aria-hidden="true"] > *')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(drift).toBe('none');
  });
});
