import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './GlassButton.module.css';

type Variant = 'solid' | 'glass' | 'round';
type Size = 'md' | 'lg';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Text above pictures stays light whatever the color scheme. */
  onImage?: boolean;
}

function classes({ variant = 'glass', size = 'md', onImage = false }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], onImage && styles.onImage, extra]
    .filter(Boolean)
    .join(' ');
}

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Pill buttons: solid for the main action, frosted glass for the rest, circles for icon actions
 * (with `aria-label`). Hover and focus look the same: a little larger, lighter, with a ring.
 */
export function GlassButton({
  variant,
  size,
  icon,
  onImage,
  className,
  children,
  type = 'button',
  ...rest
}: GlassButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size, onImage }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface GlassLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a GlassButton. */
export function GlassLink({
  to,
  variant,
  size,
  icon,
  onImage,
  className,
  children,
  ...rest
}: GlassLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size, onImage }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
