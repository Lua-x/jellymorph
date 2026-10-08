import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { fetchLocalTrailerId, updateUserData, type UserDataUpdate } from '@/api/items';
import type { SessionKey } from '@/api/session-store';
import type { ItemKind, MediaItem, UserItemData } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { preload } from '@/navigation/preload';
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

const PLAYABLE: ReadonlySet<ItemKind> = new Set(['movie', 'episode', 'video', 'series']);

/** Items with a "Play" button: videos directly, series via their next episode. */
export function isPlayable(item: Pick<MediaItem, 'kind'>): boolean {
  return PLAYABLE.has(item.kind);
}

/** Where playback starts: ask when there is a saved position, or decide up front. */
export type PlayStart = 'ask' | 'resume' | 'beginning';

export interface MediaActions {
  toggleFavorite: (item: Pick<MediaItem, 'id' | 'userData'>) => void;
  togglePlayed: (item: Pick<MediaItem, 'id' | 'userData'>) => void;
  /** Opens the player. Series play their next episode. */
  play: (item: Pick<MediaItem, 'id' | 'userData'>, start?: PlayStart) => void;
  /** Plays the item's local trailer (see ItemDetail.localTrailerCount). */
  playTrailer: (item: Pick<MediaItem, 'id'>) => void;
  /** Loads the player ahead of time; call when a play button gets focus or hover. */
  preparePlayback: () => void;
}

/** Favorite / played changes with an optimistic update of every cached list, and playback. */
export function useMediaActions(): MediaActions {
  const { t } = useTranslation('content');
  const navigate = useNavigate();
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
    play: (item, start = 'ask') => {
      const seconds =
        start === 'beginning'
          ? 0
          : start === 'resume'
            ? item.userData.positionTicks / 10_000_000
            : undefined;
      void navigate(paths.play(item.id, seconds));
    },
    playTrailer: (item) => {
      fetchLocalTrailerId(api, item.id)
        .then((trailerId) => {
          if (trailerId) void navigate(paths.play(trailerId, 0));
          else showToast('error', t('actions.trailerFailed'));
        })
        .catch(() => {
          showToast('error', t('actions.trailerFailed'));
        });
    },
    preparePlayback: () => {
      preload('player');
    },
  };
}
