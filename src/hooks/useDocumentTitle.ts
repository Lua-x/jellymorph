import { useEffect } from 'react';
import { useAppConfig } from '@/config/context';

/**
 * Sets "<page> · <app title>" as the browser title. The previous title comes back when the
 * component unmounts, e.g. when an overlay closes above a page that stays mounted.
 */
export function useDocumentTitle(page: string | null): void {
  const { appTitle } = useAppConfig();
  useEffect(() => {
    const previous = document.title;
    document.title = page ? `${page} · ${appTitle}` : appTitle;
    return () => {
      document.title = previous;
    };
  }, [page, appTitle]);
}
