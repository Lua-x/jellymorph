import { useLocation } from 'react-router';

/**
 * Changes whenever the page changes (path only, not the query). Themes key page transitions on
 * it without depending on the router API.
 */
export function useRouteKey(): string {
  return useLocation().pathname;
}
