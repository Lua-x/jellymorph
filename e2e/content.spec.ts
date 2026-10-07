import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, signInAs } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Alex');
});

async function openLibrary(page: Page, name: string) {
  await page
    .getByRole('region', { name: 'Bibliotheken' })
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function search(page: Page, term: string) {
  await page.goto(`/search?q=${encodeURIComponent(term)}`);
  await expect(page.getByRole('searchbox')).toHaveValue(term);
}

test('home shows the hero, library tiles and rows', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Empfohlen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nächste Folgen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Neu in Filme' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Neu in Anime' })).toBeVisible();
});

test('a library can be sorted, filtered and jumped through', async ({ page }) => {
  await openLibrary(page, 'Filme');
  await expect(page.getByText('56 Titel')).toBeVisible();

  await page.getByRole('button', { name: 'Zu W springen' }).click();
  await expect(page.locator(':focus')).toHaveAccessibleName(/Westwärts/);

  await page.getByLabel('Sortieren nach').selectOption('year');
  await expect(page).toHaveURL(/sort=year/);

  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('button', { name: 'Komödie', pressed: false }).click();
  await expect(page.getByText('56 Titel')).toBeHidden();
  await page.getByRole('button', { name: 'Filter „Komödie“ entfernen' }).click();
  await expect(page.getByText('56 Titel')).toBeVisible();
});

test('favorite and watched state are saved and survive a reload', async ({ page }) => {
  await search(page, 'Kupferherz');
  await page
    .getByRole('region', { name: /^Filme/ })
    .getByRole('link', { name: /Kupferherz/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz' })).toBeVisible();

  const favorite = page.getByRole('button', { name: /Favorit/ });
  const before = await favorite.getAttribute('aria-pressed');
  // The button flips at once (optimistic update); wait until the server has stored it.
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/UserFavoriteItems/')),
    favorite.click(),
  ]);
  const after = before === 'true' ? 'false' : 'true';
  await expect(favorite).toHaveAttribute('aria-pressed', after);
  await page.reload();
  await expect(page.getByRole('button', { name: /Favorit/ })).toHaveAttribute(
    'aria-pressed',
    after,
  );
});

test('a series opens at the next episode and switches seasons', async ({ page }) => {
  await search(page, 'Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hafenviertel' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Staffel 2', selected: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Als Nächstes/ }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Staffel 2' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Staffel 3', selected: true })).toBeFocused();
  await expect(page).toHaveURL(/season=/);
});

test('search groups results by type', async ({ page }) => {
  await page.getByRole('link', { name: 'Suche' }).filter({ visible: true }).click();
  await page.getByRole('searchbox').fill('or');
  await expect(page.getByRole('region', { name: /^Filme/ })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: /^Filme/ })
      .getByRole('link', { name: /Orbit/ })
      .first(),
  ).toBeVisible();
});

test('no content page scrolls sideways', async ({ page }) => {
  const fitsWidth = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
  expect(await fitsWidth()).toBe(true);
  await openLibrary(page, 'Filme');
  expect(await fitsWidth()).toBe(true);
  await search(page, 'Hafenviertel');
  await page
    .getByRole('region', { name: /^Serien/ })
    .getByRole('link', { name: /Hafenviertel/ })
    .click();
  await expect(page.getByRole('region', { name: 'Besetzung' })).toBeVisible();
  expect(await fitsWidth()).toBe(true);
});

test('favorites are listed by type', async ({ page }) => {
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: /^Serien/ }).getByRole('link', { name: /Hafenviertel/ }),
  ).toBeVisible();
});

test.describe('keyboard and accessibility @desktop-only', () => {
  test('arrow keys move through the library grid', async ({ page }) => {
    await openLibrary(page, 'Filme');
    const grid = page.getByRole('list', { name: 'Titel in Filme' });
    const first = grid.getByRole('link').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(grid.locator('[data-item-index="1"] a')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const columns = await grid.locator('[role="listitem"]').evaluateAll((cells) => {
      const top = cells[0]?.getBoundingClientRect().top;
      return cells.filter((cell) => cell.getBoundingClientRect().top === top).length;
    });
    await expect(grid.locator(`[data-item-index="${String(1 + columns)}"] a`)).toBeFocused();
  });

  test('content pages have no WCAG A/AA violations', async ({ page }) => {
    await expect(
      page.getByRole('region', { name: 'Weiterschauen' }).getByRole('link').first(),
    ).toBeVisible();
    await expectNoA11yViolations(page);

    await openLibrary(page, 'Serien');
    await expect(
      page.getByRole('list', { name: 'Titel in Serien' }).getByRole('link').first(),
    ).toBeVisible();
    await expectNoA11yViolations(page);

    await search(page, 'Hafenviertel');
    await expect(page.getByRole('region', { name: /^Serien/ })).toBeVisible();
    await expectNoA11yViolations(page);

    await page
      .getByRole('region', { name: /^Serien/ })
      .getByRole('link', { name: /Hafenviertel/ })
      .click();
    await expect(page.getByRole('tab', { name: 'Staffel 2', selected: true })).toBeVisible();
    await expectNoA11yViolations(page);

    await search(page, 'Kupferherz');
    await page
      .getByRole('region', { name: /^Filme/ })
      .getByRole('link', { name: /Kupferherz/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz' })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.goto('/favorites');
    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
