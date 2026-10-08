import { useCallback, useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '@/config/context';
import { APP_VERSION } from '@/config/version';
import { useLanguage } from '@/hooks/useLanguage';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Logo } from '@/ui/Logo';
import { useSessionFlag } from '@/ui/useSessionFlag';
import styles from './AuthTerminal.module.css';
import { Backdrop } from './Backdrop';
import { BootSequence } from './BootSequence';
import { useInterfaceSounds } from './sounds';
import { ScrambleText } from './ScrambleText';

function LanguageSwitch() {
  const { t } = useTranslation();
  const { language, languages, setLanguage } = useLanguage();
  return (
    <div className={styles.languages} role="group" aria-label={t('language.label')}>
      {languages.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={styles.language}
          aria-pressed={code === language}
          onClick={() => {
            setLanguage(code);
          }}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}

interface AuthTerminalProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Secondary actions below the terminal. */
  actions?: ReactNode;
  wide?: boolean;
}

/**
 * Frame for all sign-in screens: the boot sequence once per session, then a terminal window
 * with the brand, the step's title and content, and the language switch.
 */
export function AuthTerminal({
  title,
  subtitle,
  children,
  actions,
  wide = false,
}: AuthTerminalProps) {
  const { appTitle } = useAppConfig();
  const { t } = useTranslation('theme-neon-grid');
  const headingId = useId();
  const reduced = useReducedMotion();
  const [booted, markBooted] = useSessionFlag('neon-grid.boot');
  const finishBoot = useCallback(() => {
    markBooted();
  }, [markBooted]);
  useInterfaceSounds();

  if (!booted && !reduced) {
    return (
      <div className={styles.page}>
        <Backdrop />
        <BootSequence onDone={finishBoot} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Backdrop />
      <main id="main" className={styles.main}>
        <div className={styles.brand}>
          <Logo className={styles.logo} />
          <span className={styles.brandName}>{appTitle}</span>
        </div>
        <section
          className={wide ? `${styles.terminal} ${styles.wide}` : styles.terminal}
          aria-labelledby={headingId}
        >
          <div className={styles.titleBar} aria-hidden="true">
            <span>{t('auth.terminal')}</span>
            <span className={styles.lights}>
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className={styles.body}>
            <header className={styles.header}>
              <h1 id={headingId} className={styles.title}>
                <ScrambleText text={title} />
              </h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </header>
            {children}
          </div>
        </section>
        {actions && <div className={styles.actions}>{actions}</div>}
      </main>
      <footer className={styles.footer}>
        <LanguageSwitch />
        <span className={styles.version}>v{APP_VERSION}</span>
      </footer>
    </div>
  );
}
