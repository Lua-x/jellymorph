import { constellationManifest } from './constellation/manifest';
import type { ThemeId, ThemeManifest } from './contract';
import { crimsonManifest } from './crimson/manifest';
import { defaultManifest } from './default/manifest';
import { glassManifest } from './glass/manifest';
import { horizonManifest } from './horizon/manifest';
import { neonGridManifest } from './neon-grid/manifest';

/** Every available theme. Adding a theme = a new folder plus one entry here. */
export const THEMES: readonly ThemeManifest[] = [
  defaultManifest,
  neonGridManifest,
  crimsonManifest,
  glassManifest,
  horizonManifest,
  constellationManifest,
];

export function getThemeManifest(id: ThemeId): ThemeManifest {
  return THEMES.find((theme) => theme.id === id) ?? defaultManifest;
}
