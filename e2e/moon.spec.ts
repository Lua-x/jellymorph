import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  expectNoA11yViolations,
  layoutAnimations,
  signInAs,
} from './helpers';

/** Theme Moon (phase 18): a title card with numbered tabs, comic panels, slanted buttons. */

async function useMoon(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Moon', 'moon');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bibliotheken' })).toBeVisible();
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

function tabs(page: Page): Locator {
  return page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('list', { name: 'Titel des Tages' })
    .getByRole('button');
}

/** Names of the CSS animations running on the page. */
async function animationNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation)
      .map((animation) => animation.animationName),
  );
}

/** The running progress animation of the current tab, if any. */
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

/** What hover and focus change: the element, its slanted panel (::before) and a card's panel. */
async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const before = getComputedStyle(element, '::before');
    const panel = element.querySelector('[class*="panel"]');
    const panelStyle = panel ? getComputedStyle(panel) : null;
    return {
      background: style.backgroundColor,
      color: style.color,
      transform: style.transform,
      shadow: style.boxShadow,
      beforeBorder: before.borderColor,
      beforeShadow: before.boxShadow,
      beforeTransform: before.transform,
      panelTransform: panelStyle?.transform ?? null,
      panelFilter: panelStyle?.filter ?? null,
    };
  });
}

async function compareHoverAndFocus(page: Page, locator: Locator) {
  await page.mouse.move(0, 0);
  await locator.hover();
  await page.waitForTimeout(400);
  const hovered = await look(locator);
  await page.mouse.move(1, 1);
  await page.keyboard.press('Shift');
  await locator.focus();
  await page.waitForTimeout(400);
  const focused = await look(locator);
  await locator.blur();
  expect(focused).toEqual(hovered);
}

test('the whole app switches to Moon without a reload', async ({ page }) => {
  await useMoon(page);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector('main h2');
    return {
      body: getComputedStyle(document.body).fontFamily,
      heading: heading ? getComputedStyle(heading).fontFamily : '',
    };
  });
  expect(fonts.body).toContain('Chakra Petch');
  expect(fonts.heading).toContain('Anton');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  // The library tiles open their library.
  const tiles = page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link');
  await tiles.first().click();
  await expect(page).toHaveURL(/\/library\//);
});

test('numbered tabs choose titles; a full bar brings the next one with a glitch', async ({
  page,
}) => {
  await useMoon(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const buttons = tabs(page);
  await expect(buttons).toHaveCount(6);
  await expect(buttons.first()).toHaveAttribute('aria-current', 'true');
  await expect(buttons.first()).toContainText('01');
  await buttons.nth(2).click();
  await expect(buttons.nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '3 von 6' })).toBeVisible();
  await expect(hero.getByText('03 / 06')).toBeVisible();
  // Titles not shown are inert (and so not in the accessibility tree).
  await expect(hero.locator('[aria-roledescription="slide"]').first()).toHaveAttribute('inert', '');

  // The bar pauses while the pointer rests on the stage and runs again when it leaves.
  await expect.poll(() => timerState(page)).toBe('paused');
  await page.mouse.move(5, (page.viewportSize()?.height ?? 720) - 5);
  await expect.poll(() => timerState(page)).toBe('running');
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.includes('fill')) {
        animation.finish();
      }
    }
  });
  await expect(buttons.nth(3)).toHaveAttribute('aria-current', 'true');
  // The new title slams in with the color-offset glitch.
  await expect
    .poll(async () => (await animationNames(page)).some((name) => name.includes('glitch')))
    .toBe(true);

  await hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' }).click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timerState(page)).toBeNull();
});

test('cards are comic panels that jump up under the pointer @desktop-only', async ({ page }) => {
  await useMoon(page);
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

  await page.mouse.move(0, 0);
  const resting = await look(poster);
  await poster.hover();
  await expect
    .poll(async () => (await animationNames(page)).some((name) => name.includes('twitch')))
    .toBe(true);
  await page.waitForTimeout(400);
  const lifted = await look(poster);
  expect(lifted.panelTransform).not.toBe(resting.panelTransform);
  // The hard shadow turns yellow.
  expect(lifted.panelFilter).toContain('rgb(255, 200, 0)');
  expect(resting.panelFilter).toContain('rgb(0, 0, 0)');
});

test('film details show the title card, more like this and the details', async ({ page }) => {
  await useMoon(page);
  const movie = (await demoItems(page, 'Movie'))[0];
  if (!movie) throw new Error('No movie in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  const related = page.getByRole('region', { name: 'Mehr wie dieses' });
  await expect(related.getByRole('link').first()).toBeVisible();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details.getByRole('term').filter({ hasText: 'Erschienen' })).toBeVisible();
});

test('series list their episodes with a season picker', async ({ page }) => {
  await useMoon(page);
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
  await expect(episodes.getByRole('button', { name: /abspielen$/ }).first()).toBeVisible();
  const title = episodes.getByRole('listitem').first().getByRole('link');
  const name = await title.textContent();
  await title.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('arrow keys reach the rows; focus looks like hover @desktop-only', async ({ page }) => {
  await useMoon(page);
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
  await compareHoverAndFocus(page, tabs(page).nth(1));
  await compareHoverAndFocus(page, cards(page, 'Neu in Filme').first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link').first(),
  );
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Genres' }).getByRole('link').first(),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useMoon(page);
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
  // Moon uses Classic's search page.
  await page.goto('/search?q=ka');
  await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useMoon(page);
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

  test('the stage neither changes by itself nor glitches', async ({ page }) => {
    await useMoon(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    expect(await timerState(page)).toBeNull();
    await tabs(page).nth(1).click();
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-current', 'true');
    expect((await animationNames(page)).filter((name) => /glitch|slam|twitch/.test(name))).toEqual(
      [],
    );
    const transition = await hero
      .locator('[aria-roledescription="slide"]')
      .first()
      .evaluate((slide) => getComputedStyle(slide).transitionDuration);
    expect(transition).toBe('0s');
  });
});
