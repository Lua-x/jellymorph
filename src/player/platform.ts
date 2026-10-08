/**
 * Operating system integration (docs/architecture.md §9.12): Media Session for hardware keys,
 * headsets and lock screens, and a screen wake lock while a video plays.
 */
import type { MediaItem } from '@/domain/types';

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  stop: () => void;
  next: (() => void) | null;
}

function artwork(item: MediaItem): MediaImage[] {
  const image = item.images.primary ?? item.images.thumb ?? item.images.backdrop;
  if (!image) return [];
  const separator = image.url.includes('?') ? '&' : '?';
  return [256, 512].map((size) => ({
    src: `${image.url}${separator}maxWidth=${String(size)}&quality=90`,
    sizes: `${String(size)}x${String(Math.round(size / (image.aspectRatio ?? 1)))}`,
  }));
}

export function setMediaSession(item: MediaItem, handlers: MediaSessionHandlers): void {
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  try {
    session.metadata = new MediaMetadata({
      title: item.name,
      artist: item.episode?.seriesName ?? (item.year ? String(item.year) : ''),
      artwork: artwork(item),
    });
  } catch {
    // MediaMetadata can be missing in embedded browsers.
  }
  const actions: [MediaSessionAction, MediaSessionActionHandler | null][] = [
    ['play', handlers.play],
    ['pause', handlers.pause],
    [
      'seekbackward',
      (details) => {
        handlers.seekBy(-(details.seekOffset ?? 10));
      },
    ],
    [
      'seekforward',
      (details) => {
        handlers.seekBy(details.seekOffset ?? 10);
      },
    ],
    [
      'seekto',
      (details) => {
        if (details.seekTime !== undefined) handlers.seekTo(details.seekTime);
      },
    ],
    ['stop', handlers.stop],
    ['nexttrack', handlers.next],
  ];
  for (const [action, handler] of actions) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Not every browser knows every action.
    }
  }
}

export function updateMediaSessionPosition(duration: number, position: number, rate: number): void {
  if (!('mediaSession' in navigator) || !Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(Math.max(0, position), duration),
      playbackRate: rate,
    });
  } catch {
    // Invalid states are ignored by design.
  }
}

export function clearMediaSession(): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  for (const action of [
    'play',
    'pause',
    'seekbackward',
    'seekforward',
    'seekto',
    'stop',
    'nexttrack',
  ] as const) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // See above.
    }
  }
}

/** Keeps the screen on while playing; re-acquired when the tab becomes visible again. */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  constructor(signal: AbortSignal) {
    document.addEventListener(
      'visibilitychange',
      () => {
        if (this.wanted && document.visibilityState === 'visible') void this.acquire();
      },
      { signal },
    );
  }

  set(wanted: boolean): void {
    this.wanted = wanted;
    if (wanted) void this.acquire();
    else this.release();
  }

  private async acquire(): Promise<void> {
    if (this.sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible')
      return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      if (!this.wanted) this.release();
    } catch {
      // Denied (battery saver, permissions policy): the screen may dim, playback continues.
    }
  }

  release(): void {
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }
}
