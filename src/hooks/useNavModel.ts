import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { signOutOnServer } from '@/api/auth';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import type { NavModel } from '@/navigation/nav-model';
import { paths } from '@/navigation/paths';
import { useActiveSession } from './useSession';
import { useCurrentUser } from './useUser';

export function useNavModel(): NavModel {
  const { t } = useTranslation();
  const config = useAppConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, server, key } = useActiveSession();
  const user = useCurrentUser();
  const deactivate = useSessionStore((state) => state.deactivate);
  const removeSession = useSessionStore((state) => state.removeSession);
  const [signingOut, setSigningOut] = useState(false);

  const leave = (target: string) => {
    queryClient.clear();
    void navigate(target, { replace: true });
  };

  /** Tab-only sessions cannot be resumed later, so leaving them means signing out. */
  const endOrKeepSession = async () => {
    if (session.remembered) {
      deactivate();
    } else {
      await signOutOnServer(server, session);
      removeSession(key);
    }
  };

  return {
    appTitle: config.appTitle,
    items: [{ id: 'home', label: t('nav.home'), to: paths.home, icon: 'home' }],
    user: {
      name: user.status === 'success' ? user.data.name : session.userName,
      imageUrl: user.status === 'success' ? user.data.imageUrl : null,
    },
    serverName: server.name,
    switchProfile: () => {
      void endOrKeepSession().then(() => {
        leave(paths.login);
      });
    },
    changeServer: server.fixed
      ? null
      : () => {
          void endOrKeepSession().then(() => {
            leave(paths.servers);
          });
        },
    signOut: () => {
      setSigningOut(true);
      void signOutOnServer(server, session).then(() => {
        removeSession(key);
        setSigningOut(false);
        leave(paths.login);
      });
    },
    signingOut,
  };
}
