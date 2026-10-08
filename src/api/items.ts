import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import type { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import type { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { getFilterApi } from '@jellyfin/sdk/lib/utils/api/filter-api';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getPersonApi } from '@jellyfin/sdk/lib/utils/api/person-api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { toGenre, toItemDetail, toMediaItem, toSeason, type ImageUrlFactory } from '@/domain/map';
import type {
  FavoriteGroup,
  FavoriteGroupKind,
  Genre,
  ItemDetail,
  LibraryKind,
  MediaItem,
  SearchGroupKind,
  Season,
  UserItemData,
} from '@/domain/types';
import { itemImageUrl } from './urls';

/** Fields every card needs beyond the defaults (overview for hovers and heroes). */
const CARD_FIELDS: ItemFields[] = ['PrimaryImageAspectRatio', 'Overview', 'Genres', 'ChildCount'];
const IMAGE_TYPES = ['Primary', 'Backdrop', 'Thumb', 'Logo'] as const;

export function imageUrls(api: Api): ImageUrlFactory {
  return (itemId, type, tag, index) => itemImageUrl(api, itemId, type, { tag }, index);
}

function mapItems(api: Api, items: BaseItemDto[] | null | undefined): MediaItem[] {
  const urls = imageUrls(api);
  return (items ?? []).map((item) => toMediaItem(item, urls));
}

const cardQuery: {
  fields: ItemFields[];
  enableImageTypes: ImageType[];
  imageTypeLimit: number;
  enableUserData: boolean;
} = {
  fields: CARD_FIELDS,
  enableImageTypes: [...IMAGE_TYPES],
  imageTypeLimit: 1,
  enableUserData: true,
};

/** Item types shown when browsing a library of a given kind. */
export function libraryItemTypes(kind: LibraryKind): BaseItemKind[] {
  switch (kind) {
    case 'movies':
      return ['Movie'];
    case 'shows':
      return ['Series'];
    case 'collections':
      return ['BoxSet'];
    case 'videos':
      return ['Video'];
    case 'mixed':
      return ['Movie', 'Series', 'Video', 'BoxSet'];
  }
}

export async function fetchFeatured(
  api: Api,
  count: number,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getItems(
    {
      ...cardQuery,
      fields: [...CARD_FIELDS, 'Taglines'],
      includeItemTypes: ['Movie', 'Series'],
      recursive: true,
      sortBy: ['Random'],
      imageTypes: ['Backdrop'],
      hasOverview: true,
      limit: count,
    },
    { signal },
  );
  return mapItems(api, data.Items);
}

export async function fetchResume(api: Api, signal?: AbortSignal): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getResumeItems(
    { ...cardQuery, mediaTypes: ['Video'], limit: 20 },
    { signal },
  );
  return mapItems(api, data.Items);
}

/**
 * The next episode to watch per series. On the home page episodes already in progress are left
 * out (they appear under "continue watching"); for one series the in-progress episode is "next".
 */
export async function fetchNextUp(
  api: Api,
  options: { seriesId?: string; limit?: number; includeResumable?: boolean } = {},
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const { data } = await getShowApi(api).getNextUp(
    {
      ...cardQuery,
      seriesId: options.seriesId,
      limit: options.limit ?? 20,
      enableResumable: options.includeResumable ?? false,
    },
    { signal },
  );
  return mapItems(api, data.Items);
}

export async function fetchLatest(
  api: Api,
  libraryId: string,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getLatestMedia(
    { ...cardQuery, parentId: libraryId, limit: 20, groupItems: true },
    { signal },
  );
  return mapItems(api, data);
}

export async function fetchFavoritesPreview(api: Api, signal?: AbortSignal): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getItems(
    {
      ...cardQuery,
      isFavorite: true,
      recursive: true,
      includeItemTypes: ['Movie', 'Series', 'BoxSet', 'Video'],
      sortBy: ['DateCreated'],
      sortOrder: ['Descending'],
      limit: 20,
    },
    { signal },
  );
  return mapItems(api, data.Items);
}

export async function fetchCollections(api: Api, signal?: AbortSignal): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getItems(
    {
      ...cardQuery,
      includeItemTypes: ['BoxSet'],
      recursive: true,
      sortBy: ['SortName'],
      limit: 20,
    },
    { signal },
  );
  return mapItems(api, data.Items);
}

export async function fetchGenres(api: Api, signal?: AbortSignal): Promise<Genre[]> {
  const { data } = await getGenreApi(api).getGenres(
    {
      includeItemTypes: ['Movie', 'Series'],
      sortBy: ['SortName'],
      enableImageTypes: ['Primary', 'Thumb'],
      imageTypeLimit: 1,
      limit: 40,
    },
    { signal },
  );
  const urls = imageUrls(api);
  return (data.Items ?? []).map((genre) => toGenre(genre, urls));
}

export type SortField = 'name' | 'dateAdded' | 'year' | 'rating';

const SORT_FIELDS: Record<SortField, ItemSortBy[]> = {
  name: ['SortName'],
  dateAdded: ['DateCreated', 'SortName'],
  year: ['ProductionYear', 'PremiereDate', 'SortName'],
  rating: ['CommunityRating', 'SortName'],
};

/** A browsable list: one library, a collection, a genre or a person's work. */
export interface ItemListQuery {
  parentId?: string;
  includeItemTypes?: BaseItemKind[];
  recursive: boolean;
  genreIds?: string[];
  personIds?: string[];
  genres?: string[];
  years?: number[];
  isPlayed?: boolean;
  isFavorite?: boolean;
  sort: SortField;
  descending: boolean;
}

function listParameters(query: ItemListQuery) {
  return {
    parentId: query.parentId,
    includeItemTypes: query.includeItemTypes,
    recursive: query.recursive,
    genreIds: query.genreIds,
    personIds: query.personIds,
    genres: query.genres && query.genres.length > 0 ? query.genres : undefined,
    years: query.years && query.years.length > 0 ? query.years : undefined,
    isPlayed: query.isPlayed,
    isFavorite: query.isFavorite,
    sortBy: SORT_FIELDS[query.sort],
    sortOrder: [query.descending ? 'Descending' : 'Ascending'] as ('Ascending' | 'Descending')[],
  };
}

export interface ItemPage {
  items: MediaItem[];
  total: number;
}

export async function fetchItemPage(
  api: Api,
  query: ItemListQuery,
  startIndex: number,
  limit: number,
  signal?: AbortSignal,
): Promise<ItemPage> {
  const { data } = await getLibraryApi(api).getItems(
    { ...cardQuery, ...listParameters(query), startIndex, limit, enableTotalRecordCount: true },
    { signal },
  );
  return { items: mapItems(api, data.Items), total: data.TotalRecordCount ?? 0 };
}

/**
 * Position of the first item whose sort name starts at `letter` (for the jump bar): the number
 * of items sorting before it. Jellyfin stores sort names in lower case.
 */
export async function fetchIndexOfLetter(
  api: Api,
  query: ItemListQuery,
  letter: string,
  signal?: AbortSignal,
): Promise<number> {
  const { data } = await getLibraryApi(api).getItems(
    {
      ...listParameters({ ...query, sort: 'name', descending: false }),
      nameLessThan: letter.toLowerCase(),
      limit: 0,
      enableTotalRecordCount: true,
      enableImages: false,
      enableUserData: false,
    },
    { signal },
  );
  return data.TotalRecordCount ?? 0;
}

export interface FilterOptions {
  genres: string[];
  years: number[];
}

export async function fetchFilterOptions(
  api: Api,
  parentId: string | undefined,
  includeItemTypes: BaseItemKind[] | undefined,
  signal?: AbortSignal,
): Promise<FilterOptions> {
  // The legacy endpoint is the one that also lists production years.
  const { data } = await getFilterApi(api).getQueryFiltersLegacy(
    { parentId, includeItemTypes },
    { signal },
  );
  return {
    genres: [...(data.Genres ?? [])].sort((a, b) => a.localeCompare(b)),
    years: [...(data.Years ?? [])].sort((a, b) => b - a),
  };
}

export async function fetchItem(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<ItemDetail> {
  const { data } = await getLibraryApi(api).getItem({ itemId }, { signal });
  return toItemDetail(data, imageUrls(api));
}

export async function fetchSimilar(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const { data } = await getLibraryApi(api).getSimilarItems(
    { itemId, limit: 16, fields: CARD_FIELDS },
    { signal },
  );
  return mapItems(api, data.Items);
}

export async function fetchSeasons(
  api: Api,
  seriesId: string,
  signal?: AbortSignal,
): Promise<Season[]> {
  const { data } = await getShowApi(api).getSeasons(
    { seriesId, enableUserData: true, enableImageTypes: ['Primary'], fields: ['ChildCount'] },
    { signal },
  );
  const urls = imageUrls(api);
  return (data.Items ?? []).map((season) => toSeason(season, urls));
}

export async function fetchEpisodes(
  api: Api,
  seriesId: string,
  seasonId: string,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const { data } = await getShowApi(api).getEpisodes(
    { ...cardQuery, seriesId, seasonId },
    { signal },
  );
  return mapItems(api, data.Items);
}

const SEARCH_TYPES: Record<Exclude<SearchGroupKind, 'people'>, BaseItemKind> = {
  movies: 'Movie',
  shows: 'Series',
  episodes: 'Episode',
  collections: 'BoxSet',
};

export async function searchItems(
  api: Api,
  term: string,
  kind: SearchGroupKind,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  if (kind === 'people') {
    const { data } = await getPersonApi(api).getPersons(
      { searchTerm: term, limit: 20, enableImageTypes: ['Primary'] },
      { signal },
    );
    return mapItems(api, data.Items);
  }
  const { data } = await getLibraryApi(api).getItems(
    {
      ...cardQuery,
      searchTerm: term,
      includeItemTypes: [SEARCH_TYPES[kind]],
      recursive: true,
      limit: 24,
    },
    { signal },
  );
  return mapItems(api, data.Items);
}

const FAVORITE_GROUPS: [FavoriteGroupKind, BaseItemKind][] = [
  ['movies', 'Movie'],
  ['shows', 'Series'],
  ['episodes', 'Episode'],
  ['collections', 'BoxSet'],
  ['videos', 'Video'],
];

export async function fetchFavorites(api: Api, signal?: AbortSignal): Promise<FavoriteGroup[]> {
  const { data } = await getLibraryApi(api).getItems(
    {
      ...cardQuery,
      isFavorite: true,
      recursive: true,
      includeItemTypes: FAVORITE_GROUPS.map(([, type]) => type),
      sortBy: ['SortName'],
    },
    { signal },
  );
  const items = data.Items ?? [];
  const urls = imageUrls(api);
  return FAVORITE_GROUPS.map(([kind, type]) => ({
    kind,
    items: items.filter((item) => item.Type === type).map((item) => toMediaItem(item, urls)),
  })).filter((group) => group.items.length > 0);
}

export interface UserDataUpdate {
  favorite?: boolean;
  played?: boolean;
}

/** Applies a favorite/played change on the server and returns the new user data. */
export async function updateUserData(
  api: Api,
  itemId: string,
  change: UserDataUpdate,
): Promise<Partial<UserItemData>> {
  const userData = getUserDataApi(api);
  if (change.favorite !== undefined) {
    const { data } = change.favorite
      ? await userData.markFavoriteItem({ itemId })
      : await userData.unmarkFavoriteItem({ itemId });
    return { favorite: data.IsFavorite ?? change.favorite };
  }
  if (change.played !== undefined) {
    const { data } = change.played
      ? await userData.markPlayedItem({ itemId })
      : await userData.markUnplayedItem({ itemId });
    return {
      played: data.Played ?? change.played,
      progress: null,
      positionTicks: data.PlaybackPositionTicks ?? 0,
      unplayedCount: data.UnplayedItemCount ?? null,
    };
  }
  return {};
}

/**
 * The episode "Play" starts for a series: the next one to watch (including one in progress),
 * otherwise the first episode.
 */
export async function fetchSeriesStartEpisode(
  api: Api,
  seriesId: string,
  signal?: AbortSignal,
): Promise<MediaItem | null> {
  const [next] = await fetchNextUp(api, { seriesId, limit: 1, includeResumable: true }, signal);
  if (next) return next;
  const { data } = await getShowApi(api).getEpisodes(
    { ...cardQuery, seriesId, limit: 1 },
    { signal },
  );
  return mapItems(api, data.Items)[0] ?? null;
}

/** The first local trailer of an item, or null. */
export async function fetchLocalTrailerId(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { data } = await getLibraryApi(api).getLocalTrailers({ itemId }, { signal });
  return data[0]?.Id ?? null;
}
