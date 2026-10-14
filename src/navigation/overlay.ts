import { matchPath, type Location } from 'react-router';

/**
 * Overlay navigation (architecture §7.1, `detailPresentation: 'modal'`): a link can open its
 * target above the current page. The page underneath is kept in the history state, so the URL
 * stays shareable, Back closes the overlay and a reload shows the same picture.
 */
export interface OverlayState {
  backgroundLocation: Location;
}

/** Only the details of an item open as an overlay; other targets are normal pages. */
export const OVERLAY_ROUTE = '/item/:itemId';

export function opensAsOverlay(pathname: string): boolean {
  return matchPath(OVERLAY_ROUTE, pathname) !== null;
}

/** The page under an overlay, or null for a normal page. */
export function backgroundOf(location: Location): Location | null {
  if (!opensAsOverlay(location.pathname)) return null;
  const state = location.state as Partial<OverlayState> | null | undefined;
  const background = state?.backgroundLocation;
  return background && typeof background.pathname === 'string' ? background : null;
}

let opener: HTMLElement | null = null;

/**
 * The link on the page that opened an overlay, recorded at the click: a page often links one
 * title several times (hero, rows), so the overlay cannot find "its" card again by address.
 */
export function rememberOverlayOpener(element: HTMLElement) {
  opener = element;
}

/** Hands the recorded opener to the overlay once (and forgets it). */
export function takeOverlayOpener(): HTMLElement | null {
  const element = opener;
  opener = null;
  return element;
}

/** History state for a link that opens above `location` (keeps an existing background). */
export function overlayState(location: Location): OverlayState {
  return { backgroundLocation: backgroundOf(location) ?? location };
}
