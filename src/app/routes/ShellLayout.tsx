import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useNavModel } from '@/hooks/useNavModel';
import { useServerEvents } from '@/hooks/useServerEvents';
import { ThemeSlot } from '@/themes/ThemeSlot';

/** Moves focus to the main region after client-side navigation (not on the first load). */
function useFocusMainOnNavigation() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);
}

export function ShellLayout() {
  const nav = useNavModel();
  useFocusMainOnNavigation();
  useServerEvents();
  return <ThemeSlot name="AppShell" props={{ nav, children: <Outlet /> }} />;
}
