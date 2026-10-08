/**
 * Playback reports to Jellyfin, so "continue watching" and the play state are right on every
 * device (docs/architecture.md §9.8).
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { PlayMethod as ServerPlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import type { PlayMethod } from './model';
import { toTicks } from './model';

export interface PlaybackSnapshot {
  itemId: string;
  mediaSourceId: string;
  playSessionId: string;
  method: PlayMethod;
  positionSeconds: number;
  paused: boolean;
  muted: boolean;
  /** 0..1 */
  volume: number;
  audioIndex: number | null;
  subtitleIndex: number | null;
}

const PLAY_METHODS: Record<PlayMethod, ServerPlayMethod> = {
  directPlay: 'DirectPlay',
  directStream: 'DirectStream',
  transcode: 'Transcode',
};

const PROGRESS_INTERVAL_MS = 10_000;
const PING_INTERVAL_MS = 30_000;

function progressInfo(snapshot: PlaybackSnapshot) {
  return {
    ItemId: snapshot.itemId,
    MediaSourceId: snapshot.mediaSourceId,
    PlaySessionId: snapshot.playSessionId,
    PlayMethod: PLAY_METHODS[snapshot.method],
    PositionTicks: toTicks(snapshot.positionSeconds),
    IsPaused: snapshot.paused,
    IsMuted: snapshot.muted,
    VolumeLevel: Math.round(snapshot.volume * 100),
    AudioStreamIndex: snapshot.audioIndex ?? undefined,
    SubtitleStreamIndex: snapshot.subtitleIndex ?? -1,
    CanSeek: true,
  };
}

/**
 * Sends start, progress (every 10 s and on events), stop and keep-alive pings. Report failures
 * never interrupt playback; they are logged and the next report tries again.
 */
export class PlaybackReporter {
  private started = false;
  private stopped = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: Api,
    private readonly snapshot: () => PlaybackSnapshot | null,
  ) {}

  get hasStarted(): boolean {
    return this.started;
  }

  start(): void {
    const snapshot = this.snapshot();
    if (this.started || this.stopped || !snapshot) return;
    this.started = true;
    getSessionApi(this.api)
      .reportPlaybackStart({
        playbackStartInfo: {
          ...progressInfo(snapshot),
          PlaybackStartTimeTicks: toTicks(Date.now() / 1000),
        },
      })
      .catch(logFailure('start'));
    this.progressTimer = setInterval(() => {
      this.progress();
    }, PROGRESS_INTERVAL_MS);
  }

  /** Immediate progress report, e.g. after pause, seek or a track change. */
  progress(): void {
    const snapshot = this.snapshot();
    if (!this.started || this.stopped || !snapshot) return;
    getSessionApi(this.api)
      .reportPlaybackProgress({ playbackProgressInfo: progressInfo(snapshot) })
      .catch(logFailure('progress'));
  }

  /**
   * Keeps a paused transcode alive; Jellyfin ends transcodes whose segments are not requested
   * for a while.
   */
  setPinging(enabled: boolean): void {
    if (!enabled) {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      return;
    }
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      const snapshot = this.snapshot();
      if (!snapshot || this.stopped) return;
      getSessionApi(this.api)
        .pingPlaybackSession({ playSessionId: snapshot.playSessionId })
        .catch(logFailure('ping'));
    }, PING_INTERVAL_MS);
  }

  /**
   * Final report. `keepalive` lets the request outlive a closing tab (pagehide).
   * Returns once the server confirmed, so lists can be refreshed afterwards.
   */
  async stop(options: { keepalive?: boolean; failed?: boolean } = {}): Promise<void> {
    this.setPinging(false);
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = null;
    const snapshot = this.snapshot();
    if (!this.started || this.stopped || !snapshot) {
      this.stopped = true;
      return;
    }
    this.stopped = true;
    try {
      await getSessionApi(this.api).reportPlaybackStopped(
        {
          playbackStopInfo: {
            ItemId: snapshot.itemId,
            MediaSourceId: snapshot.mediaSourceId,
            PlaySessionId: snapshot.playSessionId,
            PositionTicks: toTicks(snapshot.positionSeconds),
            Failed: options.failed ?? false,
          },
        },
        options.keepalive ? { fetchOptions: { keepalive: true } } : undefined,
      );
    } catch (error) {
      logFailure('stop')(error);
    }
  }
}

function logFailure(report: string) {
  return (error: unknown) => {
    console.warn(`Playback report "${report}" failed`, error);
  };
}
