import type { Api } from '@jellyfin/sdk/lib/api';
import type { TrickplayInfoDto } from '@jellyfin/sdk/lib/generated-client/models/trickplay-info-dto';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { imageUrls } from '@/api/items';
import { toMediaItem } from '@/domain/map';
import type { MediaItem } from '@/domain/types';
import type { Chapter } from './model';
import { toSeconds } from './model';

/** What the player needs to know about an item beyond the card data. */
export interface PlaybackItem {
  item: MediaItem;
  chapters: Chapter[];
  /** Trickplay resolutions per media source id. */
  trickplay: Record<string, Record<string, TrickplayInfoDto> | null>;
}

export async function fetchPlaybackItem(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<PlaybackItem> {
  const { data } = await getLibraryApi(api).getItem({ itemId }, { signal });
  return {
    item: toMediaItem(data, imageUrls(api)),
    chapters: (data.Chapters ?? [])
      .map((chapter) => ({
        start: toSeconds(chapter.StartPositionTicks ?? 0),
        name: chapter.Name ?? '',
      }))
      .sort((a, b) => a.start - b.start),
    trickplay: data.Trickplay ?? {},
  };
}
