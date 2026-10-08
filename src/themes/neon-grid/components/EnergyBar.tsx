import type { CSSProperties } from 'react';
import styles from './EnergyBar.module.css';

/**
 * Progress as a segmented energy bar. Purely visual: callers provide the text alternative
 * (e.g. "40 % gesehen") next to it.
 */
export function EnergyBar({
  value,
  segments = 16,
  tone = 'magenta',
  className,
}: {
  /** 0..1 */
  value: number;
  segments?: number;
  tone?: 'magenta' | 'cyan' | 'yellow';
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span
      className={[styles.bar, styles[tone], className].filter(Boolean).join(' ')}
      style={{ '--segments': segments } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.fill} style={{ transform: `scaleX(${String(clamped)})` }} />
    </span>
  );
}
