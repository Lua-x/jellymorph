import { useQueries, useQuery } from '@tanstack/react-query';
import {
  fetchCollections,
  fetchFavoritesPreview,
  fetchFeatured,
  fetchGenres,
  fetchLatest,
  fetchNextUp,
  fetchResume,
} from '@/api/items';
import { fetchCurrentUser, fetchLibraries } from '@/api/user';
import type { HomeSection, Library, MediaItem, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

/** Featured items for the hero. Random on the server, so kept stable for the whole visit. */
export function useFeatured(count: number): QueryResult<MediaItem[]> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.featured(key, count),
      queryFn: ({ signal }) => fetchFeatured(api, count, signal),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    }),
  );
}

function isEmpty(result: QueryResult<unknown[]>): boolean {
  return result.status === 'success' && result.data.length === 0;
}

/**
 * All home rows in display order. Every row loads on its own; rows that turn out empty are
 * dropped, rows still loading stay so themes can show placeholders.
 */
export function useHomeSections(): HomeSection[] {
  const { api, key } = useActiveSession();
  const user = useQuery({
    queryKey: queryKeys.currentUser(key),
    queryFn: ({ signal }) => fetchCurrentUser(api, signal),
    staleTime: 5 * 60_000,
  });
  const libraries = useQuery({
    queryKey: queryKeys.libraries(key),
    queryFn: ({ signal }) => fetchLibraries(api, signal),
    staleTime: 5 * 60_000,
  });
  const resume = useQuery({
    queryKey: queryKeys.resume(key),
    queryFn: ({ signal }) => fetchResume(api, signal),
  });
  const nextUp = useQuery({
    queryKey: queryKeys.nextUp(key, null),
    queryFn: ({ signal }) => fetchNextUp(api, {}, signal),
  });
  const favorites = useQuery({
    queryKey: queryKeys.favoritesPreview(key),
    queryFn: ({ signal }) => fetchFavoritesPreview(api, signal),
  });
  const collections = useQuery({
    queryKey: queryKeys.collections(key),
    queryFn: ({ signal }) => fetchCollections(api, signal),
    staleTime: 5 * 60_000,
  });
  const genres = useQuery({
    queryKey: queryKeys.genres(key),
    queryFn: ({ signal }) => fetchGenres(api, signal),
    staleTime: 30 * 60_000,
  });

  const excludes = new Set(user.data?.latestExcludes ?? []);
  const latestLibraries: Library[] = (libraries.data ?? []).filter(
    (library) => library.kind !== 'collections' && !excludes.has(library.id),
  );
  const latest = useQueries({
    queries: latestLibraries.map((library) => ({
      queryKey: queryKeys.latest(key, library.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchLatest(api, library.id, signal),
      staleTime: 60_000,
    })),
  });
  const collectionsLibrary = libraries.data?.find((library) => library.kind === 'collections');

  const sections: HomeSection[] = [
    { id: 'resume', kind: 'resume', library: null, items: toQueryResult(resume), seeAll: null },
    { id: 'nextUp', kind: 'nextUp', library: null, items: toQueryResult(nextUp), seeAll: null },
    ...latestLibraries.map((library, index): HomeSection => ({
      id: `latest-${library.id}`,
      kind: 'latest',
      library,
      items: latest[index] ? toQueryResult(latest[index]) : { status: 'pending' },
      seeAll: paths.library(library.id),
    })),
    {
      id: 'favorites',
      kind: 'favorites',
      library: null,
      items: toQueryResult(favorites),
      seeAll: paths.favorites,
    },
    {
      id: 'collections',
      kind: 'collections',
      library: collectionsLibrary ?? null,
      items: toQueryResult(collections),
      seeAll: collectionsLibrary ? paths.library(collectionsLibrary.id) : null,
    },
    { id: 'genres', kind: 'genres', genres: toQueryResult(genres) },
  ];
  return sections.filter((section) =>
    section.kind === 'genres' ? !isEmpty(section.genres) : !isEmpty(section.items),
  );
}

/** "Continue watching" on its own (e.g. for the theme live preview). */
export function useResumeItems(): QueryResult<MediaItem[]> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.resume(key),
      queryFn: ({ signal }) => fetchResume(api, signal),
    }),
  );
}
