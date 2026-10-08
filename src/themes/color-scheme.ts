import type { ColorSchemePreference } from '@/settings/schema';
import type { ColorScheme, ThemeManifest } from './contract';

/** The scheme to show: the chosen one if the theme has it, else the system's, else its first. */
export function resolveColorScheme(
  manifest: ThemeManifest,
  preference: ColorSchemePreference,
  prefersDark: boolean,
): ColorScheme {
  const wanted: ColorScheme = preference === 'auto' ? (prefersDark ? 'dark' : 'light') : preference;
  return manifest.colorSchemes.includes(wanted) ? wanted : manifest.colorSchemes[0];
}
