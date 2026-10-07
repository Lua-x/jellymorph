import { expect, test } from '@playwright/test';
import {
  expectNoA11yViolations,
  expectSignedIn,
  openApp,
  openUserMenu,
  PROFILE_PAGE_HEADING,
  signInAs,
} from './helpers';

test('signs in with a profile without password and shows the supported libraries', async ({
  page,
}) => {
  await signInAs(page, 'Alex');
  const libraries = page.getByRole('region', { name: 'Bibliotheken' });
  await expect(libraries.getByRole('link', { name: /Anime/ })).toBeVisible();
  await expect(libraries.getByRole('link', { name: /Sammlungen/ })).toBeVisible();
  await expect(libraries.getByRole('link', { name: /Musik/ })).toHaveCount(0);
  await expect(page).toHaveTitle('Startseite · Jellymorph');
});

test('asks for the password of protected profiles', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^Mika/ }).click();
  await expect(page).toHaveURL(/\/login\/password\?user=Mika$/);
  await expect(page.getByLabel('Benutzername')).toHaveValue('Mika');
  await expect(page.getByLabel('Passwort', { exact: true })).toBeFocused();

  await page.getByLabel('Passwort', { exact: true }).fill('falsch');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Benutzername oder Passwort ist falsch.')).toBeVisible();

  await page.getByLabel('Passwort', { exact: true }).fill('demo');
  await page.keyboard.press('Enter');
  await expectSignedIn(page, 'Mika');
});

test('signs in a user who is not listed publicly', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Anderer Benutzer' }).click();
  await page.getByLabel('Benutzername').fill('Robin');
  await page.getByLabel('Passwort', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expectSignedIn(page, 'Robin');
});

test('signs in with Quick Connect', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Mit Quick Connect anmelden' }).click();
  await expect(page.getByText(/^Code: \d \d \d \d \d \d$/)).toBeAttached();
  await expect(page.getByText('Warte auf Bestätigung …')).toBeVisible();
  // The demo server approves the code automatically after a few seconds.
  await expectSignedIn(page, 'Alex', 15_000);
});

test('remembers profiles and keeps the session after a reload', async ({ page }) => {
  await signInAs(page, 'Mika', 'demo');
  await page.reload();
  await expectSignedIn(page, 'Mika');

  await openUserMenu(page);
  await page.getByRole('button', { name: 'Profil wechseln' }).click();
  await expect(page.getByRole('heading', { name: PROFILE_PAGE_HEADING })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mika auf diesem Gerät vergessen' })).toBeVisible();

  await page.getByRole('button', { name: 'Mika', exact: true }).click();
  await expectSignedIn(page, 'Mika');
});

test('signing out ends the session and stores no password', async ({ page }) => {
  await signInAs(page, 'Kim', 'demo');
  const stored = await page.evaluate(() =>
    JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
  );
  expect(stored).not.toContain('"demo"');

  await openUserMenu(page);
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: PROFILE_PAGE_HEADING })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kim auf diesem Gerät vergessen' })).toHaveCount(0);
});

test('returns to the requested page after signing in', async ({ page }) => {
  await openApp(page, '/does-not-exist');
  await page.getByRole('button', { name: 'Alex' }).click();
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  await page.getByRole('button', { name: 'Zur Startseite' }).click();
  await expectSignedIn(page, 'Alex');
});

test('switches the language', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a profile' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose a profile' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test.describe('keyboard and accessibility @desktop-only', () => {
  test('the whole sign-in works with the keyboard alone', async ({ page }) => {
    await openApp(page);
    const kim = page.getByRole('button', { name: /^Kim/ });
    await expect(kim).toBeVisible();
    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press('Tab');
      if (await kim.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(kim).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Passwort', { exact: true })).toBeFocused();
    await page.keyboard.type('demo');
    await page.keyboard.press('Enter');
    await expectSignedIn(page, 'Kim');

    const menuButton = page.getByRole('button', { name: /Benutzermenü/ });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('focus is at least as visible as hover', async ({ page }) => {
    await openApp(page);
    const profile = page.getByRole('button', { name: 'Alex' });
    const avatar = profile.locator('span').first();
    await profile.hover();
    const hovered = await avatar.evaluate((element) => getComputedStyle(element).boxShadow);
    await page.mouse.move(0, 0);
    await profile.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(profile).toBeFocused();
    const focused = await avatar.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(hovered).not.toBe('none');
    expect(focused).toBe(hovered);
  });

  test('sign-in screens and home have no WCAG A/AA violations', async ({ page }) => {
    await openApp(page);
    await expectNoA11yViolations(page);
    await page.getByRole('button', { name: /^Mika/ }).click();
    await expect(page.getByLabel('Passwort', { exact: true })).toBeFocused();
    await expectNoA11yViolations(page);
    await page.getByRole('button', { name: 'Mit Quick Connect anmelden' }).click();
    await expect(page.getByText('Warte auf Bestätigung …')).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole('button', { name: 'Mit Passwort anmelden' }).click();
    await page.getByLabel('Benutzername').fill('Alex');
    await page.keyboard.press('Enter');
    await expectSignedIn(page, 'Alex');
    await expect(
      page.getByRole('region', { name: 'Bibliotheken' }).getByRole('link', { name: /Filme/ }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
