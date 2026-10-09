import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './CrimsonButton.module.css';

type Variant = 'light' | 'dim' | 'outline' | 'round';
type Size = 'md' | 'lg';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

function classes({ variant = 'light', size = 'md' }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(' ');
}

interface CrimsonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * White for the main action, translucent grey for the rest, outlined for quiet page actions,
 * circles for icon actions (with `aria-label`). Hover and focus look the same.
 */
export function CrimsonButton({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: CrimsonButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface CrimsonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  overlay?: boolean;
  onClick?: () => void;
}

/** A router link that looks like a CrimsonButton. */
export function CrimsonLink({
  to,
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: CrimsonLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
