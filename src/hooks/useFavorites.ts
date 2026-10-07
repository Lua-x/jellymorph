import { useQuery } from '@tanstack/react-query';
import { fetchFavorites } from '@/api/items';
import type { FavoriteGroup, QueryResult } from '@/domain/types';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

export function useFavorites(): QueryResult<FavoriteGroup[]> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.favorites(key),
      queryFn: ({ signal }) => fetchFavorites(api, signal),
    }),
  );
}
