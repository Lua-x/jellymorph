import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '@/config/context';
import { APP_VERSION } from '@/config/version';
import { useLanguage } from '@/hooks/useLanguage';
import { Logo } from '@/ui/Logo';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Secondary actions shown below the card. */
  actions?: ReactNode;
  wide?: boolean;
}

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

/** Frame for all sign-in screens: brand, one focused card, language switch. */
export function AuthLayout({ title, subtitle, children, actions, wide = false }: AuthLayoutProps) {
  const { appTitle } = useAppConfig();
  const headingId = useId();
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <main id="main" className={styles.main}>
        <div className={styles.brand}>
          <Logo className={styles.logo} />
          <span className={styles.brandName}>{appTitle}</span>
        </div>
        <section
          className={wide ? `${styles.card} ${styles.wide}` : styles.card}
          aria-labelledby={headingId}
        >
          <header className={styles.header}>
            <h1 id={headingId} className={styles.title}>
              {title}
            </h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </header>
          {children}
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
