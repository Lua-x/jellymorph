import 'i18next';
import type auth from './locales/de/auth.json';
import type common from './locales/de/common.json';
import type content from './locales/de/content.json';
import type errors from './locales/de/errors.json';
import type player from './locales/de/player.json';
import type settings from './locales/de/settings.json';
import type themes from './locales/de/themes.json';
import type crimson from '../themes/crimson/i18n/de.json';
import type neonGrid from '../themes/neon-grid/i18n/de.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      content: typeof content;
      player: typeof player;
      settings: typeof settings;
      errors: typeof errors;
      themes: typeof themes;
      'theme-neon-grid': typeof neonGrid;
      'theme-crimson': typeof crimson;
    };
  }
}
