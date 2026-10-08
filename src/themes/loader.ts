import type { CompleteThemeModule, ThemeId, ThemeManifest, ThemeModule } from './contract';

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

const modules = new Map<ThemeId, Promise<ThemeModule>>();
let defaultTheme: Promise<CompleteThemeModule> | null = null;

/** Loads a theme chunk once; the same promise is returned on every call (needed by `use`). */
export function loadThemeModule(manifest: ThemeManifest): Promise<ThemeModule> {
  let module = modules.get(manifest.id);
  if (!module) {
    module = track(manifest.load());
    modules.set(manifest.id, module);
    module.catch(() => modules.delete(manifest.id));
  }
  return module;
}

/** The default theme provides the fallback for every slot. */
export function loadDefaultTheme(): Promise<CompleteThemeModule> {
  defaultTheme ??= track(import('./default/index').then((module) => module.theme));
  return defaultTheme;
}
