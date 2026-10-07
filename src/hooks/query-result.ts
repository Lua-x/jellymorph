import type { UseQueryResult } from '@tanstack/react-query';
import { describeError } from '@/api/errors';
import type { QueryResult } from '@/domain/types';

/** Converts a TanStack query into the library-independent QueryResult themes receive. */
export function toQueryResult<T>(query: UseQueryResult<T>): QueryResult<T> {
  if (query.isPending) return { status: 'pending' };
  if (query.isError) {
    return {
      status: 'error',
      error: describeError(query.error),
      retry: () => {
        void query.refetch();
      },
    };
  }
  return { status: 'success', data: query.data, isRefreshing: query.isFetching };
}
