import { useTranslation } from 'react-i18next';
import type { ToastProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import styles from './Toast.module.css';

const ICONS = { info: 'info', success: 'check', error: 'alert' } as const;

/** System message: chamfered panel with a colored edge per kind. */
export function Toast({ kind, message, action, onDismiss }: ToastProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.toast} ${styles[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={ICONS[kind]} className={styles.icon} />
      <p className={styles.message}>{message}</p>
      {action && (
        <button type="button" className={styles.action} onClick={action.onAction}>
          {action.label}
        </button>
      )}
      <button
        type="button"
        className={styles.close}
        aria-label={t('actions.dismiss')}
        onClick={onDismiss}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
