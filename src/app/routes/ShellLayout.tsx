import { useEffect, useRef } from 'react';
import { useNavModel } from '@/hooks/useNavModel';
import { useServerEvents } from '@/hooks/useServerEvents';
import { useRouteKey } from '@/navigation/useRouteKey';
import { ThemeSlot } from '@/themes/ThemeSlot';
import { ShellRoutes } from './ShellRoutes';

/**
 * Moves focus to the main region after client-side navigation (not on the first load). Opening
 * or closing an overlay is no page change: the page underneath keeps its scroll position.
 */
function useFocusMainOnNavigation() {
  const page = useRouteKey();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [page]);
}

export function ShellLayout() {
  const nav = useNavModel();
  useFocusMainOnNavigation();
  useServerEvents();
  return <ThemeSlot name="AppShell" props={{ nav, children: <ShellRoutes /> }} />;
}
