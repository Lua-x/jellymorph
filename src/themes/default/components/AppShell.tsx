import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavModel } from '@/navigation/nav-model';
import { AppLink } from '@/ui/AppLink';
import { Logo } from '@/ui/Logo';
import type { AppShellProps } from '../../contract';
import styles from './AppShell.module.css';
import { Avatar } from './Avatar';
import { Icon } from './icons';
import { Spinner } from './Spinner';

function UserMenu({ nav }: { nav: NavModel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
    };
    const root = rootRef.current;
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
    <div className={styles.userMenu} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.userButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('nav.userMenuFor', { name: nav.user.name })}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Avatar name={nav.user.name} imageUrl={nav.user.imageUrl} />
        <span className={styles.userName}>{nav.user.name}</span>
        <Icon name="chevronDown" className={styles.chevron} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.panelHeader}>
          <span className={styles.panelName}>{nav.user.name}</span>
          <span className={styles.panelServer}>{nav.serverName}</span>
        </div>
        <ul className={styles.menuList}>
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
          <li>
            <button
              type="button"
              className={styles.menuItem}
              onClick={nav.signOut}
              disabled={nav.signingOut}
              aria-busy={nav.signingOut || undefined}
            >
              {nav.signingOut ? <Spinner /> : <Icon name="logout" />}
              {t('nav.signOut')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function AppShell({ nav, children }: AppShellProps) {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const home = nav.items.filter((item) => item.id === 'home');
  const tools = nav.items.filter((item) => item.group === 'main' && item.id !== 'home');
  const libraries = nav.items.filter((item) => item.group === 'library');
  return (
    <div className={styles.shell}>
      <a
        href="#main"
        className={styles.skipLink}
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('nav.skipToContent')}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <AppLink to="/" className={styles.brand}>
            <Logo className={styles.logo} />
            <span className={styles.brandName}>{nav.appTitle}</span>
          </AppLink>
          <nav className={styles.nav} aria-label={t('nav.mainNavigation')}>
            <ul className={styles.navList}>
              {[...home, ...libraries, ...tools].map((item) => (
                <li key={item.id}>
                  <AppLink
                    nav
                    end={item.id === 'home'}
                    to={item.to}
                    className={styles.navLink}
                    activeClassName={styles.active}
                  >
                    <Icon name={item.icon} className={styles.navIcon} />
                    <span>{item.label}</span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
          <UserMenu nav={nav} />
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        {children}
      </main>
      {/* Phones: the main destinations sit at the bottom, within thumb reach. */}
      <nav className={styles.bottomNav} aria-label={t('nav.mainNavigation')}>
        <ul>
          {[...home, ...tools].map((item) => (
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
