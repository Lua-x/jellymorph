import { useEffect } from 'react';
import { useAppConfig } from '@/config/context';

/** Sets "<page> · <app title>" as the browser title. */
export function useDocumentTitle(page: string | null): void {
  const { appTitle } = useAppConfig();
  useEffect(() => {
    document.title = page ? `${page} · ${appTitle}` : appTitle;
  }, [page, appTitle]);
}
