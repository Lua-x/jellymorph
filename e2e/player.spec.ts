import { expect, test, type Page } from '@playwright/test';
import { demoItems, directPlayable, expectNoA11yViolations, signInAs, unwatched } from './helpers';

async function videoState(page: Page) {
  return page.locator('video').evaluate((video: HTMLVideoElement) => ({
    src: video.currentSrc,
    time: video.currentTime,
    paused: video.paused,
  }));
}

/** Without a user gesture the browser may block autoplay; then the big play button starts it. */
async function ensurePlaying(page: Page) {
  const play = page.getByRole('button', { name: 'Abspielen', exact: true });
  await expect(page.getByRole('group', { name: 'Videoplayer' })).toBeVisible();
  await expect
    .poll(async () => {
      if (await play.isVisible()) await play.click();
      return (await videoState(page)).paused;
    })
    .toBe(false);
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Alex');
});

test('plays a movie directly, pauses with the keyboard and saves the position', async ({
  page,
}) => {
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => directPlayable(item) && unwatched(item),
  );
  if (!movie) throw new Error('No unwatched direct play title');
  await page.goto(`/item/${movie.Id}`);
  await page.getByRole('button', { name: 'Abspielen', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/play/${movie.Id}\\?start=0$`));
  await ensurePlaying(page);
  await expect.poll(async () => (await videoState(page)).time).toBeGreaterThan(1.5);
  expect((await videoState(page)).src).toContain(`/Videos/${movie.Id}/stream?static=true`);

  await page.keyboard.press('k');
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
  // On the timeline → jumps 10 s ahead.
  const timeline = page.getByRole('slider', { name: 'Zeitleiste' });
  await timeline.focus();
  const before = Number(await timeline.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  await expect(timeline).toHaveAttribute('aria-valuenow', String(before + 10));

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/Sessions/Playing/Stopped')),
    page.keyboard.press('Escape'),
  ]);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Fortsetzen ab 0:1\d$/ })).toBeVisible();
});

test('switches the audio track to a new stream at the same position', async ({ page }) => {
  const movie = (await demoItems(page, 'Movie')).find(directPlayable);
  if (!movie) throw new Error('No direct play title');
  await page.goto(`/play/${movie.Id}?start=20`);
  await ensurePlaying(page);

  await page.getByRole('button', { name: 'Audio und Untertitel' }).click();
  const menu = page.getByRole('dialog', { name: 'Audio und Untertitel' });
  await menu.getByRole('radio', { name: 'English - AAC Stereo' }).click();
  await menu.getByRole('radio', { name: /Deutsch - SRT/ }).click();

  // hls.js plays the transcoded stream through Media Source Extensions (blob: URL).
  await expect.poll(async () => (await videoState(page)).src).toMatch(/^blob:/);
  await expect.poll(async () => (await videoState(page)).time).toBeGreaterThan(19);
  await expect(menu.getByRole('radio', { name: 'English - AAC Stereo' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((video: HTMLVideoElement) => video.textTracks[0]?.cues?.length),
    )
    .toBe(8);
});

test('skips the intro and moves on to the next episode', async ({ page }) => {
  const episode = (await demoItems(page, 'Episode')).find(directPlayable);
  if (!episode) throw new Error('No direct play episode');
  await page.goto(`/play/${episode.Id}?start=5`);
  await ensurePlaying(page);

  const skip = page.getByRole('button', { name: 'Intro überspringen' });
  await expect(skip).toBeFocused();
  await skip.click();
  await expect.poll(async () => (await videoState(page)).time).toBeGreaterThanOrEqual(15);

  await page.locator('video').evaluate((video: HTMLVideoElement) => {
    video.currentTime = 49;
  });
  const nextUp = page.getByRole('region', { name: 'Nächste Folge' });
  await expect(nextUp).toBeVisible();
  await expect(nextUp.getByRole('timer')).toHaveText(/Startet in \d+ Sekunden?/);
  await nextUp.getByRole('button', { name: 'Jetzt abspielen' }).click();
  await expect(page).not.toHaveURL(new RegExp(episode.Id));
  await expect(page).toHaveURL(/\/play\/\w+\?start=\d+$/);
});

test('falls back to transcoding when the file cannot be decoded', async ({ page }) => {
  const movie = (await demoItems(page, 'Movie')).find(directPlayable);
  if (!movie) throw new Error('No direct play title');
  await page.evaluate(() => {
    localStorage.setItem('jellymorph.demo.faults', 'directPlay');
  });
  await page.goto(`/play/${movie.Id}?start=10`);
  await ensurePlaying(page);
  await expect.poll(async () => (await videoState(page)).src).toMatch(/^blob:/);
  await expect.poll(async () => (await videoState(page)).time).toBeGreaterThanOrEqual(10);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('explains a refused playback and retries', async ({ page }) => {
  const movie = (await demoItems(page, 'Movie')).find(directPlayable);
  if (!movie) throw new Error('No direct play title');
  await page.evaluate(() => {
    localStorage.setItem('jellymorph.demo.faults', 'playbackInfo');
  });
  await page.goto(`/play/${movie.Id}?start=0`);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Serverfehler');
  await expectNoA11yViolations(page);

  await page.evaluate(() => {
    localStorage.removeItem('jellymorph.demo.faults');
  });
  await alert.getByRole('button', { name: 'Erneut versuchen' }).click();
  await ensurePlaying(page);
});

test('asks whether to resume a started movie', async ({ page }) => {
  const movie = (await demoItems(page, 'Movie')).find(
    (item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0 && !item.UserData?.Played,
  );
  if (!movie) throw new Error('No started title');
  const seconds = Math.floor((movie.UserData?.PlaybackPositionTicks ?? 0) / 1e7);
  await page.goto(`/play/${movie.Id}`);
  await expect(page.getByRole('heading', { level: 1, name: movie.Name })).toBeVisible();
  const resume = page.getByRole('button', { name: /^Fortsetzen ab / });
  await expect(resume).toBeFocused();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`\\?start=${String(seconds)}$`));
});

test('the paused player with an open menu is accessible', async ({ page }) => {
  const movie = (await demoItems(page, 'Movie')).find(directPlayable);
  if (!movie) throw new Error('No direct play title');
  await page.goto(`/play/${movie.Id}?start=20`);
  await ensurePlaying(page);
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: 'Abspielen', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Wiedergabe-Einstellungen' }).click();
  await expect(page.getByRole('dialog', { name: 'Wiedergabe-Einstellungen' })).toBeVisible();
  await expectNoA11yViolations(page);
});
