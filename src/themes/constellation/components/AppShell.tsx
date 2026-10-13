import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavModel } from '@/navigation/nav-model';
import { AppLink } from '@/ui/AppLink';
import { Logo } from '@/ui/Logo';
import type { AppShellProps } from '../../contract';
import { Avatar } from '../../default/components/Avatar';
import { Icon } from '../../default/components/icons';
import styles from './AppShell.module.css';

/** The avatar at the foot of the rail (top right on phones) with the account menu. */
function ProfileMenu({ nav }: { nav: NavModel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Handled here: the app's back navigation must not also go back a page.
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root?.contains(event.relatedTarget as Node | null)) setOpen(false);
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

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.profile} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.railItem} ${styles.profileButton}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('nav.userMenuFor', { name: nav.user.name })}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Avatar name={nav.user.name} imageUrl={nav.user.imageUrl} className={styles.avatar} />
        <span className={styles.label} aria-hidden="true">
          {nav.user.name}
        </span>
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <p className={styles.panelName}>
          {nav.user.name}
          <span className={styles.panelServer}>{nav.serverName}</span>
        </p>
        <ul className={styles.menuList}>
          <li>
            <AppLink
              to={nav.settings}
              className={styles.menuItem}
              onClick={() => {
                setOpen(false);
              }}
            >
              <Icon name="sliders" />
              {t('nav.settings')}
            </AppLink>
          </li>
          <li>
            <button type="button" className={styles.menuItem} onClick={run(nav.switchProfile)}>
              <Icon name="switch" />
              {t('nav.switchProfile')}
            </button>
          </li>
          {nav.changeServer && (
            <li>
              <button type="button" className={styles.menuItem} onClick={run(nav.changeServer)}>
                <Icon name="server" />
                {t('nav.changeServer')}
              </button>
            </li>
          )}
          <li className={styles.menuDivider}>
            <button
              type="button"
              className={styles.menuItem}
              onClick={nav.signOut}
              disabled={nav.signingOut}
              aria-busy={nav.signingOut || undefined}
            >
              <Icon name="logout" />
              {t('nav.signOut')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * A narrow rail of icons on the left (desktop and TV). Under the pointer or with the keyboard or
 * remote focus in it, it unfolds over the page: a dark shade fades in and the labels appear next
 * to the icons. Phones get a small bar on top and the main sections at the bottom.
 */
export function AppShell({ nav, children }: AppShellProps) {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const search = nav.items.find((item) => item.id === 'search');
  // Search leads, like the rest of the theme's navigation reads top to bottom.
  const railItems = search ? [search, ...nav.items.filter((item) => item !== search)] : nav.items;
  const phoneLinks = nav.items.filter((item) => item.group === 'main');

  return (
    <div className={styles.shell}>
      <a
        href="#main"
        className={styles.skipLink}
        data-nav-ignore
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('nav.skipToContent')}
      </a>
      <header className={styles.rail}>
        <div className={styles.railShade} aria-hidden="true" />
        <AppLink to="/" className={`${styles.railItem} ${styles.brand}`}>
          <Logo className={styles.logo} />
          <span className={`${styles.label} ${styles.brandName}`}>{nav.appTitle}</span>
        </AppLink>
        <nav className={styles.railNav} aria-label={t('nav.mainNavigation')}>
          <ul className={styles.railList}>
            {railItems.map((item) => (
              <li key={item.id}>
                <AppLink
                  nav
                  end={item.id === 'home'}
                  to={item.to}
                  className={styles.railItem}
                  activeClassName={styles.active}
                >
                  <Icon name={item.icon} />
                  <span className={styles.label}>{item.label}</span>
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
        <ProfileMenu nav={nav} />
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <nav className={styles.bottomNav} aria-label={t('nav.mainNavigation')}>
        <ul>
          {phoneLinks.map((item) => (
            <li key={item.id}>
              <AppLink
                nav
                end={item.id === 'home'}
                to={item.to}
                className={styles.bottomLink}
                activeClassName={styles.bottomActive}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </AppLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
