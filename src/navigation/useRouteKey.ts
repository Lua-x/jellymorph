import { useLocation } from 'react-router';
import { backgroundOf } from './overlay';

/**
 * Changes whenever the page changes (path only, not the query). An overlay above a page keeps
 * the key of that page. Themes key page transitions on it without depending on the router API.
 */
export function useRouteKey(): string {
  const location = useLocation();
  return (backgroundOf(location) ?? location).pathname;
}
