import { createContext, use } from 'react';
import type {
  ColorScheme,
  CompleteThemeModule,
  ThemeComponents,
  ThemeManifest,
  ThemeModule,
  ThemeOptions,
  ThemeSlot,
} from './contract';

export interface ThemeContextValue {
  manifest: ThemeManifest;
  module: ThemeModule;
  fallback: CompleteThemeModule;
  colorScheme: ColorScheme;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function useThemeContext(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('Theme hooks must be used inside <ThemeProvider>');
  return context;
}

/** The active theme's component for a slot, or the default theme's when the theme has none. */
export function useThemeComponent<S extends ThemeSlot>(slot: S): ThemeComponents[S] {
  const { module, fallback } = useThemeContext();
  return module.components[slot] ?? fallback.components[slot];
}

/** The default theme's component for a slot (used when a theme component fails). */
export function useFallbackComponent<S extends ThemeSlot>(slot: S): ThemeComponents[S] {
  return useThemeContext().fallback.components[slot];
}

export function useThemeOptions(): ThemeOptions {
  const { module, fallback } = useThemeContext();
  return { ...fallback.options, ...module.options };
}

export function useActiveTheme(): Pick<ThemeContextValue, 'manifest' | 'colorScheme'> {
  const { manifest, colorScheme } = useThemeContext();
  return { manifest, colorScheme };
}
