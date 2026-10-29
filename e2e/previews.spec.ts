import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { chooseTheme, signInAs, waitForAnimations } from './helpers';

/**
 * Preview images for the theme picker (architecture §7.6): real screenshots of the demo, one
 * per theme and color scheme, written into the theme folder.
 *   npm run previews
 */
const THEMES_DIR = join(import.meta.dirname, '..', 'src', 'themes');
/** The example plugin theme keeps its picture next to its theme.json (copied by its build). */
const STARTER_DIR = join(import.meta.dirname, '..', 'theme-starter', 'public');
const THEMES: { id: string; name: string; schemes: readonly ('dark' | 'light')[]; dir?: string }[] =
  [
    { id: 'default', name: 'Classic', schemes: ['dark', 'light'] as const },
    { id: 'neon-grid', name: 'Neon Grid', schemes: ['dark'] as const },
    { id: 'crimson', name: 'Crimson', schemes: ['dark'] as const },
    { id: 'glass', name: 'Glass', schemes: ['dark', 'light'] as const },
    { id: 'horizon', name: 'Horizon', schemes: ['dark'] as const },
    { id: 'constellation', name: 'Constellation', schemes: ['dark'] as const },
    { id: 'cobalt', name: 'Cobalt', schemes: ['dark'] as const },
    { id: 'onyx', name: 'Onyx', schemes: ['dark'] as const },
    { id: 'moon', name: 'Moon', schemes: ['dark'] as const },
    { id: 'starter', name: 'Starter', schemes: ['dark'] as const, dir: STARTER_DIR },
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
          path: join(theme.dir ?? join(THEMES_DIR, theme.id), `preview-${scheme}.jpg`),
          type: 'jpeg',
          quality: 72,
        });
        await context.close();
      });
    }
  }
});
