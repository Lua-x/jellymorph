/**
 * Arrow-key navigation for keyboards and remote controls (docs/architecture.md §8). It works on
 * the real DOM: an arrow moves the focus to the nearest focusable element in that direction.
 * Themes need no registration; components with their own arrow handling (lists, grids, tabs,
 * menus, sliders) call preventDefault and are left alone.
 *
 * Back keys (Escape, Backspace outside fields, remote "back") go back in history once no
 * overlay handled them.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const BACK_KEYS = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
/** webOS and Tizen remotes report "back" only as key codes. */
const BACK_KEY_CODES = new Set([461, 10009]);

export const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Containers that keep the focus inside while open. */
const SCOPES = '[role="dialog"], [aria-modal="true"], [role="menu"], dialog[open]';

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const centerX = (box: Box) => (box.left + box.right) / 2;
const centerY = (box: Box) => (box.top + box.bottom) / 2;

/** Distance between two ranges, 0 when they overlap. */
function rangeGap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.max(startA, startB) - Math.min(endA, endB));
}

/**
 * Distance score of a candidate in a direction, or null when it does not lie that way.
 * Misalignment on the cross axis weighs three times as much as distance, so the focus stays in
 * its row or column; among aligned candidates the closer center wins. Pure; tested.
 */
export function score(from: Box, to: Box, direction: Direction): number | null {
  let gap: number;
  let cross: number;
  let centers: number;
  if (direction === 'left' || direction === 'right') {
    const forward = direction === 'right';
    // Beyond the middle of the origin, so small offsets (a lifted, focused card) do not count.
    const beyond = forward ? to.left >= centerX(from) : to.right <= centerX(from);
    if (!beyond) return null;
    gap = forward ? to.left - from.right : from.left - to.right;
    cross = rangeGap(from.top, from.bottom, to.top, to.bottom);
    centers = Math.abs(centerY(to) - centerY(from));
  } else {
    const forward = direction === 'down';
    const beyond = forward ? to.top >= centerY(from) : to.bottom <= centerY(from);
    if (!beyond) return null;
    gap = forward ? to.top - from.bottom : from.top - to.bottom;
    cross = rangeGap(from.left, from.right, to.left, to.right);
    centers = Math.abs(centerX(to) - centerX(from));
  }
  return Math.max(0, gap) + cross * 3 + centers * 0.01;
}

export function nearest<T>(
  from: Box,
  direction: Direction,
  candidates: readonly { box: Box; value: T }[],
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const value = score(from, candidate.box, direction);
    if (value !== null && value < bestScore) {
      bestScore = value;
      best = candidate.value;
    }
  }
  return best;
}

function isVisible(element: HTMLElement): boolean {
  // data-nav-ignore: reachable with Tab, but not a target for the arrows (e.g. skip links).
  if (element.closest('[inert], [aria-hidden="true"], [hidden], [data-nav-ignore]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return getComputedStyle(element).visibility !== 'hidden';
}

export function focusableIn(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
}

function scopeFor(active: Element | null): ParentNode {
  const own = active?.closest(SCOPES);
  if (own) return own;
  const modal = document.querySelector('[aria-modal="true"], dialog[open]');
  return modal ?? document.body;
}

function isTyping(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(
    element.type,
  );
}

/** Text fields keep ←/→ for the caret until it reaches the start or end of the text. */
function caretLeavesField(field: HTMLInputElement | HTMLTextAreaElement, direction: Direction) {
  if (direction === 'up' || direction === 'down') return !(field instanceof HTMLTextAreaElement);
  const { selectionStart, selectionEnd, value } = field;
  if (selectionStart === null || selectionEnd === null) return true;
  if (selectionStart !== selectionEnd) return false;
  return direction === 'left' ? selectionStart === 0 : selectionEnd === value.length;
}

function ownsArrow(element: Element, direction: Direction): boolean {
  if (isTyping(element)) return !caretLeavesField(element, direction);
  // Selects and sliders change their value with the arrows along their axis.
  if (element instanceof HTMLSelectElement) return direction === 'up' || direction === 'down';
  if (
    element.matches('input[type="range"], [role="slider"]') &&
    (direction === 'left' || direction === 'right')
  )
    return true;
  return false;
}

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
}

/** Where to start when nothing is focused yet: a marked element, else the first one visible. */
function entryPoint(scope: ParentNode): HTMLElement | null {
  const main = scope === document.body ? document.querySelector('main') : null;
  const area = main ?? scope;
  const marked = [...area.querySelectorAll<HTMLElement>('[data-autofocus]')].find(isVisible);
  if (marked) return marked;
  const inView = focusableIn(area).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  });
  return inView ?? focusableIn(area)[0] ?? null;
}

/**
 * Fixed and sticky bars (headers, bottom navigation) stay on screen while the content scrolls
 * underneath. Geometrically they are always "above" or "below" the content, so they form their
 * own layer: the arrows reach them only when the content has nothing more in that direction.
 */
function layerResolver(): (element: Element) => boolean {
  const cache = new Map<Element, boolean>();
  const resolve = (element: Element | null): boolean => {
    if (!element || element === document.body) return false;
    const known = cache.get(element);
    if (known !== undefined) return known;
    const position = getComputedStyle(element).position;
    const result = position === 'fixed' || position === 'sticky' || resolve(element.parentElement);
    cache.set(element, result);
    return result;
  };
  return resolve;
}

function intersectsViewport(box: Box): boolean {
  return (
    box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth
  );
}

export function moveFocus(
  direction: Direction,
  active: Element | null = document.activeElement,
): boolean {
  const scope = scopeFor(active);
  const startsFresh =
    !active ||
    active === document.body ||
    !(active instanceof HTMLElement) ||
    !active.matches(FOCUSABLE);
  let next: HTMLElement | null;
  if (startsFresh) {
    next = entryPoint(scope);
  } else {
    const inLayer = layerResolver();
    const originInLayer = inLayer(active);
    const from = boxOf(active);
    const candidates = focusableIn(scope)
      .filter((element) => element !== active)
      .map((element) => ({ box: boxOf(element), value: element, layer: inLayer(element) }));
    next = nearest(
      from,
      direction,
      candidates.filter((candidate) => candidate.layer === originInLayer),
    );
    // From a bar into the content (only what is on screen), or from the content into a bar.
    next ??= nearest(
      from,
      direction,
      candidates.filter(
        (candidate) =>
          candidate.layer !== originInLayer &&
          (!originInLayer || intersectsViewport(candidate.box)),
      ),
    );
  }
  if (!next) return false;
  next.focus({ preventScroll: true });
  next.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth',
  });
  return true;
}

let claims = 0;

/** Screens with their own key handling (the player) switch the global handling off. */
export function claimKeys(): () => void {
  claims += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims -= 1;
  };
}

function goBack(): boolean {
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (index <= 0) return false;
  window.history.back();
  return true;
}

export function handleNavigationKey(event: KeyboardEvent): boolean {
  if (claims > 0 || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
    return false;
  const active = document.activeElement;
  const direction = DIRECTIONS[event.key];
  if (direction) {
    if (active && ownsArrow(active, direction)) return false;
    return moveFocus(direction, active);
  }
  // TV browsers report their back buttons only as key codes, so the deprecated field is needed.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const backCode = BACK_KEY_CODES.has(event.keyCode);
  if (BACK_KEYS.has(event.key) || backCode) {
    // In text fields Backspace deletes and Escape clears (search); neither leaves the page.
    if ((event.key === 'Backspace' || event.key === 'Escape') && isTyping(active)) return false;
    return goBack();
  }
  return false;
}

/** Installs the global handler (bubble phase on window, after all component handlers). */
export function installSpatialNavigation(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (handleNavigationKey(event)) event.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
  };
}
