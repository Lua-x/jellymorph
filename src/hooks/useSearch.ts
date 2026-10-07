import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { describeError } from '@/api/errors';
import { searchItems } from '@/api/items';
import type { QueryResult, SearchGroup, SearchGroupKind } from '@/domain/types';
import { queryKeys } from './query-keys';
import { useActiveSession } from './useSession';
import { useDebouncedValue } from './useDebouncedValue';

const GROUPS: SearchGroupKind[] = ['movies', 'shows', 'episodes', 'collections', 'people'];
export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_SEARCH_LENGTH = 2;

/**
 * Live search across movies, shows, episodes, collections and people. Returns null until the
 * term is long enough. Previous results stay visible while a newer search loads; outdated
 * requests are cancelled by the query keys changing.
 */
export function useSearch(term: string): QueryResult<SearchGroup[]> | null {
  const { api, key } = useActiveSession();
  const debounced = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_SEARCH_LENGTH;
  const results = useQueries({
    queries: GROUPS.map((kind) => ({
      queryKey: queryKeys.search(key, debounced, kind),
      queryFn: ({ signal }: { signal: AbortSignal }) => searchItems(api, debounced, kind, signal),
      enabled,
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    })),
  });

  if (term.trim().length < MIN_SEARCH_LENGTH) return null;
  const failed = results.find((result) => result.isError);
  if (failed && results.every((result) => result.data === undefined)) {
    return {
      status: 'error',
      error: describeError(failed.error),
      retry: () => {
        for (const result of results) void result.refetch();
      },
    };
  }
  if (!enabled || results.every((result) => result.data === undefined))
    return { status: 'pending' };
  const groups = GROUPS.map((kind, index) => ({ kind, items: results[index]?.data ?? [] })).filter(
    (group) => group.items.length > 0,
  );
  return {
    status: 'success',
    data: groups,
    isRefreshing: debounced !== term.trim() || results.some((result) => result.isFetching),
  };
}
