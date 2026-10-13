import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

/** Where the card sits on the page (document coordinates), when it unfolded. */
export interface ExpandAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

const OPEN_DELAY_MS = 250;

/**
 * The unfolded card: opens a quarter of a second after the pointer rests on the card or the
 * keyboard/remote focus lands on it, stays open while pointer or focus are on card or panel,
 * and closes on Escape (focus goes back to the card), when the row scrolls or the window resizes.
 * Not on touch screens and not inside dialogs (the details overlay).
 */
export function useCardExpand(enabled: boolean) {
  const [anchor, setAnchor] = useState<ExpandAnchor | null>(null);
  const [cardFocused, setCardFocused] = useState(false);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
  }, []);

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  }, []);

  const schedule = useCallback(() => {
    if (!enabled || document.documentElement.dataset.device === 'touch') return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card?.isConnected || card.closest('[role="dialog"], [inert]')) return;
      const rect = card.getBoundingClientRect();
      setAnchor({
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    }, OPEN_DELAY_MS);
  }, [enabled]);

  useEffect(() => cancel, [cancel]);

  // A row that scrolls sideways moves the card away from the unfolded one.
  useEffect(() => {
    if (!anchor) return;
    const track = cardRef.current?.closest('ul');
    track?.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      track?.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [anchor, close]);

  const inPanel = (target: EventTarget | null) =>
    target instanceof Node && Boolean(panelRef.current?.contains(target));
  const inCard = (target: EventTarget | null) =>
    target instanceof Node && Boolean(cardRef.current?.contains(target));

  const cardHandlers = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') schedule();
    },
    onPointerLeave: (event: PointerEvent) => {
      if (!inPanel(event.relatedTarget)) close();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      // Keyboard and remote focus only; a click navigates anyway.
      if (!event.currentTarget.matches(':focus-visible')) return;
      setCardFocused(true);
      schedule();
    },
    onBlur: (event: FocusEvent) => {
      setCardFocused(false);
      if (!inPanel(event.relatedTarget)) close();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (anchor && event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    },
  };

  const panelHandlers = {
    onPointerLeave: (event: PointerEvent) => {
      if (!inCard(event.relatedTarget)) close();
    },
    onBlur: (event: FocusEvent) => {
      if (!inPanel(event.relatedTarget) && !inCard(event.relatedTarget)) close();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Handled here: the app's back navigation must not also go back a page.
        event.preventDefault();
        close();
        cardRef.current?.focus({ preventScroll: true });
      }
    },
  };

  return { anchor, cardFocused, cardRef, panelRef, cardHandlers, panelHandlers, close };
}
