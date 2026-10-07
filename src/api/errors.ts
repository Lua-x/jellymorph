import { isAxiosError } from 'axios';
import type { AppError } from '@/domain/types';

/** Maps any thrown value to an AppError the UI can explain. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (isAxiosError(error)) {
    const detail =
      `${error.config?.method?.toUpperCase() ?? ''} ${error.config?.url ?? ''}: ${error.message}`.trim();
    if (error.code === 'ERR_CANCELED') return { kind: 'aborted', detail };
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return { kind: 'timeout', detail };
    const status = error.response?.status;
    if (status === undefined) return { kind: 'network', detail };
    if (status === 401) return { kind: 'auth', status, detail };
    if (status === 403) return { kind: 'forbidden', status, detail };
    if (status === 404) return { kind: 'notFound', status, detail };
    if (status >= 500) return { kind: 'server', status, detail };
    return { kind: 'unknown', status, detail };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'aborted', detail: error.message };
  }
  return { kind: 'unknown', detail: error instanceof Error ? error.message : String(error) };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    !(value instanceof Error)
  );
}

/** Thrown by the API layer for failures that are not HTTP errors (e.g. unsupported server). */
export class AppFailure extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.detail ?? appError.kind);
    this.name = 'AppFailure';
    this.appError = appError;
  }
}

/** Unwraps AppFailure so callers can use one mapping for everything. */
export function describeError(error: unknown): AppError {
  return error instanceof AppFailure ? error.appError : toAppError(error);
}
