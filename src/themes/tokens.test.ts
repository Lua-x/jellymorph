import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '@/config/theme-ids';
import { CONTRAST_PAIRS, REQUIRED_TOKENS } from './contract';
import { THEMES } from './registry';

const tokenFiles = import.meta.glob<string>('./*/tokens.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const globalFiles = import.meta.glob<string>('./*/global.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Custom properties per selector block. */
function blocks(css: string): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    const properties = new Map<string, string>();
    for (const declaration of (match[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      properties.set(declaration[1] ?? '', (declaration[2] ?? '').trim());
    }
    result.set(selector, properties);
  }
  return result;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (char) => char + char) : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Unsupported color for contrast check: ${hex}`);
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('theme "%s"', (id, theme) => {
  const css = tokenFiles[`./${id}/tokens.css`];

  it('has a tokens.css', () => {
    expect(css).toBeTypeOf('string');
  });

  const parsed = blocks(css ?? '');
  const base = parsed.get(`[data-theme='${id}']`) ?? new Map<string, string>();

  for (const scheme of theme.colorSchemes) {
    // The base block holds the first scheme; other schemes override on top of it.
    const override =
      scheme === theme.colorSchemes[0]
        ? new Map<string, string>()
        : (parsed.get(`[data-theme='${id}'][data-color-scheme='${scheme}']`) ??
          new Map<string, string>());
    const tokens = new Map<string, string>([...base, ...override]);

    it(`defines every required token for the ${scheme} scheme`, () => {
      const missing = REQUIRED_TOKENS.filter((token) => !tokens.has(token));
      expect(missing).toEqual([]);
    });

    for (const { foreground, background, minimum } of CONTRAST_PAIRS) {
      it(`${scheme}: ${foreground} on ${background} reaches ${minimum}:1`, () => {
        const ratio = contrast(tokens.get(foreground) ?? '', tokens.get(background) ?? '');
        expect(ratio).toBeGreaterThanOrEqual(minimum);
      });
    }
  }

  it('scopes every global rule to the theme', () => {
    const globalCss = stripComments(globalFiles[`./${id}/global.css`] ?? '');
    const selectors = [...globalCss.matchAll(/([^{}]+)\{/g)].flatMap((match) =>
      (match[1] ?? '').split(',').map((selector) => selector.trim()),
    );
    const scopes = [`[data-theme='${id}']`, `:where([data-theme='${id}'])`];
    const unscoped = selectors.filter(
      (selector) => !scopes.some((scope) => selector.startsWith(scope)),
    );
    expect(unscoped).toEqual([]);
  });
});

it('registers only known theme ids', () => {
  for (const theme of THEMES) expect(THEME_IDS).toContain(theme.id);
});
