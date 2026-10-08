import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link, NavLink } from 'react-router';

type AnchorProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'className' | 'children' | 'onClick'
>;

interface AppLinkProps extends AnchorProps {
  to: string;
  className?: string;
  children: ReactNode;
  /** Mark the link as current page when its route is active (navigation menus). */
  nav?: boolean;
  /** Only match the exact path for `nav` links. */
  end?: boolean;
  activeClassName?: string;
  onClick?: () => void;
}

/** Routing link for themes, so themes do not depend on the router API directly. */
export function AppLink({
  to,
  className,
  children,
  nav,
  end,
  activeClassName,
  onClick,
  ...rest
}: AppLinkProps) {
  if (!nav) {
    return (
      <Link {...rest} to={to} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <NavLink
      {...rest}
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [className, isActive ? activeClassName : undefined].filter(Boolean).join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
