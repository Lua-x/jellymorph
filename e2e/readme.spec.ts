import { join } from 'node:path';
import { expect, test, type Page } from './fixtures';
import { chooseTheme, signInAs } from './helpers';

/**
 * Pictures of every theme for the README (`npm run readme-shots`). They are checked in under
 * docs/screenshots, so they stay small: 1280×800 as JPEG.
 */

const OUTPUT = join(import.meta.dirname, '..', 'docs', 'screenshots');

test.use({ viewport: { width: 1280, height: 800 } });

async function settle(page: Page) {
  await page.mouse.move(1279, 799);
  await page.waitForFunction(() =>
    [...document.images].every((image) => {
      if (image.complete) return true;
      const rect = image.getBoundingClientRect();
      return rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0;
    }),
  );
  await page.waitForTimeout(900);
}

async function save(page: Page, name: string) {
  await page.screenshot({ path: join(OUTPUT, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

/** Holds a rotating hero on its first title, where the theme has one. */
async function holdHero(page: Page) {
  const pause = page.getByRole('button', { name: 'Automatischen Wechsel anhalten' });
  if ((await pause.count()) > 0) await pause.first().click();
}

async function home(page: Page, id: string) {
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Weiterschauen', exact: true }).getByRole('link').first(),
  ).toBeVisible();
  await holdHero(page);
  await settle(page);
  await save(page, `${id}-home`);
}

async function openFromSearch(page: Page, term: string, group: string) {
  await page.goto(`/search?q=${encodeURIComponent(term)}`);
  await page
    .getByRole('region', { name: new RegExp(`^${group}`) })
    .getByRole('link', { name: new RegExp(term) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: term })).toBeVisible();
}

test.describe('README pictures @readme', () => {
  test('Classic', async ({ page }) => {
    await signInAs(page, 'Alex');
    await home(page, 'classic');
    await openFromSearch(page, 'Hafenviertel', 'Serien');
    await settle(page);
    await save(page, 'classic-series');
  });

  test('Neon Grid', async ({ page }) => {
    await signInAs(page, 'Alex');
    await chooseTheme(page, 'Neon Grid', 'neon-grid');
    await home(page, 'neon-grid');
    await openFromSearch(page, 'Kupferherz', 'Filme');
    await settle(page);
    await save(page, 'neon-grid-movie');
  });

  test('Crimson', async ({ page }) => {
    await signInAs(page, 'Alex');
    await chooseTheme(page, 'Crimson', 'crimson');
    await home(page, 'crimson');
    const card = page
      .getByRole('region', { name: 'Neu in Filme', exact: true })
      .getByRole('list')
      .getByRole('link')
      .nth(1);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect(page.getByRole('group', { name: /^Vorschau/ })).toBeVisible();
    await page.waitForTimeout(900);
    await save(page, 'crimson-preview');
  });

  test('Glass', async ({ page }) => {
    await signInAs(page, 'Alex');
    await chooseTheme(page, 'Glass', 'glass');
    await home(page, 'glass');
    await page.goto('/settings');
    await page
      .getByRole('radiogroup', { name: 'Farbschema', exact: true })
      .getByRole('radio', { name: 'Hell' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    await openFromSearch(page, 'Hafenviertel', 'Serien');
    // The light page below the (always dark) stage: episodes at the top of the picture.
    await page.getByRole('heading', { name: 'Episoden' }).evaluate((heading) => {
      window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 110);
    });
    await settle(page);
    await save(page, 'glass-series-light');
  });

  test('Horizon', async ({ page }) => {
    await signInAs(page, 'Alex');
    await chooseTheme(page, 'Horizon', 'horizon');
    await home(page, 'horizon');
    const card = page
      .getByRole('region', { name: 'Neu in Filme', exact: true })
      .getByRole('list')
      .getByRole('link')
      .nth(1);
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.25);
    });
    await card.hover();
    await expect(page.getByRole('group', { name: /^Mehr zu / })).toBeVisible();
    await page.waitForTimeout(900);
    await save(page, 'horizon-card');
  });

  test('Constellation', async ({ page }) => {
    await signInAs(page, 'Alex');
    await chooseTheme(page, 'Constellation', 'constellation');
    await home(page, 'constellation');
    await openFromSearch(page, 'Hafenviertel', 'Serien');
    await settle(page);
    await save(page, 'constellation-series');
  });
});
