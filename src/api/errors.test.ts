import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppFailure, describeError, toAppError } from './errors';

function responseError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders(), url: '/Users/Me', method: 'get' };
  const response = { status, statusText: '', headers: {}, config, data: null } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
}

describe('toAppError', () => {
  it.each([
    [401, 'auth'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unknown'],
  ] as const)('maps HTTP %i to %s', (status, kind) => {
    expect(toAppError(responseError(status))).toMatchObject({ kind, status });
  });

  it('detects network failures, timeouts and cancellation', () => {
    expect(toAppError(new AxiosError('Network Error', 'ERR_NETWORK')).kind).toBe('network');
    expect(toAppError(new AxiosError('timeout', 'ECONNABORTED')).kind).toBe('timeout');
    expect(toAppError(new AxiosError('canceled', 'ERR_CANCELED')).kind).toBe('aborted');
    expect(toAppError(new DOMException('aborted', 'AbortError')).kind).toBe('aborted');
  });

  it('keeps technical details out of the UI-facing kind', () => {
    const error = toAppError(responseError(500));
    expect(error.detail).toContain('GET /Users/Me');
  });

  it('unwraps AppFailure', () => {
    expect(describeError(new AppFailure({ kind: 'unsupported', detail: '10.8.0' }))).toEqual({
      kind: 'unsupported',
      detail: '10.8.0',
    });
  });
});
