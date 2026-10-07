import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser, fetchLibraries } from '@/api/user';
import type { CurrentUser, Library, QueryResult } from '@/domain/types';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

export function useCurrentUser(): QueryResult<CurrentUser> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.currentUser(key),
      queryFn: ({ signal }) => fetchCurrentUser(api, signal),
      staleTime: 5 * 60_000,
    }),
  );
}

export function useLibraries(): QueryResult<Library[]> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.libraries(key),
      queryFn: ({ signal }) => fetchLibraries(api, signal),
      staleTime: 5 * 60_000,
    }),
  );
}
