import { useTranslation } from 'react-i18next';
import type { ProfileSelectProps } from '../../contract';
import { Avatar } from '../../default/components/Avatar';
import { Icon } from '../../default/components/icons';
import { errorText } from '../../default/components/text';
import { AuthTerminal } from './AuthTerminal';
import { Notice } from './FormFields';
import { NeonButton } from './NeonButton';
import styles from './ProfileSelect.module.css';
import { ErrorState, LoadingState, Meter } from './States';

/** "Choose operator": profiles as chamfered ID cards. */
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
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const busy = pendingProfileId !== null;

  return (
    <AuthTerminal
      title={t('profiles.title')}
      subtitle={`${tNeon('auth.operatorsHint')} · ${server.name}`}
      wide
      actions={
        <>
          {onQuickConnect && (
            <NeonButton variant="ghost" icon={<Icon name="link" />} onClick={onQuickConnect}>
              {t('credentials.useQuickConnect')}
            </NeonButton>
          )}
          {onChangeServer && (
            <NeonButton variant="ghost" icon={<Icon name="server" />} onClick={onChangeServer}>
              {t('changeServer')}
            </NeonButton>
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
                  onClick={() => {
                    onSelect(profile);
                  }}
                >
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.avatarFrame}>
                    <Avatar
                      name={profile.name}
                      imageUrl={profile.imageUrl}
                      size="lg"
                      className={styles.avatar}
                    />
                    {pending && (
                      <span className={styles.pending}>
                        <Meter />
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
              <span className={styles.number} aria-hidden="true">
                +
              </span>
              <span className={`${styles.avatarFrame} ${styles.add}`}>
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
    </AuthTerminal>
  );
}
