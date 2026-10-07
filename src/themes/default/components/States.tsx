import { useTranslation } from 'react-i18next';
import type { EmptyStateProps, ErrorStateProps, LoadingStateProps } from '../../contract';
import { Button } from './Button';
import { Icon } from './icons';
import { Spinner } from './Spinner';
import styles from './States.module.css';
import { errorText } from './text';

export function LoadingState({ variant = 'page', label }: LoadingStateProps) {
  const { t } = useTranslation();
  const text = label ?? t('loading');
  return (
    <div className={`${styles.state} ${styles[variant]}`} role="status">
      <Spinner size={variant === 'inline' ? 'md' : 'lg'} className={styles.spinner} />
      <span className={variant === 'page' ? styles.loadingLabel : 'visually-hidden'}>{text}</span>
    </div>
  );
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={`${styles.state} ${styles.section}`}>
      <span className={styles.icon}>
        <Icon name="info" />
      </span>
      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry, variant = 'page' }: ErrorStateProps) {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const { title, message } = errorText(tErrors, error);
  return (
    <div className={`${styles.state} ${styles[variant]}`} role="alert">
      <span className={`${styles.icon} ${styles.danger}`}>
        <Icon name="alert" />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="secondary" icon={<Icon name="refresh" />} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}
