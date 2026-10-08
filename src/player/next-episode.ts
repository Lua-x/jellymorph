/**
 * The episode after the current one (docs/architecture.md §9.10), and when to offer it: at the
 * start of the outro segment, otherwise 30 s before the end.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import { imageUrls } from '@/api/items';
import { toMediaItem } from '@/domain/map';
import type { MediaItem } from '@/domain/types';
import type { PlayerSegment } from './model';

export const NEXT_UP_LEAD_SECONDS = 30;
export const NEXT_UP_COUNTDOWN_SECONDS = 10;

export async function fetchNextEpisode(
  api: Api,
  seriesId: string,
  episodeId: string,
  signal?: AbortSignal,
): Promise<MediaItem | null> {
  try {
    const { data } = await getShowApi(api).getEpisodes(
      {
        seriesId,
        startItemId: episodeId,
        limit: 2,
        enableUserData: true,
        enableImageTypes: ['Primary', 'Thumb', 'Backdrop'],
        imageTypeLimit: 1,
        fields: ['Overview'],
      },
      { signal },
    );
    const items = data.Items ?? [];
    const index = items.findIndex((item) => item.Id === episodeId);
    const next = index >= 0 ? items[index + 1] : undefined;
    return next ? toMediaItem(next, imageUrls(api)) : null;
  } catch {
    return null;
  }
}

/** Time from which the next episode is offered. */
export function nextUpStart(segments: readonly PlayerSegment[], duration: number): number {
  const outro = segments.find((segment) => segment.kind === 'outro');
  if (outro && outro.start < duration) return outro.start;
  return Math.max(0, duration - NEXT_UP_LEAD_SECONDS);
}
