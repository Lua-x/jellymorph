import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './CobaltButton.module.css';

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

interface CobaltButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * White for the main action, translucent blue for the rest, circles for icon actions (with
 * `aria-label`). Hover and focus look the same: a brighter fill and a white ring.
 */
export function CobaltButton({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: CobaltButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface CobaltLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a CobaltButton. */
export function CobaltLink({
  to,
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: CobaltLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
