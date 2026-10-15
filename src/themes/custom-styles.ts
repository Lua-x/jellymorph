import { useLayoutEffect } from 'react';
import { useAppConfig } from '@/config/context';
import type { ThemeId } from './contract';

/** Where the container serves the mounted folder (docker/nginx.conf.template). */
const FOLDER = '/custom/';

/** Adds, updates or removes one of the own style sheets; it always ends up last in <head>. */
function placeLink(slot: 'all' | 'theme', href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[data-custom-style="${slot}"]`);
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.customStyle = slot;
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  // After the theme's own styles (loaded with its chunk), so equal selectors win.
  document.head.append(link);
}

/**
 * Own colors, fonts and CSS from the mounted folder (phase 14): custom.css for every theme and
 * <theme>.css only while that theme is active. Style sheets are files on the own origin, so the
 * Content Security Policy needs no exception (no injected CSS).
 */
export function useCustomStyles(theme: ThemeId) {
  const { customCss } = useAppConfig();
  useLayoutEffect(() => {
    placeLink('all', customCss.all ? `${FOLDER}custom.css` : null);
    placeLink('theme', customCss.themes.includes(theme) ? `${FOLDER}${theme}.css` : null);
  }, [customCss, theme]);
}
