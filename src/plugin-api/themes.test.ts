import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPluginModule, loadPluginThemes, parsePluginTheme } from './themes';

const valid = {
  id: 'aurora',
  api: 1,
  name: { en: 'Aurora', de: 'Polarlicht', fr: 'ignored' },
  description: { en: 'Green and violet.' },
  version: '2.1.0',
  colorSchemes: ['dark', 'light'],
  preview: { dark: 'preview-dark.jpg', light: 'pictures/preview-light.webp' },
  entry: 'dist/theme.js',
  styles: ['dist/theme.css'],
  features: { uiSounds: true },
};

describe('parsePluginTheme', () => {
  it('turns a valid theme.json into a manifest with addresses in the plugin folder', () => {
    const result = parsePluginTheme('aurora', valid);
    if (!result.ok) throw new Error(result.problem);
    expect(result.value).toMatchObject({
      id: 'aurora',
      plugin: {
        name: { en: 'Aurora', de: 'Polarlicht' },
        description: { en: 'Green and violet.' },
        version: '2.1.0',
        author: null,
      },
      colorSchemes: ['dark', 'light'],
      preview: {
        dark: '/custom/themes/aurora/preview-dark.jpg',
        light: '/custom/themes/aurora/pictures/preview-light.webp',
      },
      features: { uiSounds: true },
    });
    expect(result.value.plugin.name).not.toHaveProperty('fr');
  });

  it.each([
    ['crimson', valid, 'built-in theme'],
    ['aurora', { ...valid, id: 'other' }, 'must be the folder name'],
    ['aurora', { ...valid, api: 2 }, 'not offered'],
    ['aurora', { ...valid, name: { de: 'Nur Deutsch' } }, 'English'],
    ['aurora', { ...valid, colorSchemes: ['sepia'] }, 'colorSchemes'],
    ['aurora', { ...valid, colorSchemes: [] }, 'colorSchemes'],
    ['aurora', { ...valid, preview: { dark: '../../secret.jpg' } }, 'preview.dark'],
    ['aurora', { ...valid, preview: { dark: '/etc/preview.jpg' } }, 'preview.dark'],
    ['aurora', { ...valid, entry: 'theme.mjs' }, 'entry'],
    ['aurora', { ...valid, entry: '.hidden/theme.js' }, 'entry'],
    ['aurora', { ...valid, styles: ['theme.scss'] }, 'styles[0]'],
    ['aurora', 'not an object', 'object'],
  ])('rejects folder %s with %j', (id, raw, problem) => {
    const result = parsePluginTheme(id, raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toContain(problem);
  });
});

describe('checkPluginModule', () => {
  const Hero = () => null;

  it('accepts a module for the current contract and keeps only what it understands', () => {
    const result = checkPluginModule({
      contractVersion: 1,
      components: { Hero },
      options: {
        heroItemCount: 3,
        cardShape: 'landscape',
        layout: { home: ['hero', 'resume', 'resume'], detailActions: ['play'], facts: [] },
      },
      texts: { de: { hello: 'Hallo' } },
    });
    if (!result.ok) throw new Error(result.problem);
    expect(result.value.components.Hero).toBe(Hero);
    expect(result.value.options).toEqual({
      heroItemCount: 3,
      cardShape: 'landscape',
      layout: { home: ['hero', 'resume'], detailActions: ['play'], facts: [] },
    });
  });

  it.each([
    [{ contractVersion: 2, components: {} }, 'contractVersion'],
    [{ contractVersion: 1, components: { Sidebar: Hero } }, '"Sidebar" is not a slot'],
    [{ contractVersion: 1, components: { Hero: 'Hero' } }, 'not a component'],
    [{ contractVersion: 1, components: {}, options: { heroItemCount: 0 } }, 'heroItemCount'],
    [
      { contractVersion: 1, components: {}, options: { detailPresentation: 'drawer' } },
      'detailPresentation',
    ],
    [
      {
        contractVersion: 1,
        components: {},
        options: { layout: { home: ['ads'], detailActions: [], facts: [] } },
      },
      'layout.home',
    ],
    [{ contractVersion: 1, components: {}, texts: { de: 'Hallo' } }, 'texts'],
    [null, 'default'],
  ])('rejects %j', (module, problem) => {
    const result = checkPluginModule(module);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toContain(problem);
  });
});

describe('loadPluginThemes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads every theme.json and leaves out the broken ones with a reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/aurora/')
            ? new Response(JSON.stringify(valid))
            : new Response('missing', { status: 404 }),
        ),
      ),
    );
    const { manifests, problems } = await loadPluginThemes(['aurora', 'ghost']);
    expect(manifests.map((manifest) => manifest.id)).toEqual(['aurora']);
    expect(problems).toEqual(['Plugin theme "ghost" is left out: theme.json answered 404.']);
  });
});
