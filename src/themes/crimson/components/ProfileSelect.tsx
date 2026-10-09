import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '@/config/context';
import { useLanguage } from '@/hooks/useLanguage';
import { Logo } from '@/ui/Logo';
import type { ProfileSelectProps } from '../../contract';
import { Avatar } from '../../default/components/Avatar';
import { Icon } from '../../default/components/icons';
import { Notice } from '../../default/components/Notice';
import { Spinner } from '../../default/components/Spinner';
import { ErrorState, LoadingState } from '../../default/components/States';
import { errorText } from '../../default/components/text';
import { CrimsonButton } from './CrimsonButton';
import styles from './ProfileSelect.module.css';

function LanguageSelect() {
  const { t } = useTranslation();
  const { language, languages, setLanguage } = useLanguage();
  const id = useId();
  return (
    <span className={styles.language}>
      <label htmlFor={id} className="visually-hidden">
        {t('language.label')}
      </label>
      <Icon name="language" className={styles.languageIcon} />
      <select
        id={id}
        value={language}
        onChange={(event) => {
          const next = languages.find((code) => code === event.target.value);
          if (next) setLanguage(next);
        }}
      >
        {languages.map((code) => (
          <option key={code} value={code} lang={code}>
            {t(`language.${code}`)}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * "Who's watching?": large square avatars of the server's users in a centered row, the name
 * below. Focus = hover: white frame and the name turns white.
 */
export function ProfileSelect({
  server,
  profiles,
  pendingProfileId,
  error,
  onSelect,
  onForget,
  onOtherUser,
  onQuickConnect,
  onChangeServer,
}: ProfileSelectProps) {
  const { t } = useTranslation('auth');
  const { t: tCrimson } = useTranslation('theme-crimson');
  const { t: tErrors } = useTranslation('errors');
  const { appTitle } = useAppConfig();
  const busy = pendingProfileId !== null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo className={styles.logo} />
        <span className={styles.brandName}>{appTitle}</span>
        <LanguageSelect />
      </header>
      <main id="main" className={styles.main}>
        <h1 className={styles.title}>{tCrimson('profiles.title')}</h1>
        <p className={styles.server}>{server.name}</p>
        {profiles.status === 'pending' && <LoadingState variant="section" />}
        {profiles.status === 'error' && (
          <ErrorState variant="section" error={profiles.error} onRetry={profiles.retry} />
        )}
        {profiles.status === 'success' && (
          <ul className={styles.grid} aria-busy={busy || undefined}>
            {profiles.data.map((profile, index) => {
              const pending = profile.id === pendingProfileId;
              const locked = profile.hasPassword && !profile.remembered;
              return (
                <li key={profile.id} className={styles.item}>
                  <button
                    type="button"
                    className={styles.profile}
                    disabled={busy && !pending}
                    aria-busy={pending || undefined}
                    data-autofocus={index === 0 || undefined}
                    onClick={() => {
                      onSelect(profile);
                    }}
                  >
                    <span className={styles.avatar}>
                      <Avatar
                        name={profile.name}
                        imageUrl={profile.imageUrl}
                        size="lg"
                        className={styles.avatarImage}
                      />
                      {pending && (
                        <span className={styles.pending}>
                          <Spinner size="lg" />
                        </span>
                      )}
                      {locked && (
                        <span className={styles.lock}>
                          <Icon name="lock" />
                          <span className="visually-hidden">{t('profiles.needsPassword')}</span>
                        </span>
                      )}
                    </span>
                    <span className={styles.name}>{profile.name}</span>
                  </button>
                  {profile.remembered && (
                    <button
                      type="button"
                      className={styles.forget}
                      aria-label={t('profiles.forget', { name: profile.name })}
                      disabled={busy}
                      onClick={() => {
                        onForget(profile);
                      }}
                    >
                      {t('profiles.forgetShort')}
                    </button>
                  )}
                </li>
              );
            })}
            <li className={styles.item}>
              <button
                type="button"
                className={styles.profile}
                disabled={busy}
                onClick={onOtherUser}
              >
                <span className={`${styles.avatar} ${styles.add}`}>
                  <Icon name="plus" />
                </span>
                <span className={styles.name}>{tCrimson('profiles.other')}</span>
              </button>
            </li>
          </ul>
        )}
        {error && (
          <div className={styles.error}>
            <Notice kind="error">{errorText(tErrors, error).message}</Notice>
          </div>
        )}
        {(onQuickConnect ?? onChangeServer) && (
          <div className={styles.actions}>
            {onQuickConnect && (
              <CrimsonButton variant="outline" icon={<Icon name="link" />} onClick={onQuickConnect}>
                {t('credentials.useQuickConnect')}
              </CrimsonButton>
            )}
            {onChangeServer && (
              <CrimsonButton
                variant="outline"
                icon={<Icon name="server" />}
                onClick={onChangeServer}
              >
                {t('changeServer')}
              </CrimsonButton>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
