import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { updateUserData, type UserDataUpdate } from '@/api/items';
import type { SessionKey } from '@/api/session-store';
import type { MediaItem, UserItemData } from '@/domain/types';
import { useToasts } from '@/ui/toast-store';
import { queryKeys } from './query-keys';
import { useActiveSession } from './useSession';

type UserDataPatch = Partial<UserItemData>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns `value` with the user data of every object with `id === itemId` patched. Unchanged
 * branches keep their identity, so React only re-renders what changed.
 */
export function patchUserData(value: unknown, itemId: string, patch: UserDataPatch): unknown {
  if (Array.isArray(value)) {
    const entries = value as unknown[];
    const next = entries.map((entry) => patchUserData(entry, itemId, patch));
    return next.some((entry, index) => entry !== entries[index]) ? next : value;
  }
  if (!isRecord(value)) return value;
  let next: Record<string, unknown> = value;
  if (value.id === itemId && isRecord(value.userData)) {
    next = { ...value, userData: { ...value.userData, ...patch } };
  }
  for (const [key, child] of Object.entries(next)) {
    if (key === 'userData' || !isRecord(child)) continue;
    const patched = patchUserData(child, itemId, patch);
    if (patched !== child) {
      if (next === value) next = { ...value };
      next[key] = patched;
    }
  }
  return next;
}

function patchCaches(client: QueryClient, key: SessionKey, itemId: string, patch: UserDataPatch) {
  client.setQueriesData({ queryKey: queryKeys.user(key) }, (data: unknown) =>
    patchUserData(data, itemId, patch),
  );
}

export interface MediaActions {
  toggleFavorite: (item: Pick<MediaItem, 'id' | 'userData'>) => void;
  togglePlayed: (item: Pick<MediaItem, 'id' | 'userData'>) => void;
  /** Starts playback; null until the player exists (phase 3). */
  play: ((item: MediaItem, options?: { fromStart?: boolean }) => void) | null;
}

/** Favorite / played changes with an optimistic update of every cached list. */
export function useMediaActions(): MediaActions {
  const { t } = useTranslation('content');
  const client = useQueryClient();
  const { api, key } = useActiveSession();
  const showToast = useToasts((state) => state.show);

  const apply = (
    item: Pick<MediaItem, 'id' | 'userData'>,
    change: UserDataUpdate,
    optimistic: UserDataPatch,
  ) => {
    const previous = item.userData;
    patchCaches(client, key, item.id, optimistic);
    updateUserData(api, item.id, change)
      .then((confirmed) => {
        patchCaches(client, key, item.id, confirmed);
        // Series counts, "next up" and "continue watching" depend on the change.
        void client.invalidateQueries({ queryKey: queryKeys.user(key), refetchType: 'active' });
      })
      .catch(() => {
        patchCaches(client, key, item.id, previous);
        showToast('error', t('actions.saveFailed'));
      });
  };

  return {
    toggleFavorite: (item) => {
      const favorite = !item.userData.favorite;
      apply(item, { favorite }, { favorite });
    },
    togglePlayed: (item) => {
      const played = !item.userData.played;
      apply(
        item,
        { played },
        {
          played,
          progress: null,
          positionTicks: 0,
          unplayedCount: played ? 0 : item.userData.unplayedCount,
        },
      );
    },
    play: null,
  };
}
