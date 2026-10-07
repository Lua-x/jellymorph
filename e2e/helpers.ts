import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const PROFILE_PAGE_HEADING = 'Profil auswählen';

/** Opens the app in demo mode and waits until the first screen is interactive. */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.boot-splash')).toHaveCount(0, { timeout: 15_000 });
}

export async function signInAs(page: Page, name: string, password?: string): Promise<void> {
  await openApp(page);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  if (password !== undefined) {
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: `Hallo, ${name}!` })).toBeVisible();
}

export async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Benutzermenü/ }).click();
}

/** Waits until all finite animations (entrances, fades) are done; ambient loops are ignored. */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every((animation) => animation.playState === 'finished'),
  );
}

/** Fails with the list of WCAG A/AA violations, if any. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  // Mid-animation text is semi-transparent and would fail the contrast check.
  await waitForAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(violations).toEqual([]);
}
