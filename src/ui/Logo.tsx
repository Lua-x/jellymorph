import styles from './Logo.module.css';

/**
 * The Jellymorph mark: a rounded square whose top-right corner has morphed into a circle.
 * Colors come from --logo-shape and --logo-dot so every theme can tint it.
 */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className ? `${styles.logo} ${className}` : styles.logo}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        className={styles.shape}
        d="M14 4H24A20 20 0 0 1 44 24V34A10 10 0 0 1 34 44H14A10 10 0 0 1 4 34V14A10 10 0 0 1 14 4Z"
      />
      <circle className={styles.dot} cx="17" cy="31" r="5" />
    </svg>
  );
}
