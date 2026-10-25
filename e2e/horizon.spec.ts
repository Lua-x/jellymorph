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

/** Theme Horizon (phase 9): text-link bar, hero with side arrows, unfolding cards, detail tabs. */

async function useHorizon(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Horizon', 'horizon');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

/** Stops the hero rotation, so checks never meet a title halfway through its slide. */
async function pauseHero(page: Page) {
  await page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('button', { name: 'Automatischen Wechsel anhalten' })
    .click();
  await page.mouse.move(5, (page.viewportSize()?.height ?? 720) - 5);
}

async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const after = getComputedStyle(element, '::after');
    return {
      background: style.backgroundColor,
      color: style.color,
      transform: style.transform,
      shadow: style.boxShadow,
      underline: after.transform,
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

test('the whole app switches to Horizon without a reload', async ({ page }) => {
  await useHorizon(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Figtree');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: /^Alex/ })).toBeVisible();
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
});

test('the hero moves with the side arrows and the dots @desktop-only', async ({ page }) => {
  await useHorizon(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const dots = hero.getByRole('group', { name: 'Empfohlene Titel' }).getByRole('button');
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await hero.getByRole('button', { name: 'Nächster Titel' }).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '2 von 6' })).toBeVisible();
  await hero.getByRole('button', { name: 'Vorheriger Titel' }).click();
  await hero.getByRole('button', { name: 'Vorheriger Titel' }).click();
  await expect(dots.nth(5)).toHaveAttribute('aria-current', 'true');
  // Titles out of view are inert (and so not in the accessibility tree).
  await expect(hero.locator('[aria-roledescription="slide"]').first()).toHaveAttribute('inert', '');
  await hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' }).click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('cards unfold downwards with actions and facts @desktop-only', async ({ page }) => {
  await useHorizon(page);
  const card = cards(page, 'Neu in Filme').nth(1);
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.scrollBy(0, -200);
  });
  await card.hover();
  const unfolded = page.getByRole('group', { name: /^Mehr zu / });
  await expect(unfolded).toBeVisible();
  await expect(unfolded.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  await expect(unfolded.getByRole('link', { name: 'Details' })).toBeVisible();
  // It keeps the card's place and opens below it.
  const cardBox = await card.boundingBox();
  const box = await unfolded.boundingBox();
  if (!cardBox || !box) throw new Error('not laid out');
  expect(box.y).toBeLessThan(cardBox.y + 4);
  expect(box.y + box.height).toBeGreaterThan(cardBox.y + cardBox.height + 60);

  await page.mouse.move(5, 5);
  await expect(unfolded).toHaveCount(0);
  await page.keyboard.press('Shift');
  await card.focus();
  await expect(unfolded).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(unfolded).toHaveCount(0);
  await expect(card).toBeFocused();
});

test('film details have tabs for related titles and details', async ({ page }) => {
  await useHorizon(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Bereiche' });
  await expect(tabs.getByRole('tab', { name: 'Ähnliches' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tabs.getByRole('tab', { name: 'Ähnliches' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Details' })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tabpanel').getByRole('term').filter({ hasText: 'Erschienen' }),
  ).toBeVisible();
});

test('series list their episodes in a tab with a season choice', async ({ page }) => {
  await useHorizon(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Episoden' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const panel = page.getByRole('tabpanel');
  const select = panel.getByRole('combobox', { name: 'Staffeln' });
  const current = await select.inputValue();
  const other = (
    await select
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
  ).find((value) => value !== current);
  if (!other) throw new Error('Hafenviertel needs several seasons');
  await select.selectOption(other);
  await expect(page).toHaveURL(/season=/);
  await expect(panel.getByRole('listitem').first()).toBeVisible();
  await expect(panel.getByRole('button', { name: /abspielen$/ }).first()).toBeVisible();
  const title = panel.getByRole('listitem').first().getByRole('link');
  const name = await title.textContent();
  await title.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('the player has its controls in the middle and the tools on top', async ({ page }) => {
  await useHorizon(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/play/${movie.Id}?start=0`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  await expect(player.getByText(movie.Name, { exact: true })).toBeVisible();
  await expect(player.getByText(/^noch /)).toHaveCount(1);
  for (const name of ['10 Sekunden zurück', '10 Sekunden vor']) {
    await expect(player.getByRole('button', { name })).toBeVisible();
  }
  await player.getByRole('button', { name: 'Audio und Untertitel' }).click();
  const menu = page.getByRole('dialog', { name: 'Audio und Untertitel' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('arrow keys reach the rows; focus looks like hover @desktop-only', async ({ page }) => {
  await useHorizon(page);
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
  // The hero loads its titles of the day after the rows: its buttons are the entry point.
  await expect(
    page
      .getByRole('region', { name: 'Empfohlen' })
      .getByRole('button', { name: 'Abspielen' })
      .first(),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
  await expect(async () => {
    if ((await resume.locator(':focus').count()) === 0) await page.keyboard.press('ArrowDown');
    await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
  }).toPass({ timeout: 8000 });

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await compareHoverAndFocus(page, nav.getByRole('link', { name: 'Filme' }));
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Abspielen' }).first());
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Nächster Titel' }));
  await compareHoverAndFocus(page, cards(page, 'Neu in Filme').first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link').first(),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useHorizon(page);
  await pauseHero(page);
  await expectNoA11yViolations(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('tablist', { name: 'Bereiche' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useHorizon(page);
  const card = cards(page, 'Neu in Filme').first();
  await card.hover();
  await expect(page.getByRole('group', { name: /^Mehr zu / })).toBeVisible();
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

  test('the hero does not rotate and slides without motion', async ({ page }) => {
    await useHorizon(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    const transition = await hero
      .locator('[aria-roledescription="slide"]')
      .first()
      .evaluate((slide) => getComputedStyle(slide.parentElement ?? slide).transitionDuration);
    expect(transition).toBe('0s');
  });
});
