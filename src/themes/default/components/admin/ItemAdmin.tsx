import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ItemDetail } from '@/domain/types';
import { useIsAdmin } from '@/hooks/useAdminAccess';
import { Button } from '../Button';
import { Icon } from '../icons';
import styles from './Admin.module.css';
import type { AdminDialogKind } from './AdminDialogHost';

/**
 * With the Popover API the menu opens in the top layer: no header with overflow: hidden clips it,
 * no row painted later covers it, and in the DOM it stays next to its button (Tab order, inside
 * an overlay's aria-modal dialog). Older browsers (Chrome < 114, Safari < 17) show it in place.
 */
const TOP_LAYER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
const CLOSE_KEYS = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
/** Back buttons of TV remotes that only report a key code (webOS, Tizen). */
const BACK_KEY_CODES = new Set([461, 10009]);

const loadDialogs = () => import('./AdminDialogHost');
const AdminDialogHost = lazy(loadDialogs);

/** What a theme's trigger gets: spread `buttonProps` on its button, show `label` or use it as name. */
export interface AdminTriggerProps {
  label: string;
  open: boolean;
  buttonProps: {
    ref: Ref<HTMLButtonElement>;
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: (event: { detail: number }) => void;
  };
}

interface Entry {
  kind: AdminDialogKind;
  label: string;
  icon: 'search' | 'edit' | 'image' | 'subtitles' | 'refresh' | 'trash';
}

function entries(item: ItemDetail, t: TFunction<'content'>): Entry[] {
  const video = item.kind === 'movie' || item.kind === 'episode' || item.kind === 'video';
  const list: (Entry | false)[] = [
    (item.kind === 'movie' || item.kind === 'series') && {
      kind: 'identify',
      label: t('admin.identify'),
      icon: 'search',
    },
    { kind: 'metadata', label: t('admin.metadata'), icon: 'edit' },
    { kind: 'images', label: t('admin.images'), icon: 'image' },
    video && { kind: 'subtitles', label: t('admin.subtitles'), icon: 'subtitles' },
    { kind: 'refresh', label: t('admin.refresh'), icon: 'refresh' },
    item.canDelete && { kind: 'delete', label: t('admin.delete'), icon: 'trash' },
  ];
  return list.filter((entry) => entry !== false);
}

function defaultTrigger({ label, buttonProps }: AdminTriggerProps): ReactNode {
  return (
    <Button variant="secondary" size="lg" icon={<Icon name="edit" />} {...buttonProps}>
      {label}
    </Button>
  );
}

/**
 * The "Edit" menu of a detail page, for administrators only (renders nothing for everyone else).
 * Themes pass their own trigger button; menu and dialogs are shared and take on the theme's
 * tokens. The dialogs are a separate chunk, loaded when the menu opens.
 */
export function ItemAdmin({
  item,
  renderTrigger = defaultTrigger,
}: {
  item: ItemDetail;
  renderTrigger?: (props: AdminTriggerProps) => ReactNode;
}) {
  const { t } = useTranslation('content');
  const isAdmin = useIsAdmin();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [dialog, setDialog] = useState<AdminDialogKind | null>(null);
  const hadDialog = useRef(false);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const close = () => {
      setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) close();
    };
    // Caught on the window before anything else: neither the app's back navigation nor an
    // overlay around the page (Crimson's details close on Escape) may react as well.
    const onKeyDown = (event: KeyboardEvent) => {
      // TV browsers report their back buttons only as key codes, so the deprecated field is needed.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (!CLOSE_KEYS.has(event.key) && !BACK_KEY_CODES.has(event.keyCode)) return;
      event.preventDefault();
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root?.contains(event.relatedTarget as Node | null)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  // In the top layer the menu is placed in window coordinates under the button, or above it and
  // to its left where the window has no room; it follows the button when anything scrolls.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!open || !menu || !trigger) return;
    const place = () => {
      const button = trigger.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const below = window.innerHeight - button.bottom;
      const up = below < height + 16 && button.top > below;
      setPosition({
        position: 'fixed',
        inset: 'auto',
        margin: 0,
        left: Math.max(
          8,
          button.left + width > window.innerWidth - 8 ? button.right - width : button.left,
        ),
        top: up ? button.top - height - 8 : button.bottom + 8,
        transformOrigin: up ? 'bottom left' : 'top left',
      });
    };
    if (TOP_LAYER) {
      menu.showPopover();
      place();
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, { capture: true, passive: true });
    }
    if (focusFirst) menu.querySelector('button')?.focus();
    return () => {
      if (TOP_LAYER) {
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, { capture: true });
        if (menu.matches(':popover-open')) menu.hidePopover();
      }
    };
  }, [open, focusFirst]);

  // A closed dialog hands the focus back to the trigger (the menu entry that opened it is gone).
  useEffect(() => {
    if (dialog) {
      hadDialog.current = true;
    } else if (hadDialog.current) {
      hadDialog.current = false;
      triggerRef.current?.focus();
    }
  }, [dialog]);

  if (!isAdmin) return null;

  return (
    <div ref={rootRef} className={styles.menuRoot}>
      {renderTrigger({
        label: t('admin.edit'),
        open,
        buttonProps: {
          ref: triggerRef,
          'aria-expanded': open,
          'aria-controls': menuId,
          onClick: (event) => {
            void loadDialogs();
            // Keyboard and remote activations (detail 0) move into the menu right away.
            setFocusFirst(event.detail === 0);
            setOpen((value) => !value);
          },
        },
      })}
      <ul
        ref={menuRef}
        id={menuId}
        className={styles.menu}
        style={TOP_LAYER ? (position ?? undefined) : undefined}
        popover={TOP_LAYER ? 'manual' : undefined}
        aria-label={t('admin.menu', { name: item.name })}
        hidden={!open}
      >
        {entries(item, t).map((entry) => (
          <li key={entry.kind}>
            <button
              type="button"
              className={
                entry.kind === 'delete' ? `${styles.menuItem} ${styles.danger}` : styles.menuItem
              }
              onClick={() => {
                setOpen(false);
                setDialog(entry.kind);
              }}
            >
              <Icon name={entry.icon} />
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
      {dialog && (
        <Suspense fallback={null}>
          <AdminDialogHost
            kind={dialog}
            item={item}
            onClose={() => {
              setDialog(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
