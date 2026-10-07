import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  fetchFilterOptions,
  fetchIndexOfLetter,
  fetchItem,
  fetchItemPage,
  libraryItemTypes,
  type FilterOptions,
  type ItemListQuery,
  type SortField,
} from '@/api/items';
import { fetchLibraries } from '@/api/user';
import type { ImageRef, LibraryKind, MediaItem, QueryResult } from '@/domain/types';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

export type { FilterOptions, SortField };

export type LibrarySourceKind = 'library' | 'collection' | 'genre' | 'person';

export interface LibraryFilters {
  genres: string[];
  years: number[];
  played: 'all' | 'played' | 'unplayed';
  favoritesOnly: boolean;
}

export interface LibraryHeading {
  title: string;
  kind: LibrarySourceKind;
  /** Only for libraries. */
  libraryKind: LibraryKind | null;
  image: ImageRef | null;
  overview: string | null;
}

/** Everything a LibraryPage needs: a lazily paged, sortable, filterable item list. */
export interface LibraryBrowser {
  heading: QueryResult<LibraryHeading>;
  /** Number of items matching the current sort and filters. */
  total: QueryResult<number>;
  /** The item at a position, or undefined while its page loads. */
  itemAt: (index: number) => MediaItem | undefined;
  /** Called by the grid with the visible range; loads the pages it needs. */
  requestRange: (start: number, end: number) => void;
  sort: SortField;
  descending: boolean;
  setSort: (sort: SortField, descending?: boolean) => void;
  filters: LibraryFilters;
  setFilters: (filters: LibraryFilters) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  filterOptions: QueryResult<FilterOptions>;
  /** Letters for the jump bar; null when the list is not sorted by name. */
  jumpLetters: readonly string[] | null;
  /** Resolves to the index of the first item at or after `letter`. */
  jumpTo: (letter: string) => Promise<number>;
  /** Changes whenever sort or filters change, so the grid can reset its scroll position. */
  resultKey: string;
}

export const PAGE_SIZE = 100;
export const JUMP_LETTERS: readonly string[] = [
  '#',
  ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
];
const SORT_FIELDS: readonly SortField[] = ['name', 'dateAdded', 'year', 'rating'];
/** Newest first is the natural reading for dates and ratings. */
const DEFAULT_DESCENDING: Record<SortField, boolean> = {
  name: false,
  dateAdded: true,
  year: true,
  rating: true,
};
const EMPTY_FILTERS: LibraryFilters = {
  genres: [],
  years: [],
  played: 'all',
  favoritesOnly: false,
};

function readState(params: URLSearchParams) {
  const sortParam = params.get('sort');
  const sort = SORT_FIELDS.find((field) => field === sortParam) ?? 'name';
  const order = params.get('order');
  const descending = order === null ? DEFAULT_DESCENDING[sort] : order === 'desc';
  const played = params.get('played');
  const filters: LibraryFilters = {
    genres: params.getAll('genre'),
    years: params
      .getAll('year')
      .map(Number)
      .filter((year) => Number.isInteger(year)),
    played: played === 'played' || played === 'unplayed' ? played : 'all',
    favoritesOnly: params.get('favorites') === '1',
  };
  return { sort, descending, filters };
}

function writeState(
  params: URLSearchParams,
  sort: SortField,
  descending: boolean,
  filters: LibraryFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of ['sort', 'order', 'genre', 'year', 'played', 'favorites']) next.delete(name);
  if (sort !== 'name') next.set('sort', sort);
  if (descending !== DEFAULT_DESCENDING[sort]) next.set('order', descending ? 'desc' : 'asc');
  for (const genre of filters.genres) next.append('genre', genre);
  for (const year of filters.years) next.append('year', String(year));
  if (filters.played !== 'all') next.set('played', filters.played);
  if (filters.favoritesOnly) next.set('favorites', '1');
  return next;
}

export function useLibraryBrowser(sourceKind: LibrarySourceKind, sourceId: string): LibraryBrowser {
  const { api, key } = useActiveSession();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { sort, descending, filters } = readState(params);

  const libraries = useQuery({
    queryKey: queryKeys.libraries(key),
    queryFn: ({ signal }) => fetchLibraries(api, signal),
    staleTime: 5 * 60_000,
    enabled: sourceKind === 'library',
  });
  const item = useQuery({
    queryKey: queryKeys.item(key, sourceId),
    queryFn: ({ signal }) => fetchItem(api, sourceId, signal),
    staleTime: 60_000,
    enabled: sourceKind !== 'library',
  });

  const library = libraries.data?.find((candidate) => candidate.id === sourceId);
  let heading: QueryResult<LibraryHeading>;
  if (sourceKind === 'library') {
    const result = toQueryResult(libraries);
    heading =
      result.status !== 'success'
        ? result
        : library
          ? {
              status: 'success',
              isRefreshing: result.isRefreshing,
              data: {
                title: library.name,
                kind: 'library',
                libraryKind: library.kind,
                image: library.image,
                overview: null,
              },
            }
          : {
              status: 'error',
              error: { kind: 'notFound' },
              retry: () => {
                void libraries.refetch();
              },
            };
  } else {
    const result = toQueryResult(item);
    heading =
      result.status !== 'success'
        ? result
        : {
            status: 'success',
            isRefreshing: result.isRefreshing,
            data: {
              title: result.data.name,
              kind: sourceKind,
              libraryKind: null,
              image: result.data.images.primary,
              overview: result.data.overview,
            },
          };
  }

  /** The list query; undefined until a library source is resolved. */
  const listQuery: ItemListQuery | undefined = (() => {
    const base = {
      sort,
      descending,
      genres: filters.genres,
      years: filters.years,
      isPlayed: filters.played === 'all' ? undefined : filters.played === 'played',
      isFavorite: filters.favoritesOnly ? true : undefined,
    };
    switch (sourceKind) {
      case 'library':
        return library
          ? {
              ...base,
              parentId: library.id,
              includeItemTypes: libraryItemTypes(library.kind),
              recursive: true,
            }
          : undefined;
      case 'collection':
        return { ...base, parentId: sourceId, recursive: false };
      case 'genre':
        return {
          ...base,
          genreIds: [sourceId],
          includeItemTypes: ['Movie', 'Series'],
          recursive: true,
        };
      case 'person':
        return {
          ...base,
          personIds: [sourceId],
          includeItemTypes: ['Movie', 'Series'],
          recursive: true,
        };
    }
  })();

  const queryHash = listQuery ? JSON.stringify(listQuery) : '';
  const [requested, setRequested] = useState({ hash: queryHash, pages: [0] });
  // A new query starts again at the first page (derived state, adjusted during render).
  if (requested.hash !== queryHash) setRequested({ hash: queryHash, pages: [0] });

  const pages = useQueries({
    queries: requested.pages.map((page) => ({
      queryKey: queryKeys.itemPage(key, queryHash, page),
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (!listQuery) throw new Error('The list source is not resolved yet');
        return fetchItemPage(api, listQuery, page * PAGE_SIZE, PAGE_SIZE, signal);
      },
      enabled: listQuery !== undefined,
      staleTime: 5 * 60_000,
    })),
  });
  const pageByIndex = new Map(requested.pages.map((page, index) => [page, pages[index]]));

  const firstPage = pageByIndex.get(0);
  let total: QueryResult<number>;
  if (heading.status === 'error') total = heading;
  else if (!firstPage || listQuery === undefined) total = { status: 'pending' };
  else {
    const result = toQueryResult(firstPage);
    total = result.status === 'success' ? { ...result, data: result.data.total } : result;
  }

  const filterKey = JSON.stringify([
    listQuery?.parentId,
    listQuery?.includeItemTypes,
    sourceKind,
    sourceId,
  ]);
  const filterOptions = useQuery({
    queryKey: queryKeys.filterOptions(key, filterKey),
    queryFn: ({ signal }) =>
      fetchFilterOptions(
        api,
        sourceKind === 'library' || sourceKind === 'collection' ? sourceId : undefined,
        listQuery?.includeItemTypes,
        signal,
      ),
    enabled: listQuery !== undefined,
    staleTime: 30 * 60_000,
  });

  /** Adds the pages covering [start, end]; returns the same state when nothing is missing. */
  const requestRange = (start: number, end: number) => {
    const first = Math.floor(Math.max(0, start) / PAGE_SIZE);
    const last = Math.floor(Math.max(0, end) / PAGE_SIZE);
    setRequested((current) => {
      const missing: number[] = [];
      for (let page = first; page <= last; page += 1) {
        if (!current.pages.includes(page)) missing.push(page);
      }
      return missing.length === 0 ? current : { ...current, pages: [...current.pages, ...missing] };
    });
  };

  const update = (nextSort: SortField, nextDescending: boolean, nextFilters: LibraryFilters) => {
    setParams(writeState(params, nextSort, nextDescending, nextFilters), { replace: true });
  };

  const activeFilterCount =
    filters.genres.length +
    filters.years.length +
    (filters.played === 'all' ? 0 : 1) +
    (filters.favoritesOnly ? 1 : 0);

  return {
    heading,
    total,
    itemAt: (index) =>
      pageByIndex.get(Math.floor(index / PAGE_SIZE))?.data?.items[index % PAGE_SIZE],
    requestRange,
    sort,
    descending,
    setSort: (nextSort, nextDescending) => {
      update(nextSort, nextDescending ?? DEFAULT_DESCENDING[nextSort], filters);
    },
    filters,
    setFilters: (nextFilters) => {
      update(sort, descending, nextFilters);
    },
    clearFilters: () => {
      update(sort, descending, EMPTY_FILTERS);
    },
    activeFilterCount,
    filterOptions: toQueryResult(filterOptions),
    jumpLetters: sort === 'name' && !descending ? JUMP_LETTERS : null,
    jumpTo: async (letter) => {
      if (letter === '#' || !listQuery) return 0;
      return client.query({
        queryKey: queryKeys.letterIndex(key, queryHash, letter),
        queryFn: ({ signal }) => fetchIndexOfLetter(api, listQuery, letter, signal),
        staleTime: 5 * 60_000,
      });
    },
    resultKey: queryHash,
  };
}
