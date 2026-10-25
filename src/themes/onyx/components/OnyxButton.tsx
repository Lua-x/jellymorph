import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './OnyxButton.module.css';

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

interface OnyxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * White for the main action, translucent blue for the rest, circles for icon actions (with
 * `aria-label`). Hover and focus look the same: a brighter fill and a white ring.
 */
export function OnyxButton({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: OnyxButtonProps) {
  return (
    <button {...rest} type={type} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
}

interface OnyxLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a OnyxButton. */
export function OnyxLink({ to, variant, size, icon, className, children, ...rest }: OnyxLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size }, className)}>
      {icon}
      {children && <span className={styles.label}>{children}</span>}
    </AppLink>
  );
}
