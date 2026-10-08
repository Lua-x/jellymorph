import i18next, { type BackendModule, type ReadCallback, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'de';

export const NAMESPACES = [
  'common',
  'auth',
  'content',
  'player',
  'settings',
  'errors',
  'themes',
] as const;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Only the active language is downloaded; every file becomes its own small chunk. */
const loaders = import.meta.glob<{ default: ResourceKey }>('./locales/*/*.json');

const lazyBackend: BackendModule = {
  type: 'backend',
  init() {
    // No options needed.
  },
  read(language: string, namespace: string, callback: ReadCallback) {
    const load = loaders[`./locales/${language}/${namespace}.json`];
    if (!load) {
      callback(new Error(`Missing translations ${language}/${namespace}`), false);
      return;
    }
    load().then(
      (module) => {
        callback(null, module.default);
      },
      (error: unknown) => {
        callback(error instanceof Error ? error : new Error(String(error)), false);
      },
    );
  },
};

export async function initI18n(language: Language): Promise<void> {
  await i18next
    .use(lazyBackend)
    .use(initReactI18next)
    .init({
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: LANGUAGES,
      ns: NAMESPACES,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: true },
    });
  document.documentElement.lang = language;
}

export async function changeLanguage(language: Language): Promise<void> {
  await i18next.changeLanguage(language);
  document.documentElement.lang = language;
}
