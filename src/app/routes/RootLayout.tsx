import type { ReactNode } from 'react';
import { Outlet, useRouteError } from 'react-router';
import { describeError } from '@/api/errors';
import { getFixedServerUrl } from '@/config/app-config';
import { useAppConfig } from '@/config/context';
import { useFixedServer } from '@/hooks/auth/useFixedServer';
import { ThemeSlot } from '@/themes/ThemeSlot';
import { RouteAnnouncer } from '@/ui/RouteAnnouncer';
import { ToastViewport } from '../ToastViewport';

function FixedServerGate({ url, children }: { url: string; children: ReactNode }) {
  const server = useFixedServer(url);
  if (server.status === 'pending')
    return <ThemeSlot name="LoadingState" props={{ variant: 'page' }} />;
  if (server.status === 'error') {
    return (
      <main id="main">
        <ThemeSlot name="ErrorState" props={{ error: server.error, onRetry: server.retry }} />
      </main>
    );
  }
  return children;
}

export function RootLayout() {
  const config = useAppConfig();
  const fixedUrl = getFixedServerUrl(config, window.location.origin);
  return (
    <>
      {fixedUrl ? (
        <FixedServerGate url={fixedUrl}>
          <Outlet />
        </FixedServerGate>
      ) : (
        <Outlet />
      )}
      <ToastViewport />
      <RouteAnnouncer />
    </>
  );
}

/** Last line of defense for unexpected errors while rendering a route. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return (
    <main id="main">
      <ThemeSlot
        name="ErrorState"
        props={{
          error: describeError(error),
          onRetry: () => {
            window.location.reload();
          },
        }}
      />
    </main>
  );
}
