import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockServer, server } from '@/mocks/node';

// jsdom has no matchMedia; tests run as a dark, motion-friendly desktop browser.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Live updates use a WebSocket; tests exercise data flows without a socket server.
class SilentWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 0;
  send(): void {
    // No server in tests.
  }
  close(): void {
    this.readyState = 3;
  }
}
Object.defineProperty(window, 'WebSocket', { configurable: true, value: SilentWebSocket });
Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: SilentWebSocket });

// Layout APIs jsdom does not implement.
class NoopResizeObserver {
  observe(): void {
    // Layout is not computed in jsdom.
  }
  unobserve(): void {
    // See observe().
  }
  disconnect(): void {
    // See observe().
  }
}
Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: NoopResizeObserver });
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: NoopResizeObserver,
});
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollBy = () => undefined;

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  resetMockServer();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
