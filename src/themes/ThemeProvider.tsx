import { use, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useMediaQuery } from '@/lib/use-media-query';
import { ThemeContext, type ThemeContextValue } from './context';
import type { ColorScheme, ThemeId } from './contract';
import { loadDefaultTheme, loadThemeModule } from './loader';
import { getThemeManifest } from './registry';

function syncThemeColorMeta() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg')
    .trim();
  if (meta && background) meta.content = background;
}

/**
 * Loads the active theme (and the default theme as fallback) and scopes all theme styles by
 * setting data attributes on <html>. Suspends until both chunks are loaded.
 */
export function ThemeProvider({ themeId, children }: { themeId: ThemeId; children: ReactNode }) {
  const manifest = getThemeManifest(themeId);
  const module = use(loadThemeModule(manifest));
  const fallback = use(loadDefaultTheme());
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const preferred: ColorScheme = prefersDark ? 'dark' : 'light';
  const colorScheme = manifest.colorSchemes.includes(preferred)
    ? preferred
    : manifest.colorSchemes[0];

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = manifest.id;
    root.dataset.colorScheme = colorScheme;
    root.dataset.motion = prefersReducedMotion ? 'reduced' : 'full';
    syncThemeColorMeta();
  }, [manifest.id, colorScheme, prefersReducedMotion]);

  const value = useMemo<ThemeContextValue>(
    () => ({ manifest, module, fallback, colorScheme }),
    [manifest, module, fallback, colorScheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
