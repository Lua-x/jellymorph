import { expect, test, type Page } from './fixtures';
import {
  chooseTheme,
  demoItems,
  directPlayable,
  expectNoA11yViolations,
  signInAs,
} from './helpers';

/**
 * Accessibility audit (phase 11): every page in every theme, including the pages the themes take
 * over from Classic, the player with an open menu and the light schemes. The theme specs cover
 * home, details and search in more depth.
 */

const THEMES = [
  { name: 'Classic', id: 'default', scheme: 'dark' },
  { name: 'Classic', id: 'default', scheme: 'light' },
  { name: 'Neon Grid', id: 'neon-grid', scheme: 'dark' },
  { name: 'Crimson', id: 'crimson', scheme: 'dark' },
  { name: 'Glass', id: 'glass', scheme: 'dark' },
  { name: 'Glass', id: 'glass', scheme: 'light' },
  { name: 'Horizon', id: 'horizon', scheme: 'dark' },
  { name: 'Constellation', id: 'constellation', scheme: 'dark' },
  { name: 'Cobalt', id: 'cobalt', scheme: 'dark' },
  { name: 'Onyx', id: 'onyx', scheme: 'dark' },
] as const;

interface Listed {
  Id: string;
}

/** Ids from the demo server running in the page. */
async function demoIds(page: Page, path: string): Promise<string[]> {
  return page.evaluate(async (query) => {
    const sessions = JSON.parse(localStorage.getItem('jellymorph.sessions') ?? '[]') as {
      accessToken: string;
    }[];
    const token = sessions[0]?.accessToken ?? '';
    const separator = query.includes('?') ? '&' : '?';
    const response = await fetch(`/demo-server${query}${separator}ApiKey=${token}`);
    const body = (await response.json()) as { Items: Listed[] };
    return body.Items.map((item) => item.Id);
  }, path);
}

async function firstId(page: Page, path: string): Promise<string> {
  const [id] = await demoIds(page, path);
  if (!id) throw new Error(`Nothing at ${path}`);
  return id;
}

async function audit(page: Page, path: string, ready: () => Promise<void>) {
  await page.goto(path);
  await ready();
  await page.mouse.move(1, 1);
  await expectNoA11yViolations(page);
}

for (const theme of THEMES) {
  test(`${theme.name} (${theme.scheme}): every page passes axe @desktop-only`, async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'Alex');
    if (theme.id !== 'default') await chooseTheme(page, theme.name, theme.id);
    if (theme.scheme === 'light') {
      await page.goto('/settings');
      await page
        .getByRole('radiogroup', { name: 'Farbschema', exact: true })
        .getByRole('radio', { name: 'Hell' })
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    }
    const heading = (name: string | RegExp) => async () => {
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    };
    const filled = async () => {
      await expect(page.locator('main').getByRole('link').first()).toBeVisible();
    };

    const library = await page.evaluate(async () => {
      const sessions = JSON.parse(localStorage.getItem('jellymorph.sessions') ?? '[]') as {
        accessToken: string;
        userId: string;
      }[];
      const session = sessions[0];
      const response = await fetch(
        `/demo-server/UserViews?userId=${session?.userId ?? ''}&ApiKey=${session?.accessToken ?? ''}`,
      );
      const body = (await response.json()) as { Items: { Id: string; Name: string }[] };
      return body.Items.find((view) => view.Name === 'Filme')?.Id ?? null;
    });
    if (!library) throw new Error('No film library in the demo');
    await audit(page, `/library/${library}`, async () => {
      await heading('Filme')();
      await filled();
    });
    const collection = await firstId(page, '/Items?includeItemTypes=BoxSet&recursive=true');
    await audit(page, `/collection/${collection}`, filled);
    const genre = await firstId(page, '/Genres');
    await audit(page, `/genre/${genre}`, filled);
    const person = await firstId(page, '/Persons');
    await audit(page, `/person/${person}`, filled);
    await audit(page, '/favorites', heading('Favoriten'));
    await audit(page, '/search', async () => {
      await expect(page.getByRole('searchbox')).toBeVisible();
    });
    await audit(page, '/settings', heading('Einstellungen'));

    const movie = (await demoItems(page, 'Movie')).find(directPlayable);
    if (!movie) throw new Error('No direct play title in the demo');
    await page.goto(`/play/${movie.Id}?start=20`);
    const player = page.getByRole('group', { name: 'Videoplayer' });
    await expect(player).toBeVisible();
    await expect
      .poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.readyState))
      .toBeGreaterThanOrEqual(2);
    await page.locator('video').evaluate((video: HTMLVideoElement) => {
      video.pause();
    });
    await expect(player).toHaveAttribute('data-status', 'paused');
    await expectNoA11yViolations(page);
    await player.getByRole('button', { name: 'Audio und Untertitel' }).click();
    await expect(page.getByRole('dialog', { name: 'Audio und Untertitel' })).toBeVisible();
    await expectNoA11yViolations(page);
  });
}
