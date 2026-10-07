import { setupWorker } from 'msw/browser';
import { createHandlers } from './handlers';
import { MockState } from './state';

/** Demo mode: the mock server answers every Jellyfin request inside the browser. */
export async function startDemoServer(): Promise<void> {
  const state = new MockState({
    quickConnectAutoApproveMs: 4_000,
    latencyMs: 180,
    storage: window.localStorage,
  });
  const worker = setupWorker(...createHandlers(state));
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: 'bypass',
    quiet: true,
  });
}
