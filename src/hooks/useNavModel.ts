import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { signOutOnServer } from '@/api/auth';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import { visibleIds } from '@/domain/layout';
import type { LibraryKind } from '@/domain/types';
import type { NavIcon, NavItem, NavModel } from '@/navigation/nav-model';
import { paths } from '@/navigation/paths';
import { useEffectiveLayout } from './useLayout';
import { useActiveSession } from './useSession';
import { useCurrentUser, useLibraries } from './useUser';

const LIBRARY_ICONS: Record<LibraryKind, NavIcon> = {
  movies: 'movies',
  shows: 'shows',
  collections: 'collections',
  videos: 'videos',
  mixed: 'folder',
};

/** jellyfin-web's dashboard; through the container's proxy this stays on the own origin. */
export function dashboardUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/web/#/dashboard`;
}

/** Every navigation entry in the standard order: home, the libraries, search, favorites. */
export function useNavEntries(): NavItem[] {
  const { t } = useTranslation();
  const libraries = useLibraries();
  return [
    { id: 'home', label: t('nav.home'), to: paths.home, icon: 'home', group: 'main' },
    ...(libraries.status === 'success' ? libraries.data : []).map((library): NavItem => ({
      id: `library-${library.id}`,
      label: library.name,
      to: paths.library(library.id),
      icon: LIBRARY_ICONS[library.kind],
      group: 'library',
    })),
    { id: 'search', label: t('nav.search'), to: paths.search(), icon: 'search', group: 'main' },
    {
      id: 'favorites',
      label: t('nav.favorites'),
      to: paths.favorites,
      icon: 'favorites',
      group: 'main',
    },
  ];
}

export function useNavModel(): NavModel {
  const config = useAppConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, server, key } = useActiveSession();
  const user = useCurrentUser();
  const deactivate = useSessionStore((state) => state.deactivate);
  const removeSession = useSessionStore((state) => state.removeSession);
  const [signingOut, setSigningOut] = useState(false);
  const layout = useEffectiveLayout();

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

  const items = useNavEntries();
  const byId = new Map(items.map((item) => [item.id, item]));

  return {
    appTitle: config.appTitle,
    // In the order of the arrangement (phase 14), without the entries it hides.
    items: visibleIds(
      items.map((item) => item.id),
      layout.nav,
    )
      .map((id) => byId.get(id))
      .filter((item): item is NavItem => item !== undefined),
    user: {
      name: user.status === 'success' ? user.data.name : session.userName,
      imageUrl: user.status === 'success' ? user.data.imageUrl : null,
    },
    serverName: server.name,
    settings: paths.settings,
    dashboard:
      user.status === 'success' && user.data.isAdministrator && !config.demoMode
        ? dashboardUrl(server.url)
        : null,
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
