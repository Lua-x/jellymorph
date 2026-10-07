import type { ReactNode } from 'react';
import { Icon } from './icons';
import styles from './Notice.module.css';

const ICONS = { info: 'info', error: 'alert', success: 'check' } as const;

export function Notice({
  kind,
  children,
}: {
  kind: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.notice} ${styles[kind]}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={ICONS[kind]} className={styles.icon} />
      <div>{children}</div>
    </div>
  );
}
