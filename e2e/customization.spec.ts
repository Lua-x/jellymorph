import { expect, test, type Page } from './fixtures';
import { chooseTheme, signInAs } from './helpers';

/**
 * Own styles (phase 14): style sheets from the mounted folder /custom. The test server and the
 * container both serve e2e/fixtures/custom there; its files only set marker properties.
 */

function property(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    name,
  );
}

function lastStyleSheets(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() =>
    [...document.head.querySelectorAll('link[rel="stylesheet"]')]
      .slice(-2)
      .map((link) => link.getAttribute('href')),
  );
}

test('custom.css applies everywhere, a theme file only with its theme', async ({ page }) => {
  await signInAs(page, 'Alex');
  await expect.poll(() => property(page, '--jm-custom-all')).toBe('loaded');
  expect(await property(page, '--jm-custom-theme')).toBe('');
  await expect(page.locator('link[data-custom-style="theme"]')).toHaveCount(0);

  await chooseTheme(page, 'Crimson', 'crimson');
  await expect.poll(() => property(page, '--jm-custom-theme')).toBe('crimson');
  // Last in <head>, after the theme's own styles, so equal selectors win.
  expect(await lastStyleSheets(page)).toEqual(['/custom/custom.css', '/custom/crimson.css']);

  await chooseTheme(page, 'Glass', 'glass');
  await expect(page.locator('link[data-custom-style="theme"]')).toHaveCount(0);
  expect(await property(page, '--jm-custom-theme')).toBe('');
  expect(await property(page, '--jm-custom-all')).toBe('loaded');
});

test('only styles, fonts and pictures are served from the folder', async ({ page }) => {
  await page.goto('/');
  expect((await page.request.get('/custom/custom.css')).status()).toBe(200);
  expect((await page.request.get('/custom/not-served.txt')).status()).toBe(404);
});
