import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from './query-keys';
import { useActiveSession } from './useSession';

const SETTLE_MS = 1_500;

/**
 * Keeps cached data in sync with changes made elsewhere (another device marks an episode as
 * watched, new media is added). Events arrive in bursts, so refreshes are bundled. Without a
 * WebSocket connection the app still refreshes on window focus.
 */
export function useServerEvents(): void {
  const client = useQueryClient();
  const { api, key } = useActiveSession();
  const { serverId, userId } = key;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void client.invalidateQueries({
          queryKey: queryKeys.user({ serverId, userId }),
          refetchType: 'active',
        });
      }, SETTLE_MS);
    };
    const unsubscribe = api.subscribe(['UserDataChanged', 'LibraryChanged'], refresh);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [api, client, serverId, userId]);
}
