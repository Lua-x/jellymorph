export type EngineKind = 'native' | 'hlsjs';

/** Why an engine gave up; the controller decides whether to fall back (§9.11). */
export type EngineFailure = 'network' | 'format' | 'decode' | 'unknown';

/**
 * Loads a stream into the shared <video> element. Playback itself (play, pause, seek, volume) runs
 * on the element directly, so both engines behave the same for the controller (§9.5).
 */
export interface PlaybackEngine {
  readonly kind: EngineKind;
  /** Resolves once the stream's metadata is known and the start position is set. */
  load: (url: string, startSeconds: number) => Promise<void>;
  destroy: () => void;
}

export interface EngineOptions {
  video: HTMLVideoElement;
  /** A failure the engine could not recover from. */
  onFailure: (failure: EngineFailure, detail: string) => void;
}

export type EngineFactory = (kind: EngineKind, options: EngineOptions) => Promise<PlaybackEngine>;
