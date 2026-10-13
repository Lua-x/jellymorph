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

/** Theme Constellation (phase 10): icon rail, banner carousel, glowing tiles, starfield. */

const TILES = 'Bibliotheken und Sammlungen';

async function useConstellation(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Constellation', 'constellation');
  await page.goto('/');
  await expect(page.getByRole('region', { name: TILES })).toBeVisible();
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

/** Stops the hero rotation, so checks never meet a banner halfway through its slide. */
async function pauseHero(page: Page) {
  await page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('button', { name: 'Automatischen Wechsel anhalten' })
    .click();
  await page.mouse.move(900, (page.viewportSize()?.height ?? 720) - 5);
}

/** Opacity of the rail labels (0 folded, 1 unfolded). */
async function labelOpacity(page: Page): Promise<string> {
  return page
    .locator('header')
    .getByText('Startseite', { exact: true })
    .evaluate((label) => getComputedStyle(label).opacity);
}

async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      transform: style.transform,
      shadow: style.boxShadow,
      before: getComputedStyle(element, '::before').opacity,
      after: getComputedStyle(element, '::after').opacity,
    };
  });
}

async function compareHoverAndFocus(page: Page, locator: Locator) {
  await page.mouse.move(900, 1);
  await locator.hover();
  await page.waitForTimeout(500);
  const hovered = await look(locator);
  await page.mouse.move(900, 1);
  await page.keyboard.press('Shift');
  await locator.focus();
  await page.waitForTimeout(500);
  const focused = await look(locator);
  await locator.blur();
  expect(focused).toEqual(hovered);
}

test('the whole app switches to Constellation without a reload', async ({ page }) => {
  await useConstellation(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Nunito Sans');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: /^Alex/ })).toBeVisible();
  // The starfield lies behind every page.
  const stars = await page.evaluate(() => getComputedStyle(document.body, '::before').position);
  expect(stars).toBe('fixed');
  // Libraries and collections share the tile row.
  const tiles = page.getByRole('region', { name: TILES }).getByRole('link');
  await expect(tiles.filter({ hasText: 'Filme' })).toBeVisible();
  await expect(tiles.filter({ hasText: 'Am Wasser' })).toHaveCount(1);
});

test('the rail unfolds under the pointer and with keyboard focus @desktop-only', async ({
  page,
}) => {
  await useConstellation(page);
  await page.mouse.move(900, 700);
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const home = nav.getByRole('link', { name: 'Startseite' });
  // Every item keeps the narrow width, so arrow navigation measures the icon column.
  const narrow = (await home.boundingBox())?.width ?? 0;
  expect(narrow).toBeLessThan(100);
  await expect.poll(() => labelOpacity(page)).toBe('0');

  await home.hover();
  await expect.poll(() => labelOpacity(page)).toBe('1');
  await page.mouse.move(900, 700);
  await expect.poll(() => labelOpacity(page)).toBe('0');

  // From the first banner, the left arrow leads into the rail, the right arrow back out.
  await page.keyboard.press('ArrowDown');
  const banner = page.getByRole('region', { name: 'Empfohlen' }).getByRole('link').first();
  await expect(banner).toBeFocused();
  await expect(async () => {
    await page.keyboard.press('ArrowLeft');
    await expect(nav.locator(':focus')).toHaveCount(1, { timeout: 400 });
  }).toPass({ timeout: 6000 });
  await expect.poll(() => labelOpacity(page)).toBe('1');
  expect((await home.boundingBox())?.width).toBe(narrow);
  await page.keyboard.press('ArrowRight');
  await expect(nav.locator(':focus')).toHaveCount(0);
  await expect.poll(() => labelOpacity(page)).toBe('0');
});

test('banners move with the arrows and dots and open their title @desktop-only', async ({
  page,
}) => {
  await useConstellation(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const dots = hero.getByRole('group', { name: 'Empfohlene Titel' }).getByRole('button');
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await hero.getByRole('button', { name: 'Nächster Titel' }).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '2 von 6' })).toBeVisible();
  await hero.getByRole('button', { name: 'Vorheriger Titel' }).click();
  await hero.getByRole('button', { name: 'Vorheriger Titel' }).click();
  await expect(dots.nth(5)).toHaveAttribute('aria-current', 'true');
  // Banners out of focus peek in, but are inert (and so not in the accessibility tree).
  await expect(hero.locator('[aria-roledescription="slide"]').first()).toHaveAttribute('inert', '');
  await hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' }).click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');

  const banner = hero.getByRole('group', { name: '6 von 6' }).getByRole('link');
  const name = await banner.getAttribute('aria-label');
  await banner.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('tiles glow with focus and open libraries and collections', async ({ page }) => {
  await useConstellation(page);
  const tiles = page.getByRole('region', { name: TILES }).getByRole('link');
  const library = tiles.filter({ hasText: 'Filme' });
  await page.keyboard.press('Shift');
  await library.focus();
  await expect
    .poll(() => library.evaluate((tile) => getComputedStyle(tile, '::after').opacity))
    .toBe('1');
  await library.click();
  await expect(page.getByText('56 Titel')).toBeVisible();

  await page.goto('/');
  await tiles.filter({ hasText: 'Am Wasser' }).click();
  await expect(page).toHaveURL(/\/collection\//);
  await expect(page.getByRole('heading', { level: 1, name: 'Am Wasser' })).toBeVisible();
});

test('film details show suggestions and the details below the header', async ({ page }) => {
  await useConstellation(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  const suggestions = page.getByRole('region', { name: 'Vorschläge' });
  await expect(suggestions.getByRole('link').first()).toBeVisible();
  const details = page.getByRole('region', { name: 'Details', exact: true });
  await expect(details.getByRole('term').filter({ hasText: 'Erschienen' })).toBeVisible();
});

test('series show their episodes side by side with a season choice', async ({ page }) => {
  await useConstellation(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  const episodes = page.getByRole('region', { name: 'Episoden' });
  // The next episode is marked and scrolled into the visible part of its row.
  const next = episodes.getByRole('listitem').filter({ hasText: 'Als Nächstes' });
  await expect
    .poll(() =>
      next.evaluate((slot) => {
        const own = slot.getBoundingClientRect();
        const row = slot.parentElement?.getBoundingClientRect();
        return row !== undefined && own.left >= row.left - 1 && own.right <= row.right + 1;
      }),
    )
    .toBe(true);

  const select = episodes.getByRole('combobox', { name: 'Staffeln' });
  const current = await select.inputValue();
  const other = (
    await select
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
  ).find((value) => value !== current);
  if (!other) throw new Error('Hafenviertel needs several seasons');
  await select.selectOption(other);
  await expect(page).toHaveURL(/season=/);
  await expect(episodes.getByRole('button', { name: /abspielen$/ }).first()).toBeVisible();
  const title = episodes.getByRole('listitem').first().getByRole('link');
  const name = await title.textContent();
  await title.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('the player has the title on top and the controls under the timeline', async ({ page }) => {
  await useConstellation(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/play/${movie.Id}?start=0`);
  const player = page.getByRole('group', { name: 'Videoplayer' });
  await expect(player).toBeVisible();
  await expect(player.getByText(movie.Name, { exact: true })).toBeVisible();
  await expect(player.getByText(/^noch /)).toHaveCount(1);
  const timeline = await player.getByRole('slider', { name: 'Zeitleiste' }).boundingBox();
  const play = await player.getByRole('button', { name: /^(Pause|Abspielen)$/ }).boundingBox();
  if (!timeline || !play) throw new Error('not laid out');
  expect(play.y).toBeGreaterThan(timeline.y);
  for (const name of ['10 Sekunden zurück', '10 Sekunden vor', 'Player schließen']) {
    await expect(player.getByRole('button', { name })).toBeVisible();
  }
  await player.getByRole('button', { name: 'Audio und Untertitel' }).click();
  const menu = page.getByRole('dialog', { name: 'Audio und Untertitel' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('arrow keys reach the rows; focus looks like hover @desktop-only', async ({ page }) => {
  await useConstellation(page);
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
  const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
  await expect(async () => {
    if ((await resume.locator(':focus').count()) === 0) await page.keyboard.press('ArrowDown');
    await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
  }).toPass({ timeout: 8000 });

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await compareHoverAndFocus(page, nav.getByRole('link', { name: 'Filme' }));
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Empfohlen' }).getByRole('link').first(),
  );
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: TILES }).getByRole('link').first(),
  );
  await compareHoverAndFocus(page, cards(page, 'Neu in Filme').first());
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Abspielen' }));
  await compareHoverAndFocus(
    page,
    page.getByRole('button', { name: /^(Favorit|Aus Favoriten entfernen)$/ }),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useConstellation(page);
  await pauseHero(page);
  await expectNoA11yViolations(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Episoden' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.goto('/search?q=ka');
  await expect(page.getByRole('status').filter({ hasText: /\d+ Treffer/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useConstellation(page);
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').first().hover();
  // Leaving the rail folds it again; then the cards are free for the pointer.
  await page.mouse.move(900, 700);
  await cards(page, 'Neu in Filme').first().hover();
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

  test('the hero holds still and the stars do not twinkle', async ({ page }) => {
    await useConstellation(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    const transition = await hero
      .locator('[aria-roledescription="slide"]')
      .first()
      .evaluate((slide) => getComputedStyle(slide.parentElement ?? slide).transitionDuration);
    expect(transition).toBe('0s');
    const twinkle = await page.evaluate(
      () =>
        getComputedStyle(
          document.getElementById('main')?.parentElement ?? document.body,
          '::before',
        ).animationName,
    );
    expect(twinkle).toBe('none');
  });
});
