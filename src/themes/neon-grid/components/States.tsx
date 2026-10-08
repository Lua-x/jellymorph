import { useTranslation } from 'react-i18next';
import type { EmptyStateProps, ErrorStateProps, LoadingStateProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { errorText } from '../../default/components/text';
import { NeonButton } from './NeonButton';
import styles from './States.module.css';

const BLOCKS = 6;

/** The segment meter on its own, e.g. next to a status text. Decorative. */
export function Meter({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? `${styles.meter} ${styles.small}` : styles.meter} aria-hidden="true">
      {Array.from({ length: BLOCKS }, (_, index) => (
        <span key={index} style={{ animationDelay: `${String(index * 120)}ms` }} />
      ))}
    </span>
  );
}

/** "Transferring data" with a segment meter that fills step by step. */
export function LoadingState({ variant = 'page', label }: LoadingStateProps) {
  const { t } = useTranslation('theme-neon-grid');
  const text = label ?? t('states.loading');
  return (
    <div className={`${styles.state} ${styles[variant]}`} role="status">
      <Meter small={variant === 'inline'} />
      <span className={variant === 'inline' ? 'visually-hidden' : styles.loadingLabel}>{text}</span>
    </div>
  );
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={`${styles.state} ${styles.section} ${styles.box}`}>
      <span className={styles.prompt} aria-hidden="true">
        &gt;_
      </span>
      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {action && (
        <NeonButton variant="secondary" onClick={action.onAction}>
          {action.label}
        </NeonButton>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry, variant = 'page' }: ErrorStateProps) {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const { title, message } = errorText(tErrors, error);
  return (
    <div
      className={`${styles.state} ${styles[variant]} ${styles.box} ${styles.error}`}
      role="alert"
    >
      <span className={styles.code} aria-hidden="true">
        <Icon name="alert" />
        {tNeon('states.errorCode')} {error.status ?? error.kind.toUpperCase()}
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <NeonButton variant="secondary" icon={<Icon name="refresh" />} onClick={onRetry}>
          {t('actions.retry')}
        </NeonButton>
      )}
    </div>
  );
}
