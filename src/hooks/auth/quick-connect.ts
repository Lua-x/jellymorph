import {
  completeQuickConnect,
  isQuickConnectAuthorized,
  startQuickConnect,
  type QuickConnectRequest,
} from '@/api/auth';
import type { StoredSession } from '@/api/session-store';
import type { ServerSummary } from '@/domain/types';
import { delay } from '@/lib/async';

export const QUICK_CONNECT_POLL_MS = 3_000;
export const QUICK_CONNECT_TIMEOUT_MS = 5 * 60_000;

export type QuickConnectOutcome =
  { status: 'signedIn'; session: StoredSession } | { status: 'expired' };

export interface QuickConnectRun {
  signal: AbortSignal;
  onCode: (request: QuickConnectRequest, expiresAt: number) => void;
  onAuthorized: () => void;
  /** Read when the code is approved, so a late change of the checkbox still counts. */
  remembered: () => boolean;
  pollMs?: number;
  timeoutMs?: number;
}

/**
 * Requests a code, waits until a signed-in device approves it and exchanges it for a token.
 * Rejects with an AbortError when the signal fires.
 */
export async function runQuickConnect(
  server: ServerSummary,
  {
    signal,
    onCode,
    onAuthorized,
    remembered,
    pollMs = QUICK_CONNECT_POLL_MS,
    timeoutMs = QUICK_CONNECT_TIMEOUT_MS,
  }: QuickConnectRun,
): Promise<QuickConnectOutcome> {
  const request = await startQuickConnect(server);
  signal.throwIfAborted();
  const expiresAt = Date.now() + timeoutMs;
  onCode(request, expiresAt);

  for (;;) {
    await delay(pollMs, signal);
    if (Date.now() >= expiresAt) return { status: 'expired' };
    if (await isQuickConnectAuthorized(server, request.secret, signal)) break;
  }

  onAuthorized();
  const session = await completeQuickConnect(server, request.secret, remembered());
  signal.throwIfAborted();
  return { status: 'signedIn', session };
}
