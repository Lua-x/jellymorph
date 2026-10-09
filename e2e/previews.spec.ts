import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { chooseTheme, signInAs, waitForAnimations } from './helpers';

/**
 * Preview images for the theme picker (architecture §7.6): real screenshots of the demo, one
 * per theme and color scheme, written into the theme folder.
 *   npm run previews
 */
const THEMES_DIR = join(import.meta.dirname, '..', 'src', 'themes');
const THEMES = [
  { id: 'default', name: 'Classic', schemes: ['dark', 'light'] as const },
  { id: 'neon-grid', name: 'Neon Grid', schemes: ['dark'] as const },
  { id: 'crimson', name: 'Crimson', schemes: ['dark'] as const },
  { id: 'glass', name: 'Glass', schemes: ['dark', 'light'] as const },
];

test.describe('theme previews @previews', () => {
  for (const theme of THEMES) {
    for (const scheme of theme.schemes) {
      test(`${theme.id} ${scheme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          deviceScaleFactor: 0.5,
          colorScheme: scheme,
          locale: 'de-DE',
          serviceWorkers: 'allow',
        });
        const page = await context.newPage();
        await signInAs(page, 'Alex');
        if (theme.id !== 'default') {
          await chooseTheme(page, theme.name, theme.id);
          await page.goto('/');
        }
        await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
        // Titles of some themes decode themselves after they appear.
        await page.waitForFunction(() => !document.querySelector('[data-active]'));
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await waitForAnimations(page);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: join(THEMES_DIR, theme.id, `preview-${scheme}.jpg`),
          type: 'jpeg',
          quality: 72,
        });
        await context.close();
      });
    }
  }
});
