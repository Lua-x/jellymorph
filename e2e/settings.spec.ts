import { expect, test, type Locator, type Page } from './fixtures';
import { expectNoA11yViolations, signInAs } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Alex');
});

async function openSettings(page: Page) {
  await page.getByRole('button', { name: /Benutzermenü/ }).click();
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
}

/** Waits for the save that contains `value` (an earlier save of the defaults may come first). */
async function settingsSaved(page: Page, value: string) {
  await page.waitForResponse(
    (response) =>
      response.url().includes('/DisplayPreferences/settings') &&
      response.request().method() === 'POST' &&
      (response.request().postData() ?? '').includes(value),
  );
}

test('the color scheme applies at once and is kept after a reload', async ({ page }) => {
  await openSettings(page);
  const scheme = page.getByRole('radiogroup', { name: 'Farbschema', exact: true });
  await Promise.all([
    settingsSaved(page, '"jellymorph.colorScheme":"light"'),
    scheme.getByRole('radio', { name: 'Hell' }).click(),
  ]);
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await expect(page.getByText('Gespeichert – auch für deine anderen Geräte')).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await expect(scheme.getByRole('radio', { name: 'Hell' })).toHaveAttribute('aria-checked', 'true');
});

test('the language changes the whole interface', async ({ page }) => {
  await openSettings(page);
  await page.getByLabel('Sprache der Oberfläche').selectOption('en');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the settings page is accessible in both color schemes @desktop-only', async ({ page }) => {
  await openSettings(page);
  await expectNoA11yViolations(page);
  await page
    .getByRole('radiogroup', { name: 'Farbschema', exact: true })
    .getByRole('radio', { name: 'Hell' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await expectNoA11yViolations(page);
});

test('arrow keys alone reach a title, open it and come back @desktop-only', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Abspielen' }).first()).toBeFocused();
  // Hero → library tiles → "Continue watching".
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const resume = page.getByRole('region', { name: 'Weiterschauen' });
  const focused = resume.locator(':focus');
  await expect(focused).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(resume.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/item\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region', { name: 'Weiterschauen' })).toBeVisible();
});

test.describe('TV mode', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('enlarges the interface and offers the overscan margin @desktop-only', async ({ page }) => {
    await openSettings(page);
    const fontSize = () =>
      page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
    const before = await fontSize();
    await page
      .getByRole('radiogroup', { name: 'Bedienmodus' })
      .getByRole('radio', { name: 'Fernseher' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-device', 'tv');
    expect(await fontSize()).toBe(24);
    expect(before).toBeLessThan(24);
    const overscan = page.getByRole('slider', { name: 'Bildrand für Fernseher' });
    await expect(overscan).toHaveValue('3');
    await overscan.fill('5');
    await expect(page.locator('html')).toHaveAttribute('style', /--overscan: 0.05/);
  });
});

/** Background, text color and transform: what hover changes must also change on focus. */
async function visualState(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, transform: style.transform };
  });
}

async function compareHoverAndFocus(page: Page, locator: Locator) {
  await page.mouse.move(0, 0);
  await locator.hover();
  await page.waitForTimeout(400);
  const hovered = await visualState(locator);
  await page.mouse.move(1, 1);
  await page.keyboard.press('Shift');
  await locator.focus();
  await page.waitForTimeout(400);
  const focused = await visualState(locator);
  await locator.blur();
  expect(focused).toEqual(hovered);
}

test('focus looks like hover on the main controls @desktop-only', async ({ page }) => {
  // The library links load later and move the other navigation links.
  await expect(
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: /^Filme/ }),
  ).toBeVisible();
  await compareHoverAndFocus(
    page,
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Suche' }),
  );
  await compareHoverAndFocus(page, page.getByRole('link', { name: 'Details' }).first());
  await compareHoverAndFocus(
    page,
    page.getByRole('region', { name: 'Weiterschauen' }).getByRole('link').first(),
  );
  await openSettings(page);
  await compareHoverAndFocus(
    page,
    page.getByRole('radiogroup', { name: 'Bewegung' }).getByRole('radio', { name: 'Reduziert' }),
  );
  await compareHoverAndFocus(
    page,
    page.getByRole('switch', { name: 'Trailer automatisch abspielen' }),
  );
  await compareHoverAndFocus(page, page.getByRole('button', { name: 'Profil wechseln' }));
});

test('animations and transitions only touch transform, opacity and filter @desktop-only', async ({
  page,
}) => {
  // Visit the pages so their (lazy) styles are loaded.
  await page
    .getByRole('region', { name: 'Bibliotheken' })
    .getByRole('link', { name: /^Filme/ })
    .click();
  await expect(page.getByText('56 Titel')).toBeVisible();
  await page.goto('/search?q=Kupferherz');
  await page
    .getByRole('region', { name: /^Filme/ })
    .getByRole('link', { name: /Kupferherz/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kupferherz' })).toBeVisible();
  await openSettings(page);

  const offenders = await page.evaluate(() => {
    const allowed = new Set(['transform', 'opacity', 'filter', 'translate', 'scale', 'rotate']);
    const found: string[] = [];
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule) {
          for (const frame of rule.cssRules) {
            const style = (frame as CSSKeyframeRule).style;
            for (let index = 0; index < style.length; index += 1) {
              const property = style.item(index);
              if (!allowed.has(property)) found.push(`@keyframes ${rule.name}: ${property}`);
            }
          }
        } else if (rule instanceof CSSStyleRule) {
          const properties = rule.style.transitionProperty;
          if (properties && rule.style.transitionDuration !== '0s') {
            for (const property of properties.split(',').map((value) => value.trim())) {
              if (property && !allowed.has(property) && property !== 'none')
                found.push(`${rule.selectorText}: transition ${property}`);
            }
          }
        }
        if ('cssRules' in rule && !(rule instanceof CSSKeyframesRule)) {
          visit((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {
        // Cross-origin sheets (fonts) cannot be read and contain no animations.
      }
    }
    return found;
  });
  expect(offenders).toEqual([]);
});
