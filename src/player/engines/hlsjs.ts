/**
 * HLS through Media Source Extensions with hls.js (light build: no DRM, alternate audio or
 * in-stream subtitles, which Jellyfin's streams do not use). Loaded only when a transcoded stream
 * plays outside Safari.
 */
import Hls from 'hls.js/light';
import type { EngineOptions, PlaybackEngine } from './types';

const RETRY = { maxNumRetry: 2, retryDelayMs: 1000, maxRetryDelayMs: 8000 };

export function createHlsEngine({ video, onFailure }: EngineOptions): PlaybackEngine {
  const lifetime = new AbortController();
  let hls: Hls | null = null;
  let recoveredAt = 0;

  return {
    kind: 'hlsjs',
    load: (url, startSeconds) =>
      new Promise<void>((resolve, reject) => {
        const { signal } = lifetime;
        const instance = new Hls({
          startPosition: startSeconds,
          enableWorker: true,
          backBufferLength: 60,
          maxBufferLength: 30,
          // Jellyfin starts the transcode on the first request, which can take a while.
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 20_000,
              maxLoadTimeMs: 30_000,
              timeoutRetry: { ...RETRY, retryDelayMs: 0 },
              errorRetry: RETRY,
            },
          },
        });
        hls = instance;
        let ready = false;

        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && Date.now() - recoveredAt > 10_000) {
            // Try to recover in place first (e.g. a decode glitch), as hls.js recommends.
            recoveredAt = Date.now();
            instance.recoverMediaError();
            return;
          }
          const failure = data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'network' : 'decode';
          if (ready) onFailure(failure, data.details);
          else reject(Object.assign(new Error(data.details), { failure }));
        });
        video.addEventListener(
          'loadedmetadata',
          () => {
            ready = true;
            resolve();
          },
          { once: true, signal },
        );
        signal.addEventListener('abort', () => {
          reject(new DOMException('Engine destroyed', 'AbortError'));
        });
        instance.attachMedia(video);
        instance.loadSource(url);
      }),
    destroy: () => {
      lifetime.abort();
      hls?.destroy();
      hls = null;
      video.removeAttribute('src');
      video.load();
    },
  };
}
