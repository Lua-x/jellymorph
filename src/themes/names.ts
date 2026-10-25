import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { LocalizedText, ThemeManifest } from './contract';

function pick(text: LocalizedText, language: string): string {
  return (text as Partial<Record<string, string>>)[language] ?? text.en;
}

/** Name and description of a theme in the given language; plugins bring their own texts. */
export function themeNames(
  manifest: ThemeManifest,
  t: TFunction<'themes'>,
  language: string,
): { name: string; description: string } {
  return manifest.plugin
    ? {
        name: pick(manifest.plugin.name, language),
        description: pick(manifest.plugin.description, language),
      }
    : { name: t(manifest.nameKey), description: t(manifest.descriptionKey) };
}

/** `themeNames` in the interface language. */
export function useThemeNames(): (manifest: ThemeManifest) => {
  name: string;
  description: string;
} {
  const { t, i18n } = useTranslation('themes');
  return (manifest) => themeNames(manifest, t, i18n.language);
}
