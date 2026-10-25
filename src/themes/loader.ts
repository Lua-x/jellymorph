import i18next from 'i18next';
import { useToasts } from '@/ui/toast-store';
import type { CompleteThemeModule, ThemeId, ThemeManifest, ThemeModule } from './contract';
import { defaultManifest } from './default/manifest';
import { themeNames } from './names';
import { markPluginFailed } from './registry';

/** React's `use()` reads these fields and skips suspending for promises that already settled. */
type TrackedPromise<T> = Promise<T> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

function track<T>(promise: Promise<T>): Promise<T> {
  const tracked = promise as TrackedPromise<T>;
  tracked.status = 'pending';
  promise.then(
    (value) => {
      tracked.status = 'fulfilled';
      tracked.value = value;
    },
    (reason: unknown) => {
      tracked.status = 'rejected';
      tracked.reason = reason;
    },
  );
  return promise;
}

/** Makes a theme's own texts available as namespace `theme-<id>` before it renders. */
function registerTexts(id: ThemeId, module: ThemeModule): ThemeModule {
  for (const [language, texts] of Object.entries(module.texts ?? {})) {
    i18next.addResourceBundle(language, `theme-${id}`, texts, true, true);
  }
  return module;
}

const modules = new Map<ThemeId, Promise<ThemeModule>>();
let defaultTheme: Promise<CompleteThemeModule> | null = null;

/** Loads a theme chunk once; the same promise is returned on every call (needed by `use`). */
export function loadThemeModule(manifest: ThemeManifest): Promise<ThemeModule> {
  let module = modules.get(manifest.id);
  if (!module) {
    module = track(manifest.load().then((loaded) => registerTexts(manifest.id, loaded)));
    modules.set(manifest.id, module);
    module.catch(() => modules.delete(manifest.id));
  }
  return module;
}

export interface LoadedTheme {
  manifest: ThemeManifest;
  module: ThemeModule;
}

const resolved = new Map<ThemeId, Promise<LoadedTheme>>();

/**
 * The theme to show for a manifest: the theme itself, or Classic when its code cannot be loaded
 * (a broken or incompatible plugin, or a chunk the network lost). Never rejects, so a theme can
 * not take the app down. The outcome is kept for the visit, so a failure is reported once; a failed
 * plugin also leaves the theme list (registry.ts).
 */
export function loadThemeOrClassic(manifest: ThemeManifest): Promise<LoadedTheme> {
  let theme = resolved.get(manifest.id);
  if (!theme) {
    theme = track(
      loadThemeModule(manifest).then(
        (module) => ({ manifest, module }),
        async (error: unknown) => {
          console.error(`[themes] Theme "${manifest.id}" could not be loaded:`, error);
          if (manifest.plugin) markPluginFailed(manifest.id);
          const { name } = themeNames(
            manifest,
            i18next.getFixedT(null, 'themes'),
            i18next.language,
          );
          useToasts
            .getState()
            .show('error', i18next.t('theme.loadFailed', { ns: 'settings', name }));
          return { manifest: defaultManifest, module: await loadDefaultTheme() };
        },
      ),
    );
    resolved.set(manifest.id, theme);
  }
  return theme;
}

/** The default theme provides the fallback for every slot. */
export function loadDefaultTheme(): Promise<CompleteThemeModule> {
  defaultTheme ??= track(
    import('./default/index').then((module) => {
      registerTexts('default', module.theme);
      return module.theme;
    }),
  );
  return defaultTheme;
}
