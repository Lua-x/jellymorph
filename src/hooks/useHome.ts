import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchCollections,
  fetchFavoritesPreview,
  fetchFeatured,
  fetchGenres,
  fetchLatest,
  fetchNextUp,
  fetchResume,
  fetchTopRated,
  fetchUpcoming,
} from '@/api/items';
import { fetchCurrentUser, fetchLibraries } from '@/api/user';
import { dayKey } from '@/domain/daily';
import { visibleIds, type HomeAreaKind } from '@/domain/layout';
import type { HomeSection, Library, MediaItem, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useEffectiveLayout } from './useLayout';
import { useActiveSession } from './useSession';

/** Featured items for the hero: the titles of the day, kept for the whole visit. */
export function useFeatured(count: number, enabled = true): QueryResult<MediaItem[]> {
  const { api, key } = useActiveSession();
  // Read once per page, so the hero does not change at midnight while it is shown.
  const [day] = useState(dayKey);
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.featured(key, count, day),
      queryFn: ({ signal }) => fetchFeatured(api, count, day, signal),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      enabled,
    }),
  );
}

/** Ids of the home areas in a theme's order; `latest` becomes one row per library. */
export function homeAreaIds(
  defaults: readonly HomeAreaKind[],
  latestLibraries: readonly Library[],
): string[] {
  return defaults.flatMap((kind) =>
    kind === 'latest' ? latestLibraries.map((library) => `latest-${library.id}`) : [kind],
  );
}

/** Libraries that get a "New in …" row: not collections, not excluded by the user in Jellyfin. */
export function latestLibrariesOf(
  libraries: readonly Library[],
  latestExcludes: readonly string[],
): Library[] {
  const excludes = new Set(latestExcludes);
  return libraries.filter((library) => library.kind !== 'collections' && !excludes.has(library.id));
}

function isEmpty(result: QueryResult<unknown[]>): boolean {
  return result.status === 'success' && result.data.length === 0;
}

/**
 * All home areas in display order: the theme's order, or the arrangement of the user or the
 * administrator. Every row loads on its own; rows that turn out empty are dropped, rows still
 * loading stay so themes can show placeholders.
 */
export function useHomeSections(defaults: readonly HomeAreaKind[]): HomeSection[] {
  const layout = useEffectiveLayout();
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
  // Only themes that offer these areas ask the server for them.
  const topRated = useQuery({
    queryKey: queryKeys.topRated(key),
    queryFn: ({ signal }) => fetchTopRated(api, signal),
    staleTime: 30 * 60_000,
    enabled: defaults.includes('topRated'),
  });
  const upcoming = useQuery({
    queryKey: queryKeys.upcoming(key),
    queryFn: ({ signal }) => fetchUpcoming(api, signal),
    staleTime: 30 * 60_000,
    enabled: defaults.includes('upcoming'),
  });

  const latestLibraries = latestLibrariesOf(libraries.data ?? [], user.data?.latestExcludes ?? []);
  const latest = useQueries({
    queries: latestLibraries.map((library) => ({
      queryKey: queryKeys.latest(key, library.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchLatest(api, library.id, signal),
      staleTime: 60_000,
    })),
  });
  const collectionsLibrary = libraries.data?.find((library) => library.kind === 'collections');

  const sections: HomeSection[] = [
    { id: 'hero', kind: 'hero' },
    { id: 'libraries', kind: 'libraries' },
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
    {
      id: 'topRated',
      kind: 'topRated',
      library: null,
      items: toQueryResult(topRated),
      seeAll: null,
    },
    {
      id: 'upcoming',
      kind: 'upcoming',
      library: null,
      items: toQueryResult(upcoming),
      seeAll: null,
    },
  ];
  const byId = new Map(sections.map((section) => [section.id, section]));
  return visibleIds(homeAreaIds(defaults, latestLibraries), layout.home)
    .map((id) => byId.get(id))
    .filter((section): section is HomeSection => {
      if (!section) return false;
      if (section.kind === 'hero' || section.kind === 'libraries') return true;
      return section.kind === 'genres' ? !isEmpty(section.genres) : !isEmpty(section.items);
    });
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
