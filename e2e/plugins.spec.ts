import { expect, test, type Page } from './fixtures';
import { chooseTheme, expectNoA11yViolations, openUserMenu, signInAs } from './helpers';

/**
 * Plugin themes (phase 17) from e2e/fixtures/custom/themes, served like the container's folder
 * with THEME_PLUGINS=true: "starter" is the example of theme-starter/ (built by
 * scripts/build-starter.ts), "broken" has a module for an unknown contract, "future" needs a
 * plugin interface this app does not offer.
 */

async function openThemes(page: Page) {
  await openUserMenu(page);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  return page.getByRole('radiogroup', { name: 'Theme' });
}

test('plugin themes are listed with a badge; incompatible ones are left out', async ({ page }) => {
  await signInAs(page, 'Alex');
  const themes = await openThemes(page);
  const starter = themes.getByRole('radio', { name: /^Starter/ });
  await expect(starter).toContainText('Plugin');
  await expect(starter).toContainText('warmes Bernstein');
  await expect(starter.locator('img')).toHaveAttribute(
    'src',
    '/custom/themes/starter/preview-dark.jpg',
  );
  await expect(themes.getByRole('radio', { name: /^Classic/ })).not.toContainText('Plugin');
  await expect(themes.getByRole('radio', { name: /future/i })).toHaveCount(0);
});

test('a plugin theme draws its own slots and Classic the rest, in its colors', async ({ page }) => {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Starter', 'starter');
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'Tipp des Tages' });
  await expect(hero.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Details' })).toBeVisible();
  // Classic's rows show the plugin's cards.
  await expect(
    page
      .getByRole('region', { name: 'Weiterschauen', exact: true })
      .locator('[class*="starter__card"]')
      .first(),
  ).toBeVisible();
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim(),
  );
  expect(background).toBe('#14110f');
  // React, the texts and the building blocks come from the app, the theme from its folder.
  const scripts = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  );
  expect(scripts).toContain('/custom/themes/starter/index.js');
  expect(scripts).toContain('/plugin-api/v1/jellymorph.js');

  // The choice is stored like any other theme.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'starter');
  await expect(hero).toBeVisible();

  // A page the plugin leaves out is Classic's.
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
});

test('a broken plugin is reported and Classic stays', async ({ page }) => {
  await signInAs(page, 'Alex');
  const themes = await openThemes(page);
  await themes.getByRole('radio', { name: /Kaputtes Plugin/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Das Theme „Kaputtes Plugin“ konnte nicht geladen werden',
  );
  // It leaves the list; the app keeps its theme.
  await expect(themes.getByRole('radio', { name: /Kaputtes Plugin/ })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'default');
  await expect(themes.getByRole('radio', { name: /^Starter/ })).toBeVisible();
});

test('a plugin theme is accessible @desktop-only', async ({ page }) => {
  await signInAs(page, 'Alex');
  await chooseTheme(page, 'Starter', 'starter');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Tipp des Tages' })).toBeVisible();
  await expectNoA11yViolations(page);
});
