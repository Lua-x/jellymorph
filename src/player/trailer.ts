/**
 * Muted trailer preview in the hero (docs/architecture.md §9.13): the same engines as the player,
 * a low bitrate and no playback reports.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import { fetchLocalTrailerId } from '@/api/items';
import { getCapabilities, hlsEngine } from './capabilities';
import { buildDeviceProfile } from './device-profile';
import { createEngine } from './engines';
import { requestPlayback, stopActiveEncodings } from './playback-info';

const PREVIEW_BITRATE = 3_000_000;

export interface TrailerPreviewOptions {
  api: Api;
  userId: string;
  deviceId: string;
  itemId: string;
  video: HTMLVideoElement;
  signal: AbortSignal;
}

/** Starts the trailer of an item; resolves to a stop function, or null without a trailer. */
export async function startTrailerPreview({
  api,
  userId,
  deviceId,
  itemId,
  video,
  signal,
}: TrailerPreviewOptions): Promise<(() => void) | null> {
  // Checked after every await (a direct property check would be narrowed away by TypeScript).
  const aborted = () => signal.aborted;
  const trailerId = await fetchLocalTrailerId(api, itemId, signal);
  if (!trailerId || aborted()) return null;
  const capabilities = await getCapabilities();
  const plan = await requestPlayback(
    api,
    {
      itemId: trailerId,
      userId,
      deviceId,
      profile: buildDeviceProfile(capabilities, { maxBitrate: PREVIEW_BITRATE }),
      maxBitrate: PREVIEW_BITRATE,
      startSeconds: 0,
      subtitleIndex: null,
      fallback: 0,
      burnInSubtitle: false,
    },
    signal,
  );
  const kind = plan.protocol === 'hls' ? hlsEngine(capabilities) : 'native';
  if (!kind || aborted()) return null;

  let stopped = false;
  const engine = await createEngine(kind, {
    video,
    onFailure: () => {
      stop();
    },
  });
  function stop() {
    if (stopped) return;
    stopped = true;
    engine.destroy();
    if (plan.method === 'transcode')
      void stopActiveEncodings(api, deviceId, plan.playSessionId).catch(() => undefined);
  }
  if (aborted()) {
    stop();
    return null;
  }
  video.muted = true;
  await engine.load(plan.url, 0);
  // Autoplay rules may refuse even muted playback; then the backdrop simply stays.
  await video.play().catch(() => {
    stop();
  });
  return stop;
}
