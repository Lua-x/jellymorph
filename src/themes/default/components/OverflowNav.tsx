import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import type { NavItem } from '@/navigation/nav-model';
import { AppLink } from '@/ui/AppLink';
import { Icon } from './icons';
import styles from './OverflowNav.module.css';

/** Theme classes: the list, the "More" button (like a nav link) and its menu. */
export interface OverflowNavClasses {
  list?: string;
  more?: string;
  /** On the button while the current page is one of the folded-away entries. */
  moreActive?: string;
  panel?: string;
  link?: string;
  linkActive?: string;
}

function width(element: Element): number {
  return element.getBoundingClientRect().width;
}

function current(pathname: string, item: NavItem): boolean {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/**
 * A navigation bar that never runs out of room: libraries that do not fit move into a "More"
 * menu, the fixed entries (home, search, favorites) always stay. How much fits is measured, so it
 * follows the window, the TV font size and the language. The folded-away entries stay in the
 * list, invisible, so their width can be measured again.
 */
export function OverflowNav({
  items,
  classes,
  renderItem,
  renderMore,
  available: measureAvailable,
}: {
  items: readonly NavItem[];
  classes: OverflowNavClasses;
  /** The theme's link for one entry (inside the list item). */
  renderItem: (item: NavItem) => ReactNode;
  /** Content of the "More" button; default: an icon and the label. */
  renderMore?: (label: string) => ReactNode;
  /**
   * Room for the list in pixels. Default: the width of the list's parent. A list that only takes
   * the width of its content (a centered pill) measures the free room around it instead.
   */
  available?: (list: HTMLUListElement) => number;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const listRef = useRef<HTMLUListElement>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const libraryCount = items.filter((item) => item.group === 'library').length;
  const [fitting, setFitting] = useState(libraryCount);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const container = list?.parentElement;
    if (!list || !container) return;
    const measure = () => {
      const style = getComputedStyle(list);
      const gap = parseFloat(style.columnGap) || 0;
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const entries = [...list.children] as HTMLElement[];
      const fixed = entries.filter((entry) => entry.dataset.nav === 'fixed');
      const folding = entries.filter((entry) => entry.dataset.nav === 'library');
      const more = entries.find((entry) => entry.dataset.nav === 'more');
      const available =
        (measureAvailable ? measureAvailable(list) : container.clientWidth) - padding;
      let used = fixed.reduce((sum, entry) => sum + width(entry), 0);
      used += gap * Math.max(0, fixed.length - 1);
      const widths = folding.map(width);
      const all = widths.reduce((sum, value) => sum + value + gap, used);
      if (all <= available + 0.5) {
        setFitting(widths.length);
        return;
      }
      used += more ? width(more) + gap : 0;
      let count = 0;
      for (const value of widths) {
        if (used + value + gap > available) break;
        used += value + gap;
        count += 1;
      }
      setFitting(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // The bar around the list changes with the window even when the list itself does not.
    observer.observe(list.closest('header') ?? container);
    for (const entry of list.children) observer.observe(entry);
    return () => {
      observer.disconnect();
    };
  }, [items, measureAvailable]);

  useEffect(() => {
    if (!open) return;
    const root = moreRef.current;
    const close = () => {
      setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Handled here: the app's back navigation must not also go back a page.
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root?.contains(event.relatedTarget as Node | null)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  const libraries = items.filter((item) => item.group === 'library');
  const folded = libraries.slice(fitting);
  const lastLibrary = libraries.at(-1);
  const label = t('nav.more');
  const moreEntry = (
    <li
      key="more"
      ref={moreRef}
      data-nav="more"
      className={folded.length > 0 ? styles.more : `${styles.more} ${styles.folded}`}
      aria-hidden={folded.length === 0 || undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        className={[
          classes.more,
          folded.some((item) => current(pathname, item)) && classes.moreActive,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-expanded={open}
        aria-controls={panelId}
        tabIndex={folded.length === 0 ? -1 : undefined}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {renderMore ? (
          renderMore(label)
        ) : (
          <>
            <Icon name="more" />
            <span>{label}</span>
          </>
        )}
      </button>
      <ul id={panelId} className={classes.panel} hidden={!open}>
        {folded.map((item) => (
          <li key={item.id}>
            <AppLink
              nav
              to={item.to}
              className={classes.link}
              activeClassName={classes.linkActive}
              onClick={() => {
                setOpen(false);
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </AppLink>
          </li>
        ))}
      </ul>
    </li>
  );

  return (
    <ul ref={listRef} className={classes.list}>
      {items.map((item) => {
        const library = item.group === 'library';
        const hidden = library && folded.includes(item);
        return [
          <li
            key={item.id}
            data-nav={library ? 'library' : 'fixed'}
            className={hidden ? styles.folded : undefined}
            aria-hidden={hidden || undefined}
          >
            {renderItem(item)}
          </li>,
          item === lastLibrary ? moreEntry : null,
        ];
      })}
    </ul>
  );
}
