/**
 * Cross-fade for theme and color scheme changes (docs/architecture.md §7.5): a view transition
 * where supported, otherwise an overlay that fades in and out. With reduced motion the change
 * is immediate.
 */
import { flushSync } from 'react-dom';

const FADE_IN_MS = 140;
const FADE_OUT_MS = 220;

function overlayFade(update: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'theme-fade';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  const fadeIn = overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: FADE_IN_MS,
    easing: 'ease-out',
    fill: 'forwards',
  });
  void fadeIn.finished
    .catch(() => undefined)
    .then(() => {
      flushSync(update);
      const fadeOut = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_OUT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      });
      return fadeOut.finished.catch(() => undefined);
    })
    .finally(() => {
      overlay.remove();
    });
}

export function crossFade(update: () => void, reducedMotion: boolean): void {
  if (reducedMotion || typeof document === 'undefined') {
    update();
    return;
  }
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      flushSync(update);
    });
    return;
  }
  if (typeof document.body.animate === 'function') {
    overlayFade(update);
    return;
  }
  update();
}
