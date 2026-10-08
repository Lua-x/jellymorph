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

// Media playback: jsdom keeps currentTime but cannot play. play()/pause() switch a paused flag
// and fire the events a browser would; engines are replaced by test doubles.
const pausedState = new WeakMap<HTMLMediaElement, boolean>();
Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
  configurable: true,
  get(this: HTMLMediaElement) {
    return pausedState.get(this) ?? true;
  },
});
HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
  if (pausedState.get(this) === false) return Promise.resolve();
  pausedState.set(this, false);
  this.dispatchEvent(new Event('play'));
  this.dispatchEvent(new Event('playing'));
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
  if (pausedState.get(this) === false) {
    pausedState.set(this, true);
    this.dispatchEvent(new Event('pause'));
  }
};
HTMLMediaElement.prototype.load = function load(this: HTMLMediaElement) {
  pausedState.set(this, true);
};
const textTracks = new WeakMap<HTMLTrackElement, { mode: TextTrackMode }>();
Object.defineProperty(HTMLTrackElement.prototype, 'track', {
  configurable: true,
  get(this: HTMLTrackElement) {
    let track = textTracks.get(this);
    if (!track) {
      track = { mode: 'disabled' };
      textTracks.set(this, track);
    }
    return track;
  },
});

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
