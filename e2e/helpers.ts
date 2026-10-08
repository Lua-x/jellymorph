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
  await expectSignedIn(page, name);
}

/** The user menu button names the signed-in user once the app shell is shown. */
export async function expectSignedIn(page: Page, name: string, timeout = 10_000): Promise<void> {
  await expect(page.getByRole('button', { name: `${name} – Benutzermenü` })).toBeVisible({
    timeout,
  });
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

export interface DemoItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesId?: string;
  MediaStreams?: { Type: string; Codec: string; IsDefault: boolean }[];
  UserData?: { PlaybackPositionTicks: number; Played: boolean };
}

/** Asks the demo server (running in the page) for titles, like the app would. */
export async function demoItems(page: Page, type: 'Movie' | 'Episode'): Promise<DemoItem[]> {
  return page.evaluate(async (itemType) => {
    const sessions = JSON.parse(localStorage.getItem('jellymorph.sessions') ?? '[]') as {
      accessToken: string;
    }[];
    const token = sessions[0]?.accessToken ?? '';
    const response = await fetch(
      `/demo-server/Items?includeItemTypes=${itemType}&recursive=true&sortBy=SortName&ApiKey=${token}`,
    );
    return ((await response.json()) as { Items: DemoItem[] }).Items;
  }, type);
}

/** H.264 with AAC sound and no default subtitles: plays directly in Chromium. */
export function directPlayable(item: DemoItem): boolean {
  const streams = item.MediaStreams ?? [];
  return (
    streams[0]?.Codec === 'h264' &&
    streams.some(
      (stream) => stream.Type === 'Audio' && stream.IsDefault && stream.Codec === 'aac',
    ) &&
    !streams.some((stream) => stream.Type === 'Subtitle' && stream.IsDefault)
  );
}

export const unwatched = (item: DemoItem) =>
  item.UserData?.PlaybackPositionTicks === 0 && !item.UserData.Played;
