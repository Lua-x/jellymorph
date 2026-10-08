import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import type { NavModel } from '@/navigation/nav-model';
import { useRouteKey } from '@/navigation/useRouteKey';
import { AppLink } from '@/ui/AppLink';
import { Logo } from '@/ui/Logo';
import type { AppShellProps } from '../../contract';
import { Avatar } from '../../default/components/Avatar';
import { Icon } from '../../default/components/icons';
import styles from './AppShell.module.css';
import { Backdrop } from './Backdrop';
import { useInterfaceSounds } from './sounds';

function Clock() {
  const { t } = useTranslation('theme-neon-grid');
  const { i18n } = useTranslation();
  const now = useNow();
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  // Decorative: a ticking clock would be noise for screen readers.
  return (
    <span className={styles.clock} aria-hidden="true">
      <span className={styles.clockLabel}>{t('hud.systemTime')}</span>
      <span className={styles.clockValue}>{time}</span>
    </span>
  );
}

function OperatorMenu({ nav }: { nav: NavModel }) {
  const { t } = useTranslation();
  const { t: tNeon } = useTranslation('theme-neon-grid');
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
    <div className={styles.operator} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.operatorButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('nav.userMenuFor', { name: nav.user.name })}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Avatar name={nav.user.name} imageUrl={nav.user.imageUrl} className={styles.avatar} />
        <span className={styles.operatorText}>
          <span className={styles.operatorLabel}>{tNeon('hud.operator')}</span>
          <span className={styles.operatorName}>{nav.user.name}</span>
        </span>
        <Icon name="chevronDown" className={styles.chevron} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.panelHeader}>
          <span className={styles.panelName}>{nav.user.name}</span>
          <span className={styles.panelServer}>
            <span className={styles.statusDot} aria-hidden="true" />
            {nav.serverName}
          </span>
        </div>
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
          <li>
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

/** HUD frame: top bar with navigation, system time and operator menu above the perspective grid. */
export function AppShell({ nav, children }: AppShellProps) {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = useRouteKey();
  useInterfaceSounds();
  const home = nav.items.filter((item) => item.id === 'home');
  const tools = nav.items.filter((item) => item.group === 'main' && item.id !== 'home');
  const libraries = nav.items.filter((item) => item.group === 'library');

  return (
    <div className={styles.shell}>
      <Backdrop />
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
      <header className={styles.header}>
        <div className={styles.bar}>
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
          <Clock />
          <OperatorMenu nav={nav} />
        </div>
        <div className={styles.rail} aria-hidden="true" />
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        {/* Keyed by page: each page enters with the short transition (glitch on its heading). */}
        <div key={routeKey} className={styles.page}>
          {children}
        </div>
      </main>
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
