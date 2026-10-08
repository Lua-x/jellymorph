import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { AppLink } from '@/ui/AppLink';
import styles from './NeonButton.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Look {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

function classes({ variant = 'primary', size = 'md', block = false }: Look, extra?: string) {
  return [styles.button, styles[variant], styles[size], block && styles.block, extra]
    .filter(Boolean)
    .join(' ');
}

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Look {
  busy?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Chamfered button: yellow for the main action, cyan outline for the rest. Focus = hover. */
export function NeonButton({
  variant,
  size,
  block,
  busy = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: NeonButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled ?? busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
    >
      <span className={styles.content}>
        {icon}
        {children}
      </span>
    </button>
  );
}

interface NeonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>, Look {
  to: string;
  onClick?: () => void;
}

/** A router link that looks like a NeonButton. */
export function NeonLink({
  to,
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: NeonLinkProps) {
  return (
    <AppLink {...rest} to={to} className={classes({ variant, size, block }, className)}>
      <span className={styles.content}>
        {icon}
        {children}
      </span>
    </AppLink>
  );
}
