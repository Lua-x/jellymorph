import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { backgroundOf, opensAsOverlay, overlayState } from '@/navigation/overlay';

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
  /**
   * Open the target above the current page (themes with `detailPresentation: 'modal'`). Only
   * item details can; other targets stay normal links. From inside an overlay the new one
   * replaces it, so Back and Close always return to the page.
   */
  overlay?: boolean;
  ref?: Ref<HTMLAnchorElement>;
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
  overlay = false,
  ...rest
}: AppLinkProps) {
  const location = useLocation();
  if (!nav) {
    const asOverlay = overlay && opensAsOverlay(to);
    return (
      <Link
        {...rest}
        to={to}
        className={className}
        onClick={onClick}
        state={asOverlay ? overlayState(location) : undefined}
        replace={asOverlay && backgroundOf(location) !== null}
      >
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
