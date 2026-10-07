import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { getUserViewApi } from '@jellyfin/sdk/lib/utils/api/user-view-api';
import type { CurrentUser, Library, LibraryKind } from '@/domain/types';
import { itemImageUrl, userImageUrl } from './urls';

/** Library types Jellymorph v1 can show. Music, books, photos, live TV and playlists stay hidden. */
const LIBRARY_KINDS: Partial<Record<string, LibraryKind>> = {
  movies: 'movies',
  tvshows: 'shows',
  boxsets: 'collections',
  homevideos: 'videos',
  folders: 'mixed',
};

export function libraryKind(collectionType: string | null | undefined): LibraryKind | null {
  if (collectionType === null || collectionType === undefined) return 'mixed';
  return LIBRARY_KINDS[collectionType] ?? null;
}

export async function fetchCurrentUser(api: Api, signal?: AbortSignal): Promise<CurrentUser> {
  const { data } = await getUserApi(api).getCurrentUser({ signal });
  return {
    id: data.Id ?? '',
    name: data.Name ?? '',
    imageUrl:
      data.Id && data.PrimaryImageTag ? userImageUrl(api, data.Id, data.PrimaryImageTag) : null,
    isAdministrator: data.Policy?.IsAdministrator === true,
    latestExcludes: data.Configuration?.LatestItemsExcludes ?? [],
  };
}

function toLibrary(api: Api, view: BaseItemDto): Library | null {
  const kind = libraryKind(view.CollectionType);
  if (!kind || !view.Id) return null;
  const tag = view.ImageTags?.Primary;
  const hashes = view.ImageBlurHashes?.Primary as Record<string, string> | undefined;
  return {
    id: view.Id,
    name: view.Name ?? '',
    kind,
    image: tag
      ? {
          url: itemImageUrl(api, view.Id, 'Primary', { tag }),
          blurHash: hashes?.[tag] ?? null,
          aspectRatio: view.PrimaryImageAspectRatio ?? 16 / 9,
        }
      : null,
  };
}

/** The user's libraries in the order and visibility configured on the server. */
export async function fetchLibraries(api: Api, signal?: AbortSignal): Promise<Library[]> {
  const { data } = await getUserViewApi(api).getUserViews({ includeHidden: false }, { signal });
  return (data.Items ?? [])
    .map((view) => toLibrary(api, view))
    .filter((library): library is Library => library !== null);
}
