import type { EngineFailure, EngineOptions, PlaybackEngine } from './types';

function failureOf(error: MediaError | null): EngineFailure {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_NETWORK:
      return 'network';
    case MediaError.MEDIA_ERR_DECODE:
      return 'decode';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'format';
    default:
      return 'unknown';
  }
}

/** <video src>: direct play, direct stream and HLS in Safari. */
export function createNativeEngine({ video, onFailure }: EngineOptions): PlaybackEngine {
  const lifetime = new AbortController();

  return {
    kind: 'native',
    load: (url, startSeconds) =>
      new Promise<void>((resolve, reject) => {
        let loaded = false;
        const { signal } = lifetime;
        video.addEventListener(
          'loadedmetadata',
          () => {
            if (startSeconds > 0) video.currentTime = startSeconds;
            loaded = true;
            resolve();
          },
          { once: true, signal },
        );
        video.addEventListener(
          'error',
          () => {
            const failure = failureOf(video.error);
            const detail = video.error?.message ?? 'media error';
            // Errors while loading reject load(); later ones are reported.
            if (loaded) onFailure(failure, detail);
            else reject(Object.assign(new Error(detail), { failure }));
          },
          { signal },
        );
        signal.addEventListener('abort', () => {
          reject(new DOMException('Engine destroyed', 'AbortError'));
        });
        video.src = url;
        video.load();
      }),
    destroy: () => {
      lifetime.abort();
      video.removeAttribute('src');
      video.load();
    },
  };
}
