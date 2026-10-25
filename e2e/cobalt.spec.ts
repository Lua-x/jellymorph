import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  expectNoA11yViolations,
  layoutAnimations,
  signInAs,
} from './helpers';

/** Theme Cobalt (phase 15): title stage with a filmstrip, poster rows, channel tiles, details. */

async function useCobalt(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Cobalt', 'cobalt');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

function filmstrip(page: Page): Locator {
  return page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('list', { name: 'Empfohlene Titel' })
    .getByRole('button');
}

/** The running progress animation of the current title in the filmstrip, if any. */
async function timerState(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const animation = document
      .getAnimations()
      .find(
        (candidate) =>
          candidate instanceof CSSAnimation && candidate.animationName.includes('fill'),
      );
    return animation?.playState ?? null;
  });
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
      opacity: style.opacity,
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

test('the whole app switches to Cobalt without a reload', async ({ page }) => {
  await useCobalt(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Manrope');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  // The channel tiles come right after the stage and open their library.
  const tiles = page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link');
  await expect(tiles.first()).toBeVisible();
  await tiles.first().click();
  await expect(page).toHaveURL(/\/library\//);
});

test('the filmstrip chooses titles and its progress moves the stage on', async ({ page }) => {
  await useCobalt(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const thumbs = filmstrip(page);
  await expect(thumbs).toHaveCount(6);
  await expect(thumbs.first()).toHaveAttribute('aria-current', 'true');
  await thumbs.nth(2).click();
  await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '3 von 6' })).toBeVisible();
  // Titles not shown are inert (and so not in the accessibility tree).
  await expect(hero.locator('[aria-roledescription="slide"]').first()).toHaveAttribute('inert', '');

  // The bar pauses while the pointer rests on the stage and runs again when it leaves.
  await expect.poll(() => timerState(page)).toBe('paused');
  await page.mouse.move(5, (page.viewportSize()?.height ?? 720) - 5);
  await expect.poll(() => timerState(page)).toBe('running');
  // A full bar brings the next title.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.includes('fill')) {
        animation.finish();
      }
    }
  });
  await expect(thumbs.nth(3)).toHaveAttribute('aria-current', 'true');

  await hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' }).click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timerState(page)).toBeNull();
});

test('rows show posters; titles appear with hover and focus @desktop-only', async ({ page }) => {
  await useCobalt(page);
  const poster = cards(page, 'Neu in Filme').first();
  await poster.scrollIntoViewIfNeeded();
  const posterBox = await poster.locator('[data-shape]').boundingBox();
  if (!posterBox) throw new Error('not laid out');
  expect(posterBox.height).toBeGreaterThan(posterBox.width * 1.4);
  const resumeBox = await cards(page, 'Weiterschauen')
    .first()
    .locator('[data-shape]')
    .boundingBox();
  if (!resumeBox) throw new Error('not laid out');
  expect(resumeBox.width).toBeGreaterThan(resumeBox.height * 1.6);

  const caption = poster.locator('[data-reveal]');
  await page.mouse.move(0, 0);
  await expect(caption).toHaveCSS('opacity', '0');
  await poster.hover();
  await expect(caption).toHaveCSS('opacity', '1');
});

test('film details show more like this and the details', async ({ page }) => {
  await useCobalt(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  const related = page.getByRole('region', { name: 'Mehr wie dieses' });
  await expect(related.getByRole('link').first()).toBeVisible();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details.getByRole('term').filter({ hasText: 'Erschienen' })).toBeVisible();
});

test('series list their episodes with a season pill', async ({ page }) => {
  await useCobalt(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  const episodes = page.getByRole('region', { name: 'Episoden' });
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
  await expect(episodes.getByRole('listitem').first()).toBeVisible();
  await expect(episodes.getByRole('button', { name: /abspielen$/ }).first()).toBeVisible();
  const title = episodes.getByRole('listitem').first().getByRole('link');
  const name = await title.textContent();
  await title.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('arrow keys reach the rows; focus looks like hover @desktop-only', async ({ page }) => {
  await useCobalt(page);
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
  await compareHoverAndFocus(page, filmstrip(page).nth(1));
  await compareHoverAndFocus(page, cards(page, 'Neu in Filme').first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link').first(),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useCobalt(page);
  await page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('button', { name: 'Automatischen Wechsel anhalten' })
    .click();
  await page.mouse.move(5, (page.viewportSize()?.height ?? 720) - 5);
  await expectNoA11yViolations(page);
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Episoden' })).toBeVisible();
  await expectNoA11yViolations(page);
  // Cobalt uses Classic's search page.
  await page.goto('/search?q=ka');
  await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useCobalt(page);
  await cards(page, 'Neu in Filme').first().hover();
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await page.goto('/search?q=ka');
  await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
  await page.goto(`/play/${movie.Id}?start=0`);
  await expect(page.getByRole('group', { name: 'Videoplayer' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  expect(await layoutAnimations(page)).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the stage does not change by itself and fades without motion', async ({ page }) => {
    await useCobalt(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    expect(await timerState(page)).toBeNull();
    const transition = await hero
      .locator('[aria-roledescription="slide"]')
      .first()
      .evaluate((slide) => getComputedStyle(slide).transitionDuration);
    expect(transition).toBe('0s');
  });
});
