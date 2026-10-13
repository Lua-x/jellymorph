import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './HorizonButton.module.css';

type Variant = 'primary' | 'light' | 'secondary' | 'round';
type Size = 'md' | 'lg';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

function classes({ variant = 'secondary', size = 'md' }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(' ');
}

interface HorizonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Blue for playing, light and slate for the rest, circles for icon actions (with `aria-label`).
 * Hover and focus look the same: brighter fill and a white ring.
 */
export function HorizonButton({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: HorizonButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface HorizonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a HorizonButton. */
export function HorizonLink({
  to,
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: HorizonLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
