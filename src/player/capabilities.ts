/**
 * What this browser can play, detected once per session (docs/architecture.md §9.3). The result
 * is plain data so the device profile can be built and tested without a browser.
 */

export type BrowserFamily = 'chromium' | 'firefox' | 'safari' | 'other';

export interface BrowserCapabilities {
  browser: BrowserFamily;
  /** Containers <video src> plays directly. */
  containers: { mp4: boolean; webm: boolean; mkv: boolean; mov: boolean };
  video: {
    h264: boolean;
    /** Highest H.264 level (Jellyfin notation, e.g. 51 = 5.1). */
    h264Level: number;
    h264High10: boolean;
    hevc: boolean;
    hevcMain10: boolean;
    av1: boolean;
    av1Main10: boolean;
    vp9: boolean;
    vp9Profile2: boolean;
    vp8: boolean;
  };
  audio: {
    aac: boolean;
    mp3: boolean;
    opus: boolean;
    flac: boolean;
    vorbis: boolean;
    alac: boolean;
    ac3: boolean;
    eac3: boolean;
  };
  hdr: { hdr10: boolean; hlg: boolean; dolbyVision: boolean };
  maxAudioChannels: number;
  hls: {
    /** <video src="…m3u8"> works. */
    native: boolean;
    /** Media Source Extensions are available, so hls.js can run. */
    mse: boolean;
  };
}

export function browserFamily(userAgent: string): BrowserFamily {
  if (userAgent.includes('Firefox/')) return 'firefox';
  if (/Edg\/|Chrome\/|Chromium\/|CriOS\//.test(userAgent)) return 'chromium';
  if (userAgent.includes('Safari/') && userAgent.includes('Version/')) return 'safari';
  return 'other';
}

interface MediaSourceLike {
  isTypeSupported: (type: string) => boolean;
}

function mediaSourceClass(): MediaSourceLike | null {
  const scope = window as unknown as {
    ManagedMediaSource?: MediaSourceLike;
    MediaSource?: MediaSourceLike;
  };
  return scope.ManagedMediaSource ?? scope.MediaSource ?? null;
}

async function supportsHdr(transferFunction: 'pq' | 'hlg'): Promise<boolean> {
  if (!window.matchMedia('(dynamic-range: high)').matches) return false;
  if (!('mediaCapabilities' in navigator)) return false;
  try {
    const result = await navigator.mediaCapabilities.decodingInfo({
      type: 'media-source',
      video: {
        contentType: 'video/mp4; codecs="hvc1.2.4.L153.B0"',
        width: 3840,
        height: 2160,
        bitrate: 20_000_000,
        framerate: 24,
        transferFunction,
        colorGamut: 'rec2020',
        ...(transferFunction === 'pq' ? { hdrMetadataType: 'smpteSt2086' as const } : {}),
      },
    });
    return result.supported;
  } catch {
    return false;
  }
}

function audioChannels(): number {
  try {
    const context = new AudioContext();
    const channels = context.destination.maxChannelCount;
    void context.close();
    return channels >= 6 ? 6 : 2;
  } catch {
    return 2;
  }
}

/** Reads the capabilities from the browser's media APIs. */
export async function detectCapabilities(): Promise<BrowserCapabilities> {
  const element = document.createElement('video');
  const can = (type: string) => element.canPlayType(type).replace('no', '') !== '';
  const mediaSource = mediaSourceClass();
  const mse = (type: string) => mediaSource?.isTypeSupported(type) ?? false;
  const either = (type: string) => can(type) || mse(type);

  const h264Levels: [string, number][] = [
    ['avc1.640834', 52],
    ['avc1.640833', 51],
    ['avc1.64002A', 42],
    ['avc1.640029', 41],
  ];
  const h264Level =
    h264Levels.find(([codec]) => either(`video/mp4; codecs="${codec}"`))?.[1] ??
    (either('video/mp4; codecs="avc1.42E01E"') ? 30 : 0);
  const [hdr10, hlg] = await Promise.all([supportsHdr('pq'), supportsHdr('hlg')]);
  const hevc =
    either('video/mp4; codecs="hvc1.1.6.L120.90"') ||
    either('video/mp4; codecs="hev1.1.6.L120.90"');

  return {
    browser: browserFamily(navigator.userAgent),
    containers: {
      mp4: can('video/mp4'),
      webm: can('video/webm'),
      mkv: can('video/x-matroska') || can('video/mkv'),
      mov: can('video/quicktime'),
    },
    video: {
      h264: h264Level > 0,
      h264Level,
      h264High10: either('video/mp4; codecs="avc1.6E0033"'),
      hevc,
      hevcMain10: hevc && either('video/mp4; codecs="hvc1.2.4.L153.B0"'),
      av1: either('video/mp4; codecs="av01.0.08M.08"'),
      av1Main10: either('video/mp4; codecs="av01.0.08M.10"'),
      vp9: either('video/webm; codecs="vp9"') || either('video/mp4; codecs="vp09.00.30.08"'),
      vp9Profile2: either('video/mp4; codecs="vp09.02.30.10"'),
      vp8: can('video/webm; codecs="vp8"'),
    },
    audio: {
      aac: either('audio/mp4; codecs="mp4a.40.2"'),
      mp3: can('audio/mpeg') || mse('audio/mp4; codecs="mp3"'),
      opus: either('audio/webm; codecs="opus"') || either('audio/mp4; codecs="opus"'),
      flac: can('audio/flac') || either('audio/mp4; codecs="flac"'),
      vorbis: can('audio/webm; codecs="vorbis"'),
      alac: can('audio/mp4; codecs="alac"'),
      ac3: either('audio/mp4; codecs="ac-3"'),
      eac3: either('audio/mp4; codecs="ec-3"'),
    },
    hdr: { hdr10, hlg, dolbyVision: hdr10 && can('video/mp4; codecs="dvh1.05.06"') },
    maxAudioChannels: audioChannels(),
    hls: {
      native: can('application/vnd.apple.mpegurl'),
      mse: mse('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'),
    },
  };
}

let cached: Promise<BrowserCapabilities> | null = null;

/** Capabilities of this browser, detected on first use. */
export function getCapabilities(): Promise<BrowserCapabilities> {
  cached ??= detectCapabilities();
  return cached;
}

/** Which engine plays an HLS stream: Safari's own player, hls.js, or none. */
export function hlsEngine(capabilities: BrowserCapabilities): 'native' | 'hlsjs' | null {
  // Safari's HLS player is more reliable than MSE there (and iPhones before iOS 17.1 lack MSE).
  if (capabilities.hls.native && capabilities.browser === 'safari') return 'native';
  if (capabilities.hls.mse) return 'hlsjs';
  return capabilities.hls.native ? 'native' : null;
}
