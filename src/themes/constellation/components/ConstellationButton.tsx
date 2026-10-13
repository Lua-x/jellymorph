import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './ConstellationButton.module.css';

type Variant = 'primary' | 'secondary' | 'round';
type Size = 'md' | 'lg';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

function classes({ variant = 'secondary', size = 'md' }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(' ');
}

interface ConstellationButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Light for playing, translucent with a thin border for the rest, circles for icon actions (with
 * `aria-label`). Hover and focus look the same: brighter fill, a white ring and a soft glow.
 */
export function ConstellationButton({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ConstellationButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface ConstellationLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a ConstellationButton. */
export function ConstellationLink({
  to,
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: ConstellationLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
