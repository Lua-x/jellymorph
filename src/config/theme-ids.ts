/** All theme ids the app knows about. Order is the order in the settings. */
export const THEME_IDS = [
  'default',
  'neon-grid',
  'crimson',
  'glass',
  'horizon',
  'constellation',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}
