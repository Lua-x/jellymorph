import 'i18next';
import type auth from './locales/de/auth.json';
import type common from './locales/de/common.json';
import type errors from './locales/de/errors.json';
import type themes from './locales/de/themes.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      errors: typeof errors;
      themes: typeof themes;
    };
  }
}
