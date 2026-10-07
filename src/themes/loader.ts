import type { CompleteThemeModule, ThemeId, ThemeManifest, ThemeModule } from './contract';

const modules = new Map<ThemeId, Promise<ThemeModule>>();
let defaultTheme: Promise<CompleteThemeModule> | null = null;

/** Loads a theme chunk once; the same promise is returned on every call (needed by `use`). */
export function loadThemeModule(manifest: ThemeManifest): Promise<ThemeModule> {
  let module = modules.get(manifest.id);
  if (!module) {
    module = manifest.load();
    modules.set(manifest.id, module);
    module.catch(() => modules.delete(manifest.id));
  }
  return module;
}

/** The default theme provides the fallback for every slot. */
export function loadDefaultTheme(): Promise<CompleteThemeModule> {
  defaultTheme ??= import('./default/index').then((module) => module.theme);
  return defaultTheme;
}
