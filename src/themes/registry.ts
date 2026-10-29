import { create } from 'zustand';
import { cobaltManifest } from './cobalt/manifest';
import { constellationManifest } from './constellation/manifest';
import type { BuiltInThemeManifest, PluginThemeManifest, ThemeId, ThemeManifest } from './contract';
import { crimsonManifest } from './crimson/manifest';
import { defaultManifest } from './default/manifest';
import { glassManifest } from './glass/manifest';
import { horizonManifest } from './horizon/manifest';
import { moonManifest } from './moon/manifest';
import { neonGridManifest } from './neon-grid/manifest';
import { onyxManifest } from './onyx/manifest';

/** The themes that ship with the app. Adding a theme = a new folder plus one entry here. */
export const BUILT_IN_THEMES: readonly BuiltInThemeManifest[] = [
  defaultManifest,
  neonGridManifest,
  crimsonManifest,
  glassManifest,
  horizonManifest,
  constellationManifest,
  cobaltManifest,
  onyxManifest,
  moonManifest,
];

let pluginThemes: readonly PluginThemeManifest[] = [];

/** Plugin themes from the container's folder, registered once before the first render. */
export function registerPluginThemes(manifests: readonly PluginThemeManifest[]) {
  pluginThemes = manifests;
}

/**
 * Plugin themes whose code failed to load in this visit (themes/loader.ts). They leave the list
 * and show as Classic; components that pick a theme subscribe, so they update right away.
 */
export const usePluginFailures = create<{ failed: ReadonlySet<ThemeId> }>()(() => ({
  failed: new Set(),
}));

export function markPluginFailed(id: ThemeId) {
  const { failed } = usePluginFailures.getState();
  if (!failed.has(id)) usePluginFailures.setState({ failed: new Set([...failed, id]) });
}

/** Built-in themes first, then the installed plugin themes that work. */
export function allThemes(): readonly ThemeManifest[] {
  const { failed } = usePluginFailures.getState();
  return [...BUILT_IN_THEMES, ...pluginThemes.filter((theme) => !failed.has(theme.id))];
}

/** The theme with this id, or Classic when there is none (e.g. a plugin that was removed). */
export function getThemeManifest(id: ThemeId): ThemeManifest {
  return allThemes().find((theme) => theme.id === id) ?? defaultManifest;
}
