/**
 * What a theme's PlayerOverlay sees of the player: state and commands, no URLs, engines or
 * server details (docs/architecture.md §9.1). Times are in seconds.
 */
import type { MediaItem } from '@/domain/types';

export type PlaybackStatus = 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export type PlayMethod = 'directPlay' | 'directStream' | 'transcode';

/** Why playback failed, worded by the theme. */
export type PlayerErrorKind =
  'network' | 'format' | 'notAllowed' | 'rateLimit' | 'auth' | 'notFound' | 'server' | 'unknown';

export interface PlayerTrack {
  /** Stream index on the server. */
  index: number;
  label: string;
  language: string | null;
  codec: string | null;
  isDefault: boolean;
  isForced: boolean;
  /** Subtitles the server draws into the picture (image formats). */
  burnIn: boolean;
  /** Styled subtitles (ASS/SSA): shown as plain text unless burned in. */
  styled: boolean;
}

/** A quality limit; `maxBitrate` null = automatic. */
export interface QualityOption {
  maxBitrate: number | null;
  /** Typical picture height at that bitrate, for the label. */
  height: number | null;
}

export interface Chapter {
  start: number;
  name: string;
}

/** One thumbnail inside a trickplay tile sheet, in pixels of the sheet. */
export interface TrickplayFrame {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sheetWidth: number;
  sheetHeight: number;
}

export interface TrickplayModel {
  /** Thumbnail for a position, null outside the covered range. */
  frameAt: (seconds: number) => TrickplayFrame | null;
  /** Loads the tile sheets ahead of time (first hover or focus of the timeline). */
  preload: () => void;
}

export type SegmentKind = 'intro' | 'recap' | 'outro' | 'preview' | 'commercial';

export interface PlayerSegment {
  kind: SegmentKind;
  start: number;
  end: number;
}

export interface NextUp {
  item: MediaItem;
  /** Seconds until it starts on its own; null when autoplay is off or was cancelled. */
  countdown: number | null;
}

export interface PlayerState {
  item: MediaItem | null;
  status: PlaybackStatus;
  error: PlayerErrorKind | null;
  /** A new stream is being prepared (fallback, track or quality change). */
  adapting: boolean;
  currentTime: number;
  duration: number;
  /** End of the buffered range around the current position. */
  bufferedEnd: number;
  volume: number;
  muted: boolean;
  rate: number;
  audioTracks: PlayerTrack[];
  subtitleTracks: PlayerTrack[];
  audioIndex: number | null;
  /** null = subtitles off. */
  subtitleIndex: number | null;
  /** Burn styled subtitles into the picture instead of showing them as plain text. */
  burnInStyled: boolean;
  /** Chosen quality limit, null = automatic. */
  maxBitrate: number | null;
  playMethod: PlayMethod | null;
  chapters: Chapter[];
  trickplay: TrickplayModel | null;
  /** The skippable segment at the current position. */
  segment: PlayerSegment | null;
  /** Shown near the end of an episode when another one follows. */
  nextUp: NextUp | null;
  fullscreen: boolean;
  pictureInPicture: boolean;
}

export interface PlayerCommands {
  togglePlay: () => void;
  seek: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  /** 0..1 */
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
  selectAudio: (index: number) => void;
  selectSubtitle: (index: number | null) => void;
  setBurnInStyled: (enabled: boolean) => void;
  setMaxBitrate: (maxBitrate: number | null) => void;
  skipSegment: () => void;
  playNext: () => void;
  cancelNext: () => void;
  toggleFullscreen: () => void;
  togglePictureInPicture: () => void;
  retry: () => void;
  close: () => void;
}

export interface PlayerModel extends PlayerState, PlayerCommands {
  qualities: readonly QualityOption[];
  rates: readonly number[];
  canFullscreen: boolean;
  canPictureInPicture: boolean;
  /** Controls hide after a few seconds of playback without input. */
  controlsVisible: boolean;
  /** Shows the controls (pointer movement, key press, touch). */
  revealControls: () => void;
  /** Keeps the controls visible while a menu or the timeline is in use. */
  holdControls: (hold: boolean) => void;
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const QUALITY_OPTIONS: readonly QualityOption[] = [
  { maxBitrate: null, height: null },
  { maxBitrate: 120_000_000, height: 2160 },
  { maxBitrate: 60_000_000, height: 2160 },
  { maxBitrate: 20_000_000, height: 1080 },
  { maxBitrate: 10_000_000, height: 1080 },
  { maxBitrate: 6_000_000, height: 720 },
  { maxBitrate: 3_000_000, height: 720 },
  { maxBitrate: 1_500_000, height: 480 },
  { maxBitrate: 720_000, height: 360 },
];

export const TICKS_PER_SECOND = 10_000_000;

export const toTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);
export const toSeconds = (ticks: number) => ticks / TICKS_PER_SECOND;
