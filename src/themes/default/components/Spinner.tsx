import styles from './Spinner.module.css';

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={[styles.spinner, styles[size], className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
