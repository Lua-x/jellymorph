import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Presentation } from '../../contract';
import { Icon } from '../../default/components/icons';
import styles from './DetailSheet.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]';

/**
 * Where focus returns when the details close: the element on the page that opened the first
 * overlay (details opened from details replace each other), else the card of that item.
 */
let pageOpener: { element: HTMLElement | null; href: string } | null = null;

/**
 * The frame of the details: as an overlay above the page it came from (dimmed background, close
 * button, Escape, click outside, focus kept inside and returned afterwards), or as a normal page
 * when opened directly.
 */
export function DetailSheet({
  presentation,
  onClose,
  labelledBy,
  returnHref,
  ready,
  children,
}: {
  presentation: Presentation;
  onClose: () => void;
  labelledBy: string;
  /** Card to focus afterwards when the opener is gone (e.g. the preview that opened it). */
  returnHref: string;
  /** The details have loaded: focus moves to the main action (Play) if it is still at the start. */
  ready: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('theme-crimson');
  const dialogRef = useRef<HTMLDivElement>(null);
  const modal = presentation === 'modal';

  useEffect(() => {
    if (!modal) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !active.closest('[role="dialog"]')
    )
      pageOpener = { element: active, href: '' };
    pageOpener ??= { element: null, href: '' };
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    return () => {
      // Details replaced by other details: the page is still inert and takes no focus yet.
      if (document.querySelector('[data-overlay-open]')) return;
      // Back to the card that opened the details (the page underneath stayed mounted).
      const opener = pageOpener;
      pageOpener = null;
      const target = opener?.element?.isConnected
        ? opener.element
        : opener?.href
          ? document.querySelector<HTMLElement>(`#main a[href="${opener.href}"]`)
          : null;
      target?.focus({ preventScroll: true });
    };
  }, [modal]);

  // Known once the item has loaded: the card to fall back to when the opener is gone.
  useEffect(() => {
    if (modal && pageOpener && returnHref && !pageOpener.href) pageOpener.href = returnHref;
  }, [modal, returnHref]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !ready || !dialog) return;
    const start = dialog.querySelector<HTMLElement>(FOCUSABLE);
    if (document.activeElement !== start && dialog.contains(document.activeElement)) return;
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [modal, ready]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Handled here: the app's back navigation must not also run.
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!modal) {
    return (
      <article className={styles.page} aria-labelledby={labelledBy}>
        {children}
      </article>
    );
  }
  return (
    // The backdrop only closes on a pointer click; keyboard users have Escape and the button.
    // eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-static-element-interactions
    <div
      className={styles.overlay}
      data-overlay-open
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- dialog keys */}
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          className={styles.close}
          aria-label={t('detail.close')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}
