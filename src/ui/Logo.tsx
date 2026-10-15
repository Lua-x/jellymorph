import styles from './Logo.module.css';

/**
 * The Jellymorph mark: a play symbol cut into three facets on a rounded square, like a gem
 * catching light from different sides (the app icon is the same shape, public/favicon.svg).
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
      <rect className={styles.shape} x="2" y="2" width="44" height="44" rx="12" />
      {/* The deep facet spans the whole triangle, so no background shows at the seams. */}
      <path className={styles.facetDeep} d="M16 12L35 24L16 36Z" />
      <path className={styles.facetLight} d="M16 12L35 24L22.3 24Z" />
      <path className={styles.facetMid} d="M16 36L16 12L22.3 24Z" />
    </svg>
  );
}
