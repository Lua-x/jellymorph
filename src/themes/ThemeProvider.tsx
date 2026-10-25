import { use, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useMediaQuery } from '@/lib/use-media-query';
import { useAppearance } from '@/settings/appearance';
import { ThemeContext, type ThemeContextValue } from './context';
import { resolveColorScheme } from './color-scheme';
import { useCustomStyles } from './custom-styles';
import type { ColorScheme, ThemeId } from './contract';
import { loadDefaultTheme, loadThemeOrClassic } from './loader';
import { getThemeManifest, usePluginFailures } from './registry';
import { crossFade } from './transition';

function syncThemeColorMeta() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg')
    .trim();
  if (meta && background) meta.content = background;
}

interface Shown {
  theme: ThemeId;
  colorScheme: ColorScheme;
}

/**
 * Loads the active theme (and the default theme as fallback) and scopes all theme styles by
 * setting data attributes on <html>. A theme change first loads the new chunk, then swaps with
 * a cross-fade, without reloading the page (architecture §7.5).
 */
export function ThemeProvider({
  defaultTheme,
  children,
}: {
  defaultTheme: ThemeId;
  children: ReactNode;
}) {
  const appearance = useAppearance(defaultTheme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const motion = useMotionPreference();
  // A plugin that failed to load counts as Classic from then on (re-render when that happens).
  usePluginFailures((state) => state.failed);
  const requestedManifest = getThemeManifest(appearance.theme);
  const requested: Shown = {
    theme: requestedManifest.id,
    colorScheme: resolveColorScheme(requestedManifest, appearance.colorScheme, prefersDark),
  };
  const [shown, setShown] = useState<Shown>(requested);

  useEffect(() => {
    if (requested.theme === shown.theme && requested.colorScheme === shown.colorScheme) return;
    let cancelled = false;
    const target = { theme: requested.theme, colorScheme: requested.colorScheme };
    void loadThemeOrClassic(getThemeManifest(target.theme)).then(({ manifest }) => {
      // A theme that failed stays out; the current one remains (the loader told the user).
      if (cancelled || manifest.id !== target.theme) return;
      crossFade(() => {
        setShown(target);
      }, motion === 'reduced');
    });
    return () => {
      cancelled = true;
    };
  }, [requested.theme, requested.colorScheme, shown.theme, shown.colorScheme, motion]);

  const { manifest, module } = use(loadThemeOrClassic(getThemeManifest(shown.theme)));
  const fallback = use(loadDefaultTheme());

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = manifest.id;
    root.dataset.colorScheme = shown.colorScheme;
    syncThemeColorMeta();
  }, [manifest.id, shown.colorScheme]);

  useLayoutEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  useCustomStyles(manifest.id);

  const value = useMemo<ThemeContextValue>(
    () => ({ manifest, module, fallback, colorScheme: shown.colorScheme }),
    [manifest, module, fallback, shown.colorScheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
