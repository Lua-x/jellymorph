import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';

interface AppLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  /** Mark the link as current page when its route is active (navigation menus). */
  nav?: boolean;
  /** Only match the exact path for `nav` links. */
  end?: boolean;
  activeClassName?: string;
}

/** Routing link for themes, so themes do not depend on the router API directly. */
export function AppLink({ to, className, children, nav, end, activeClassName }: AppLinkProps) {
  if (!nav) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [className, isActive ? activeClassName : undefined].filter(Boolean).join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
