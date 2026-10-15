import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { distributeLayoutDefaults, fetchLayoutDefaults } from '@/api/layout-defaults';
import {
  effectiveLayout,
  visibleIds,
  type DetailActionId,
  type FactId,
  type Layout,
  type LayoutDefaults,
} from '@/domain/layout';
import type { QueryResult } from '@/domain/types';
import { readString, writeString } from '@/lib/storage';
import { useUserSettings } from '@/settings/user-settings';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useIsAdmin } from './useAdminAccess';
import { useActiveSession } from './useSession';

/*
 * The arrangement in force (phase 14): the user's own lists, else the administrator's default
 * for everybody, else the theme's own order. See domain/layout.ts.
 */

export const layoutDefaultsKey = (key: { serverId: string; userId: string }) =>
  [...queryKeys.user(key), 'layoutDefaults'] as const;

/** The administrator's default arrangement, as copied to this user. */
export function useLayoutDefaults(): QueryResult<{ layout: Layout; version: string | null }> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: layoutDefaultsKey(key),
      queryFn: ({ signal }) => fetchLayoutDefaults(api, key.userId, signal),
      staleTime: 5 * 60_000,
    }),
  );
}

/** The user's own arrangement (settings, synced with the server). */
export function useOwnLayout(): Layout {
  return useUserSettings((state) => state.values?.layout) ?? EMPTY;
}

const EMPTY: Layout = {};

export function useEffectiveLayout(): Layout {
  const own = useOwnLayout();
  const defaults = useLayoutDefaults();
  return effectiveLayout(own, defaults.status === 'success' ? defaults.data.layout : EMPTY);
}

export interface DetailLayout {
  /** Buttons to show, in order. */
  actions: readonly DetailActionId[];
  /** Facts to show, in order (only those the theme shows at all). */
  facts: readonly FactId[];
}

/** Buttons and facts of detail pages for a theme's defaults. */
export function useDetailLayout(defaults: LayoutDefaults): DetailLayout {
  const layout = useEffectiveLayout();
  return {
    actions: visibleIds(defaults.detailActions, layout.detailActions) as DetailActionId[],
    facts: visibleIds(defaults.facts, layout.facts) as FactId[],
  };
}

const UPKEEP_FLAG = 'jellymorph.layoutDefaultsChecked';

/**
 * Users created after the administrator saved the default have no copy yet. Whenever an
 * administrator opens Jellymorph (once per browser session and server), outdated or missing
 * copies are refreshed in the background.
 */
export function useLayoutDefaultsUpkeep(): void {
  const { api, key } = useActiveSession();
  const isAdmin = useIsAdmin();
  const defaults = useLayoutDefaults();
  const version = defaults.status === 'success' ? defaults.data.version : null;
  const layout = defaults.status === 'success' ? defaults.data.layout : null;
  const serverId = key.serverId;

  useEffect(() => {
    if (!isAdmin || !version || !layout) return;
    const flag = `${UPKEEP_FLAG}.${serverId}`;
    if (readString('session', flag) === version) return;
    writeString('session', flag, version);
    distributeLayoutDefaults(api, { layout, version }, { onlyOutdated: true }).catch(
      (error: unknown) => {
        console.warn('The default arrangement could not be checked for all users', error);
      },
    );
  }, [api, isAdmin, layout, serverId, version]);
}
