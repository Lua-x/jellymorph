import { QueryClient } from '@tanstack/react-query';
import { describeError } from '@/api/errors';

const MAX_RETRIES = 2;

/** Network hiccups and server errors are retried; client errors (4xx) are final. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  const { kind } = describeError(error);
  return kind === 'network' || kind === 'timeout' || kind === 'server';
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30_000,
        gcTime: 10 * 60_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
