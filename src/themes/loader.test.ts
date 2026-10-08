import i18next from 'i18next';
import { beforeAll, expect, it } from 'vitest';
import { initI18n } from '@/i18n';
import { loadThemeModule } from './loader';
import { getThemeManifest } from './registry';

// As in the app, i18next is set up before any theme loads (app/bootstrap.ts).
beforeAll(async () => {
  await initI18n('de');
});

it('registers the texts of a theme as namespace theme-<id> when it loads', async () => {
  await loadThemeModule(getThemeManifest('neon-grid'));
  expect(i18next.hasResourceBundle('de', 'theme-neon-grid')).toBe(true);
  expect(i18next.hasResourceBundle('en', 'theme-neon-grid')).toBe(true);
  expect(i18next.getResource('en', 'theme-neon-grid', 'boot.skip')).toBe('Skip');
});
