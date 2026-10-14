import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavModel } from '@/navigation/nav-model';
import { AppLink } from '@/ui/AppLink';
import { Logo } from '@/ui/Logo';
import type { AppShellProps } from '../../contract';
import { Avatar } from '../../default/components/Avatar';
import { Icon } from '../../default/components/icons';
import styles from './AppShell.module.css';
import { GlassMotion } from './motion';
import { OverflowNav } from '../../default/components/OverflowNav';

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
        className={styles.profileButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('nav.userMenuFor', { name: nav.user.name })}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Avatar name={nav.user.name} imageUrl={nav.user.imageUrl} className={styles.avatar} />
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
          {nav.dashboard && (
            <li>
              <a
                href={nav.dashboard}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.menuItem}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <Icon name="server" />
                {t('nav.serverAdmin')}
                <span className="visually-hidden"> ({t('nav.newTab')})</span>
              </a>
            </li>
          )}
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
 * Room for the centered pill: the header's width without the brand and the profile on either
 * side (the wider of the two counts twice, so the pill stays centered).
 */
function roomForPill(list: HTMLUListElement): number {
  const header = list.closest('header');
  if (!header) return list.parentElement?.clientWidth ?? 0;
  const style = getComputedStyle(header);
  const gap = parseFloat(style.columnGap) || 0;
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const nav = list.parentElement;
  const sides = [...header.children].filter((child) => child !== nav);
  const side = Math.max(0, ...sides.map((child) => child.getBoundingClientRect().width));
  return header.clientWidth - padding - 2 * side - 2 * gap;
}

/** Whether the page has scrolled away from the top (the bar gets its frosted backing). */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 8);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);
  return scrolled;
}

/**
 * A centered pill of frosted glass with the sections, the brand on the left and the profile on
 * the right. Phones get the pill as a floating tab bar at the bottom.
 */
export function AppShell({ nav, children }: AppShellProps) {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const scrolled = useScrolled();
  const phoneLinks = nav.items.filter((item) => item.group === 'main');
  // Search leads the pill, as the first thing to reach for.
  const pillItems = [
    ...nav.items.filter((item) => item.id === 'search'),
    ...nav.items.filter((item) => item.id !== 'search'),
  ];

  return (
    <GlassMotion>
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
        <header className={styles.header} data-scrolled={scrolled || undefined}>
          <AppLink to="/" className={styles.brand}>
            <Logo className={styles.logo} />
            <span className={styles.brandName}>{nav.appTitle}</span>
          </AppLink>
          <nav className={styles.nav} aria-label={t('nav.mainNavigation')}>
            <OverflowNav
              items={pillItems}
              available={roomForPill}
              classes={{
                list: styles.pill,
                more: `${styles.tab} ${styles.moreButton}`,
                moreActive: styles.active,
                panel: `${styles.panel} ${styles.morePanel}`,
                link: styles.menuItem,
                linkActive: styles.menuActive,
              }}
              renderMore={(label) => (
                <>
                  {label}
                  <Icon name="chevronDown" className={styles.moreChevron} />
                </>
              )}
              renderItem={(item) => (
                <AppLink
                  nav
                  end={item.id === 'home'}
                  to={item.to}
                  className={item.id === 'search' ? styles.searchTab : styles.tab}
                  activeClassName={styles.active}
                  aria-label={item.id === 'search' ? item.label : undefined}
                >
                  {item.id === 'search' ? <Icon name="search" /> : item.label}
                </AppLink>
              )}
            />
          </nav>
          <div className={styles.tools}>
            <ProfileMenu nav={nav} />
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
          {children}
        </main>
        <nav className={styles.tabBar} aria-label={t('nav.mainNavigation')}>
          <ul>
            {phoneLinks.map((item) => (
              <li key={item.id}>
                <AppLink
                  nav
                  end={item.id === 'home'}
                  to={item.to}
                  className={styles.tabBarLink}
                  activeClassName={styles.tabBarActive}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </GlassMotion>
  );
}
