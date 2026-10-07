import type { ThemeId, ThemeManifest } from './contract';
import { defaultManifest } from './default/manifest';

/** Every available theme. Adding a theme = a new folder plus one entry here. */
export const THEMES: readonly ThemeManifest[] = [defaultManifest];

export function getThemeManifest(id: ThemeId): ThemeManifest {
  return THEMES.find((theme) => theme.id === id) ?? defaultManifest;
}
