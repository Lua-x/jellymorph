import 'i18next';
import type auth from './locales/de/auth.json';
import type common from './locales/de/common.json';
import type content from './locales/de/content.json';
import type errors from './locales/de/errors.json';
import type player from './locales/de/player.json';
import type settings from './locales/de/settings.json';
import type themes from './locales/de/themes.json';
import type cobalt from '../themes/cobalt/i18n/de.json';
import type constellation from '../themes/constellation/i18n/de.json';
import type crimson from '../themes/crimson/i18n/de.json';
import type glass from '../themes/glass/i18n/de.json';
import type horizon from '../themes/horizon/i18n/de.json';
import type neonGrid from '../themes/neon-grid/i18n/de.json';
import type moonshot from '../themes/moonshot/i18n/de.json';
import type onyx from '../themes/onyx/i18n/de.json';

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
      'theme-glass': typeof glass;
      'theme-horizon': typeof horizon;
      'theme-constellation': typeof constellation;
      'theme-cobalt': typeof cobalt;
      'theme-onyx': typeof onyx;
      'theme-moonshot': typeof moonshot;
    };
  }
}
