import { expect, test, type Page } from './fixtures';
import { chooseTheme, demoItems, signInAs } from './helpers';

/**
 * Real libraries bring long texts and many entries (phase 12): descriptions with HTML line
 * breaks, a dozen tracks, ten libraries. Every theme keeps them readable.
 */

const THEMES = [
  { name: 'Classic', id: 'default' },
  { name: 'Neon Grid', id: 'neon-grid' },
  { name: 'Crimson', id: 'crimson' },
  { name: 'Glass', id: 'glass' },
  { name: 'Horizon', id: 'horizon' },
  { name: 'Constellation', id: 'constellation' },
] as const;

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await signInAs(page, 'Alex');
  if (theme.id !== 'default') await chooseTheme(page, theme.name, theme.id);
}

for (const theme of THEMES) {
  test(`${theme.name}: long descriptions and track lists are shortened`, async ({ page }) => {
    await useTheme(page, theme);
    const movie = (await demoItems(page, 'Movie')).find((item) => item.Name === 'Kupferherz');
    if (!movie) throw new Error('Kupferherz is missing in the demo');
    await page.goto(`/item/${movie.Id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz' })).toBeVisible();

    // The HTML of the metadata arrives as text with paragraphs, entities decoded.
    const main = page.locator('main');
    await expect(main).not.toContainText('<br>');
    await expect(main).toContainText('Restaurierung & Neuveröffentlichung');

    const more = page.getByRole('button', { name: 'Mehr anzeigen' }).first();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    const less = page.getByRole('button', { name: 'Weniger anzeigen' }).first();
    await expect(less).toHaveAttribute('aria-expanded', 'true');

    if (theme.id === 'horizon') await page.getByRole('tab', { name: 'Details' }).click();
    // Seven sound tracks: three shown, four behind the button; six subtitles: three and three.
    const audio = page.getByRole('button', { name: '+ 4 weitere' });
    await audio.scrollIntoViewIfNeeded();
    await expect(page.getByText('English - Kommentar - AAC Stereo')).toHaveCount(0);
    await audio.click();
    await expect(page.getByText('English - Kommentar - AAC Stereo')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ 3 weitere' })).toBeVisible();
  });
}

const TOP_BARS = THEMES.filter((theme) => theme.id !== 'constellation');

for (const theme of TOP_BARS) {
  test(`${theme.name}: libraries that do not fit move into "Mehr" @desktop-only`, async ({
    page,
  }) => {
    await useTheme(page, theme);
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
    await expect(nav.getByRole('link', { name: 'Filme', exact: true })).toBeVisible();

    // Much wider links stand in for many libraries or long names. Set through the CSSOM: the
    // container's Content Security Policy blocks injected style sheets.
    await page.evaluate(() => {
      for (const link of document.querySelectorAll<HTMLElement>('header nav a')) {
        link.style.setProperty('padding-inline', '4.5rem', 'important');
      }
    });
    const more = nav.getByRole('button', { name: 'Mehr' });
    await expect(more).toBeVisible();
    const list = nav.locator('ul').first();
    const overflow = await list.evaluate((element) => ({
      list: element.scrollWidth - element.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.list).toBeLessThanOrEqual(1);
    expect(overflow.page).toBeLessThanOrEqual(0);
    // Home and favorites stay in the bar; only libraries fold away.
    await expect(nav.getByRole('link', { name: 'Favoriten' })).toBeVisible();

    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator(`[id="${(await more.getAttribute('aria-controls')) ?? ''}"]`);
    const folded = await menu.getByRole('link').allTextContents();
    expect(folded.length).toBeGreaterThan(0);
    for (const name of folded) {
      expect(['Filme', 'Serien', 'Anime', 'Sammlungen']).toContain(name.trim());
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();

    await more.click();
    const target = folded.at(-1)?.trim() ?? '';
    await menu.getByRole('link', { name: target }).click();
    await expect(page.getByRole('heading', { level: 1, name: target })).toBeVisible();
    await expect(menu).toBeHidden();
  });
}
