/**
 * Keyboard and remote control in the player (docs/architecture.md §9.12). Shortcuts work while the
 * controls are hidden; with visible controls the arrow keys move between them.
 */
import type { PlayerModel } from './model';

/** Back keys of TV remotes (webOS 461, Tizen 10009) and browsers. */
const BACK_KEYS = new Set(['GoBack', 'BrowserBack', 'XF86Back', 'Backspace']);
const BACK_KEY_CODES = new Set([461, 10009]);

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [role="slider"], [tabindex]:not([tabindex="-1"])';

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && !element.closest('[hidden], [inert]');
}

/**
 * Moves focus to the nearest control in the arrow's direction (simple spatial navigation inside
 * the player; the app-wide spatial navigation follows in phase 4).
 */
export function moveFocus(container: HTMLElement, from: HTMLElement, key: string): boolean {
  const origin = from.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const candidate of container.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (candidate === from || !isVisible(candidate)) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - ox;
    const dy = rect.top + rect.height / 2 - oy;
    const along =
      key === 'ArrowLeft' ? -dx : key === 'ArrowRight' ? dx : key === 'ArrowUp' ? -dy : dy;
    const across = key === 'ArrowLeft' || key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  best?.focus();
  return best !== null;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]') !== null
  );
}

function isControl(target: EventTarget | null, container: HTMLElement): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    target !== container &&
    container.contains(target) &&
    target.matches(FOCUSABLE)
  );
}

/** Handles a key press in the player. Returns true when it was used. */
export function handlePlayerKey(
  event: KeyboardEvent,
  player: PlayerModel,
  container: HTMLElement,
): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (isTyping(event.target)) return false;
  const onControl = isControl(event.target, container);
  const key = event.key;

  // TV browsers report their back buttons only as key codes, so the deprecated field is needed.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const backCode = BACK_KEY_CODES.has(event.keyCode);
  if (BACK_KEYS.has(key) || backCode || key === 'Escape') {
    player.close();
    return true;
  }

  switch (key) {
    case ' ':
    case 'Enter':
      // Visible buttons handle these themselves.
      if (onControl && player.controlsVisible) return false;
      // Enter first brings back hidden controls (TV remotes); Space always plays or pauses.
      if (key === 'Enter' && !player.controlsVisible) {
        player.revealControls();
        return true;
      }
      player.togglePlay();
      player.revealControls();
      return true;
    case 'k':
    case 'K':
    case 'MediaPlayPause':
      player.togglePlay();
      player.revealControls();
      return true;
    case 'MediaPlay':
      if (player.status === 'paused' || player.status === 'ended') player.togglePlay();
      return true;
    case 'MediaPause':
      if (player.status === 'playing' || player.status === 'buffering') player.togglePlay();
      return true;
    case 'MediaStop':
      player.close();
      return true;
    case 'f':
    case 'F':
      if (player.canFullscreen) player.toggleFullscreen();
      return true;
    case 'm':
    case 'M':
      player.toggleMute();
      player.revealControls();
      return true;
    case 'MediaFastForward':
      player.seekBy(30);
      player.revealControls();
      return true;
    case 'MediaRewind':
      player.seekBy(-10);
      player.revealControls();
      return true;
    case 'MediaTrackNext':
      if (player.nextUp) player.playNext();
      return true;
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      if (onControl && player.controlsVisible) {
        // Sliders use ← and → themselves; otherwise the arrows move between the controls.
        const slider = event.target.matches('[role="slider"], input[type="range"]');
        if (slider && (key === 'ArrowLeft' || key === 'ArrowRight')) return false;
        moveFocus(container, event.target, key);
        player.revealControls();
        return true;
      }
      if (key === 'ArrowLeft') player.seekBy(-10);
      else if (key === 'ArrowRight') player.seekBy(10);
      else player.setVolume(player.volume + (key === 'ArrowUp' ? 0.1 : -0.1));
      player.revealControls();
      return true;
    }
    default:
      return false;
  }
}
