/** Browser capability fixtures for device profile and player tests. */
import type { BrowserCapabilities } from '@/player/capabilities';

const NONE = { hdr10: false, hlg: false, dolbyVision: false };

export const CHROME: BrowserCapabilities = {
  browser: 'chromium',
  containers: { mp4: true, webm: true, mkv: true, mov: false },
  video: {
    h264: true,
    h264Level: 52,
    h264High10: true,
    hevc: false,
    hevcMain10: false,
    av1: true,
    av1Main10: true,
    vp9: true,
    vp9Profile2: true,
    vp8: true,
  },
  audio: {
    aac: true,
    mp3: true,
    opus: true,
    flac: true,
    vorbis: true,
    alac: false,
    ac3: false,
    eac3: false,
  },
  hdr: NONE,
  maxAudioChannels: 2,
  hls: { native: true, mse: true },
};

export const FIREFOX: BrowserCapabilities = {
  ...CHROME,
  browser: 'firefox',
  containers: { mp4: true, webm: true, mkv: false, mov: false },
  video: { ...CHROME.video, h264Level: 51, h264High10: false },
  hls: { native: false, mse: true },
};

export const SAFARI: BrowserCapabilities = {
  browser: 'safari',
  containers: { mp4: true, webm: true, mkv: false, mov: true },
  video: {
    h264: true,
    h264Level: 52,
    h264High10: false,
    hevc: true,
    hevcMain10: true,
    av1: false,
    av1Main10: false,
    vp9: true,
    vp9Profile2: false,
    vp8: false,
  },
  audio: {
    aac: true,
    mp3: true,
    opus: true,
    flac: true,
    vorbis: false,
    alac: true,
    ac3: true,
    eac3: true,
  },
  hdr: { hdr10: true, hlg: true, dolbyVision: true },
  maxAudioChannels: 2,
  hls: { native: true, mse: true },
};

/** A TV browser with HEVC, Dolby audio and an HDR panel. */
export const TV: BrowserCapabilities = {
  ...CHROME,
  video: { ...CHROME.video, hevc: true, hevcMain10: true },
  audio: { ...CHROME.audio, ac3: true, eac3: true },
  hdr: { hdr10: true, hlg: true, dolbyVision: false },
  maxAudioChannels: 6,
  hls: { native: false, mse: true },
};
