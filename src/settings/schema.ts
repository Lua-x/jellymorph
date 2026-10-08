/**
 * Per-user settings that follow the user to every device (docs/architecture.md §10). They are
 * stored in Jellyfin's DisplayPreferences as flat CustomPrefs keys with a schema version.
 * Unknown or invalid values (e.g. a theme from a newer version) are ignored, never applied.
 */
import { isThemeId, type ThemeId } from '@/config/theme-ids';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@/i18n';

export type ColorSchemePreference = 'auto' | 'dark' | 'light';
export type MotionPreference = 'system' | 'reduced' | 'full';
/** How the app is operated; 'auto' detects TVs by their browser. */
export type DeviceMode = 'auto' | 'desktop' | 'tv';

export interface UserSettings {
  theme: ThemeId;
  colorScheme: ColorSchemePreference;
  language: Language;
  motion: MotionPreference;
  trailerAutoplay: boolean;
  /** Interface sounds of themes that have them (off by default). */
  uiSounds: boolean;
}

export const COLOR_SCHEME_PREFERENCES = ['auto', 'dark', 'light'] as const;
export const MOTION_PREFERENCES = ['system', 'reduced', 'full'] as const;
export const DEVICE_MODES = ['auto', 'desktop', 'tv'] as const;

export function defaultUserSettings(theme: ThemeId): UserSettings {
  return {
    theme,
    colorScheme: 'auto',
    language: DEFAULT_LANGUAGE,
    motion: 'system',
    trailerAutoplay: true,
    uiSounds: false,
  };
}

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

/** The valid fields of an unknown object; everything else is dropped. */
export function parseUserSettings(raw: unknown): Partial<UserSettings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Record<string, unknown>;
  const result: Partial<UserSettings> = {};
  if (isThemeId(value.theme)) result.theme = value.theme;
  if (includes(COLOR_SCHEME_PREFERENCES, value.colorScheme)) result.colorScheme = value.colorScheme;
  if (isLanguage(value.language)) result.language = value.language;
  if (includes(MOTION_PREFERENCES, value.motion)) result.motion = value.motion;
  if (typeof value.trailerAutoplay === 'boolean') result.trailerAutoplay = value.trailerAutoplay;
  if (typeof value.uiSounds === 'boolean') result.uiSounds = value.uiSounds;
  return result;
}

const PREFIX = 'jellymorph.';
export const SCHEMA_VERSION = 1;

/** Flat string keys for DisplayPreferences.CustomPrefs. */
export function toCustomPrefs(settings: UserSettings): Record<string, string> {
  return {
    [`${PREFIX}version`]: String(SCHEMA_VERSION),
    [`${PREFIX}theme`]: settings.theme,
    [`${PREFIX}colorScheme`]: settings.colorScheme,
    [`${PREFIX}language`]: settings.language,
    [`${PREFIX}motion`]: settings.motion,
    [`${PREFIX}trailerAutoplay`]: String(settings.trailerAutoplay),
    [`${PREFIX}uiSounds`]: String(settings.uiSounds),
  };
}

/**
 * Reads our keys from CustomPrefs. Returns null when the server has none yet (first sign-in) or
 * they were written by a newer, incompatible schema.
 */
export function fromCustomPrefs(
  prefs: Record<string, string | null | undefined> | null | undefined,
): Partial<UserSettings> | null {
  const version = Number(prefs?.[`${PREFIX}version`]);
  if (!prefs || !Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) return null;
  const flag = (key: string) => {
    const raw = prefs[`${PREFIX}${key}`];
    return raw === 'true' ? true : raw === 'false' ? false : undefined;
  };
  return parseUserSettings({
    theme: prefs[`${PREFIX}theme`],
    colorScheme: prefs[`${PREFIX}colorScheme`],
    language: prefs[`${PREFIX}language`],
    motion: prefs[`${PREFIX}motion`],
    trailerAutoplay: flag('trailerAutoplay'),
    uiSounds: flag('uiSounds'),
  });
}
