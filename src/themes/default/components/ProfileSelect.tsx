import { useTranslation } from 'react-i18next';
import type { ProfileSelectProps } from '../../contract';
import { AuthLayout } from './AuthLayout';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Icon } from './icons';
import { Notice } from './Notice';
import styles from './ProfileSelect.module.css';
import { Spinner } from './Spinner';
import { ErrorState, LoadingState } from './States';
import { errorText } from './text';

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
  const { t: tErrors } = useTranslation('errors');
  const busy = pendingProfileId !== null;

  return (
    <AuthLayout
      title={t('profiles.title')}
      subtitle={server.name}
      wide
      actions={
        <>
          {onQuickConnect && (
            <Button variant="ghost" icon={<Icon name="link" />} onClick={onQuickConnect}>
              {t('credentials.useQuickConnect')}
            </Button>
          )}
          {onChangeServer && (
            <Button variant="ghost" icon={<Icon name="server" />} onClick={onChangeServer}>
              {t('changeServer')}
            </Button>
          )}
        </>
      }
    >
      {profiles.status === 'pending' && <LoadingState variant="section" />}
      {profiles.status === 'error' && (
        <ErrorState variant="section" error={profiles.error} onRetry={profiles.retry} />
      )}
      {profiles.status === 'success' && (
        <ul className={styles.grid} aria-busy={busy || undefined}>
          {profiles.data.map((profile) => {
            const pending = profile.id === pendingProfileId;
            const locked = profile.hasPassword && !profile.remembered;
            return (
              <li key={profile.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.profile}
                  disabled={busy && !pending}
                  aria-busy={pending || undefined}
                  onClick={() => {
                    onSelect(profile);
                  }}
                >
                  <span className={styles.avatar}>
                    <Avatar name={profile.name} imageUrl={profile.imageUrl} size="lg" />
                    {pending && (
                      <span className={styles.pending}>
                        <Spinner size="lg" />
                      </span>
                    )}
                  </span>
                  <span className={styles.name}>{profile.name}</span>
                  {locked && (
                    <span className={styles.badge}>
                      <Icon name="lock" />
                      <span className="visually-hidden">{t('profiles.needsPassword')}</span>
                    </span>
                  )}
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
            <button type="button" className={styles.profile} disabled={busy} onClick={onOtherUser}>
              <span className={`${styles.avatar} ${styles.add}`}>
                <Icon name="plus" />
              </span>
              <span className={styles.name}>{t('profiles.other')}</span>
            </button>
          </li>
        </ul>
      )}
      {error && (
        <div className={styles.error}>
          <Notice kind="error">{errorText(tErrors, error).message}</Notice>
        </div>
      )}
    </AuthLayout>
  );
}
