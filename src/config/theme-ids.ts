/** The themes that ship with the app. Order is the order in the settings. */
export const THEME_IDS = [
  'default',
  'neon-grid',
  'crimson',
  'glass',
  'horizon',
  'constellation',
  'cobalt',
  'onyx',
] as const;

export type BuiltInThemeId = (typeof THEME_IDS)[number];

/**
 * A built-in theme or a plugin theme from the container's folder (phase 17). Which plugins are
 * installed is only known at runtime, so stored choices keep any well-formed id; an id without a
 * theme (e.g. a removed plugin) falls back to Classic when it is shown (themes/registry.ts).
 */
export type ThemeId = string;

/** Lowercase letters, digits and hyphens, like the folder names of plugin themes. */
const THEME_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isBuiltInThemeId(value: unknown): value is BuiltInThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/** A well-formed theme id; whether the theme exists is decided by the registry. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_ID.test(value);
}
