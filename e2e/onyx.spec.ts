import { expect, test, type Locator, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  expectNoA11yViolations,
  layoutAnimations,
  signInAs,
  type DemoItem,
} from './helpers';

/** Theme Onyx (phase 16): side panel, tall spotlight, ranked row, upcoming episodes, details. */

async function useOnyx(page: Page) {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Onyx', 'onyx');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Weiterschauen', exact: true })).toBeVisible();
}

function cards(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true }).getByRole('list').getByRole('link');
}

async function openHafenviertel(page: Page) {
  await page.goto('/search?q=Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
}

async function look(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      border: style.borderColor,
      transform: style.transform,
      shadow: style.boxShadow,
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

test('the whole app switches to Onyx without a reload', async ({ page }) => {
  await useOnyx(page);
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return getComputedStyle(document.body).fontFamily;
  });
  expect(font).toContain('Instrument Sans');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await expect(nav.getByRole('link', { name: 'Startseite' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  await expect(hero.getByRole('button', { name: 'Abspielen' })).toBeVisible();
});

test('the side panel holds the navigation with its sections @desktop-only', async ({ page }) => {
  await useOnyx(page);
  const panel = page.getByRole('banner');
  const box = await panel.boundingBox();
  if (!box) throw new Error('not laid out');
  // A fixed panel on the left, the full height of the window.
  expect(box.x).toBe(0);
  expect(box.height).toBeGreaterThan((page.viewportSize()?.height ?? 720) - 2);
  await expect(panel.getByText('Bibliotheken', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Suche' })).toBeVisible();
  await panel.getByRole('link', { name: 'Filme' }).click();
  await expect(page).toHaveURL(/\/library\//);
});

test('the spotlight changes with its dots and stops with the pause button', async ({ page }) => {
  await useOnyx(page);
  const hero = page.getByRole('region', { name: 'Empfohlen' });
  const dots = hero.getByRole('group', { name: 'Empfohlene Titel' }).getByRole('button');
  await expect(dots).toHaveCount(6);
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await dots.nth(2).click();
  await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('group', { name: '3 von 6' })).toBeVisible();
  await expect(hero.locator('[aria-roledescription="slide"]').first()).toHaveAttribute('inert', '');
  await hero.getByRole('button', { name: 'Automatischen Wechsel anhalten' }).click();
  await expect(
    hero.getByRole('button', { name: 'Automatischen Wechsel fortsetzen' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('the ranked row lists the best rated titles in order', async ({ page }) => {
  await useOnyx(page);
  const ranked = page.getByRole('region', { name: 'Am besten bewertet' });
  await ranked.scrollIntoViewIfNeeded();
  const entries = ranked.getByRole('listitem');
  await expect(entries).toHaveCount(10);
  await expect(entries.first().getByText('1', { exact: true })).toBeVisible();
  // The places follow the community rating of every movie and series in the demo.
  const ratings = await page.evaluate(async () => {
    const sessions = JSON.parse(localStorage.getItem('jellymorph.sessions') ?? '[]') as {
      accessToken: string;
    }[];
    const token = sessions[0]?.accessToken ?? '';
    const response = await fetch(
      `/demo-server/Items?includeItemTypes=Movie,Series&recursive=true&ApiKey=${token}`,
    );
    const { Items } = (await response.json()) as {
      Items: { Id: string; CommunityRating?: number }[];
    };
    return Object.fromEntries(Items.map((item) => [item.Id, item.CommunityRating ?? 0]));
  });
  const hrefs = await entries
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  const ranks = hrefs.map((href) => ratings[href.split('/').pop() ?? ''] ?? -1);
  expect(ranks[0]).toBe(Math.max(...Object.values(ratings)));
  expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
});

test('upcoming episodes show their date and have nothing to play', async ({ page }) => {
  await useOnyx(page);
  const upcoming = page.getByRole('region', { name: 'Demnächst', exact: true });
  await upcoming.scrollIntoViewIfNeeded();
  const first = upcoming.getByRole('list').getByRole('link').first();
  await expect(first).toContainText(/Ab \w+\./);
  await expect(first).toContainText('Bald');
  await first.click();
  await expect(page).toHaveURL(/\/item\/u/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abspielen' })).toHaveCount(0);
});

test('series choose seasons with chips and show the episodes in a row', async ({ page }) => {
  await useOnyx(page);
  await openHafenviertel(page);
  const episodes = page.getByRole('region', { name: 'Episoden' });
  const chips = episodes.getByRole('group', { name: 'Staffeln' }).getByRole('button');
  await expect(chips).toHaveCount(3);
  const pressed = episodes.getByRole('button', { pressed: true });
  await expect(pressed).toHaveCount(1);
  const other = chips.filter({ hasNot: page.locator('[aria-pressed="true"]') }).first();
  const otherName = (await other.textContent()) ?? '';
  await chips.filter({ hasText: otherName }).click();
  await expect(page).toHaveURL(/season=/);
  await expect(chips.filter({ hasText: otherName })).toHaveAttribute('aria-pressed', 'true');
  await expect(episodes.getByRole('button', { name: /abspielen$/ }).first()).toBeVisible();
  const title = episodes.getByRole('listitem').first().getByRole('link');
  const name = await title.textContent();
  await title.click();
  await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
});

test('film details show more like this, the extras and the details', async ({ page }) => {
  await useOnyx(page);
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => ((item as DemoItem & { LocalTrailerCount?: number }).LocalTrailerCount ?? 0) > 0,
  );
  if (!movie) throw new Error('No movie with a trailer in the demo');
  await page.goto(`/item/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Mehr wie dieses' }).getByRole('link').first(),
  ).toBeVisible();
  const extras = page.getByRole('region', { name: 'Extras' });
  await expect(extras.getByRole('button', { name: 'Trailer' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Details' })
      .getByRole('term')
      .filter({ hasText: 'Erschienen' }),
  ).toBeVisible();
});

test('arrow keys reach the rows and the panel; focus looks like hover @desktop-only', async ({
  page,
}) => {
  await useOnyx(page);
  await expect(cards(page, 'Weiterschauen').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  const resume = page.getByRole('region', { name: 'Weiterschauen', exact: true });
  await expect(async () => {
    if ((await resume.locator(':focus').count()) === 0) await page.keyboard.press('ArrowDown');
    await expect(resume.locator(':focus')).toHaveCount(1, { timeout: 400 });
  }).toPass({ timeout: 8000 });
  // Left from the first card goes into the side panel.
  const panel = page.getByRole('banner');
  await expect(async () => {
    if ((await panel.locator(':focus').count()) === 0) await page.keyboard.press('ArrowLeft');
    await expect(panel.locator(':focus')).toHaveCount(1, { timeout: 400 });
  }).toPass({ timeout: 8000 });

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
  await compareHoverAndFocus(page, nav.getByRole('link', { name: 'Filme' }));
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Abspielen' }).first());
  await compareHoverAndFocus(page, cards(page, 'Weiterschauen').first());
  await openHafenviertel(page);
  await compareHoverAndFocus(
    page,
    page.getByRole('group', { name: 'Staffeln' }).getByRole('button', { pressed: false }).first(),
  );
});

test('home, details and search are accessible @desktop-only', async ({ page }) => {
  await useOnyx(page);
  await page
    .getByRole('region', { name: 'Empfohlen' })
    .getByRole('button', { name: 'Automatischen Wechsel anhalten' })
    .click();
  await page.mouse.move(400, (page.viewportSize()?.height ?? 720) - 5);
  await expectNoA11yViolations(page);
  await openHafenviertel(page);
  await expectNoA11yViolations(page);
  // Onyx uses Classic's search page.
  await page.goto('/search?q=ka');
  await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('effects only animate transform, opacity and filter @desktop-only', async ({ page }) => {
  await useOnyx(page);
  await cards(page, 'Weiterschauen').first().hover();
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

  test('the spotlight does not change by itself and fades without motion', async ({ page }) => {
    await useOnyx(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const hero = page.getByRole('region', { name: 'Empfohlen' });
    await expect(hero.getByRole('button', { name: /Automatischen Wechsel/ })).toHaveCount(0);
    const transition = await hero
      .locator('[aria-roledescription="slide"]')
      .first()
      .evaluate((slide) => getComputedStyle(slide).transitionDuration);
    expect(transition).toBe('0s');
  });
});
