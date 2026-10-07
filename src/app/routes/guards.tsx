import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { getActiveSession, useSessionStore } from '@/api/session-store';
import { useCurrentServer } from '@/hooks/useSession';
import { paths, returnTarget, type ReturnState } from '@/navigation/paths';
import { useToasts } from '@/ui/toast-store';

/** Sign-in screens and the app need a chosen server. */
export function ServerGuard() {
  const server = useCurrentServer();
  if (!server) return <Navigate to={paths.servers} replace />;
  return <Outlet />;
}

/** App pages need a signed-in user; otherwise go to sign-in and come back afterwards. */
export function SessionGuard() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const session = useSessionStore(getActiveSession);
  const notice = useSessionStore((state) => state.notice);
  const showToast = useToasts((state) => state.show);

  useEffect(() => {
    if (notice === 'expired') showToast('info', t('credentials.expired'));
  }, [notice, showToast, t]);

  if (!session) {
    const state: ReturnState = { from: `${location.pathname}${location.search}` };
    return <Navigate to={paths.login} state={state} replace />;
  }
  return <Outlet />;
}

/**
 * Sign-in screens are pointless while a user is signed in (e.g. after "back"). Right after a
 * sign-in this also performs the redirect to the page that asked for it.
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useSessionStore(getActiveSession);
  if (session) return <Navigate to={returnTarget(location.state)} replace />;
  return children;
}
