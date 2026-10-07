import { useQuery } from '@tanstack/react-query';
import { AppFailure } from '@/api/errors';
import { checkFixedServer } from '@/api/servers';
import { useSessionStore } from '@/api/session-store';
import type { AppError, QueryResult, ServerProblem, ServerSummary } from '@/domain/types';
import { queryKeys } from '../query-keys';
import { toQueryResult } from '../query-result';

function problemToError(problem: ServerProblem): AppError {
  switch (problem.reason) {
    case 'unsupportedVersion':
      return { kind: 'unsupported', detail: problem.version };
    case 'unreachable':
    case 'invalidAddress':
      return { kind: 'network', detail: problem.reason };
    case 'notJellyfin':
    case 'setupIncomplete':
      return { kind: 'server', detail: problem.reason };
  }
}

/**
 * Registers the server pinned by the deployment (demo, proxy or LOCK_SERVER) and makes it
 * the current one. Checked once per page load.
 */
export function useFixedServer(url: string): QueryResult<ServerSummary> {
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.fixedServer(url),
      queryFn: async () => {
        const result = await checkFixedServer(url);
        if (!result.ok) throw new AppFailure(problemToError(result));
        const { upsertServer, selectServer } = useSessionStore.getState();
        selectServer(upsertServer(result.server, true).id);
        return result.server;
      },
      staleTime: Infinity,
      retry: false,
    }),
  );
}
