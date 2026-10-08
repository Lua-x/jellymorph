/**
 * One playback of one item (docs/architecture.md §9.2): asks the server for a stream, runs an
 * engine on the <video> element, reports progress, switches streams for track and quality
 * changes and falls back to transcoding when the browser cannot play a stream (§9.11).
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { MediaItem } from '@/domain/types';
import { getCapabilities, hlsEngine, type BrowserCapabilities } from './capabilities';
import { buildDeviceProfile } from './device-profile';
import { createEngine as defaultCreateEngine } from './engines';
import type { EngineFactory, EngineFailure, PlaybackEngine } from './engines';
import { fetchPlaybackItem } from './item';
import type { PlayerSegment, PlayerState } from './model';
import { fetchNextEpisode, NEXT_UP_COUNTDOWN_SECONDS, nextUpStart } from './next-episode';
import {
  automaticBitrate,
  PlaybackFailure,
  playerErrorKind,
  requestPlayback,
  stopActiveEncodings,
  type FallbackLevel,
  type PlaybackPlan,
} from './playback-info';
import {
  clearMediaSession,
  ScreenWakeLock,
  setMediaSession,
  updateMediaSessionPosition,
} from './platform';
import { PlaybackReporter, type PlaybackSnapshot } from './reporting';
import { fetchSegments, segmentAt } from './segments';
import type { PlayerStore } from './store';
import { SubtitleTrack, fetchVtt } from './subtitles';
import { chooseTrickplay, createTrickplayModel } from './trickplay';
import type { PlayerPreferences } from '@/settings/store';

export interface ControllerOptions {
  api: Api;
  userId: string;
  deviceId: string;
  itemId: string;
  startSeconds: number;
  video: HTMLVideoElement;
  /** Element shown full screen (player stage), so the overlay stays visible. */
  stage: HTMLElement;
  /** Shows the last frame while a new stream loads. */
  freezeCanvas: HTMLCanvasElement | null;
  store: PlayerStore;
  preferences: PlayerPreferences;
  /** Read at the moment it matters, so a changed setting applies right away. */
  autoplayNext: () => boolean;
  onPreferencesChange: (patch: Partial<PlayerPreferences>) => void;
  /** Playback finished without a following episode, or the player should close. */
  onFinished: () => void;
  onPlayNext: (item: MediaItem, startSeconds: number) => void;
  /** The stop report was confirmed; cached lists can be refreshed. */
  onStopped: () => void;
  createEngine?: EngineFactory;
  capabilities?: () => Promise<BrowserCapabilities>;
}

interface StreamRequest {
  startSeconds: number;
  audioIndex?: number;
  subtitleIndex?: number | null;
  keepPaused: boolean;
}

/** A stall longer than this triggers the fallback chain (§9.11). */
const STALL_WITH_BUFFER_MS = 15_000;
const STALL_WITHOUT_BUFFER_MS = 30_000;

export class PlaybackController {
  private readonly lifetime = new AbortController();
  private readonly reporter: PlaybackReporter;
  private readonly subtitles: SubtitleTrack;
  private readonly wakeLock: ScreenWakeLock;
  private readonly createEngine: EngineFactory;
  private readonly capabilities: () => Promise<BrowserCapabilities>;
  private engine: PlaybackEngine | null = null;
  private plan: PlaybackPlan | null = null;
  private fallback: FallbackLevel = 0;
  private networkRetried = false;
  private loadToken = 0;
  /** Stream changes in progress; media events of the old stream are ignored meanwhile. */
  private switching = false;
  /** Whether the stream being prepared should stay paused (the element is paused meanwhile). */
  private switchKeepsPaused = false;
  private destroyed = false;
  private hasPlayed = false;
  private position: number;
  private segments: PlayerSegment[] = [];
  private nextItem: MediaItem | null = null;
  private nextCancelled = false;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private stallTimer: ReturnType<typeof setInterval> | null = null;
  private stallSince: number | null = null;
  private seekReportTimer: ReturnType<typeof setTimeout> | null = null;
  private volumeSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSessionUpdate = 0;

  constructor(private readonly options: ControllerOptions) {
    this.position = options.startSeconds;
    this.createEngine = options.createEngine ?? defaultCreateEngine;
    this.capabilities = options.capabilities ?? getCapabilities;
    this.reporter = new PlaybackReporter(options.api, () => this.snapshot());
    this.subtitles = new SubtitleTrack(options.video);
    this.wakeLock = new ScreenWakeLock(this.lifetime.signal);
    const { video, preferences } = options;
    video.volume = preferences.volume;
    video.muted = preferences.muted;
    this.set({
      volume: preferences.volume,
      muted: preferences.muted,
      maxBitrate: preferences.maxBitrate,
      burnInStyled: preferences.burnInStyled,
    });
    this.listen();
  }

  private get state(): PlayerState {
    return this.options.store.getState();
  }

  private set(patch: Partial<PlayerState>): void {
    if (!this.destroyed) this.options.store.setState(patch);
  }

  /** A newer stream request or destroy() made this one obsolete (checked after every await). */
  private isStale(token: number): boolean {
    return token !== this.loadToken || this.destroyed;
  }

  private snapshot(): PlaybackSnapshot | null {
    const { plan } = this;
    if (!plan) return null;
    return {
      itemId: this.options.itemId,
      mediaSourceId: plan.mediaSourceId,
      playSessionId: plan.playSessionId,
      method: plan.method,
      positionSeconds: this.position,
      paused: this.options.video.paused,
      muted: this.options.video.muted,
      volume: this.options.video.volume,
      audioIndex: this.state.audioIndex,
      subtitleIndex: this.state.subtitleIndex,
    };
  }

  /** Loads the item and starts the first stream. */
  async start(): Promise<void> {
    const { api, itemId } = this.options;
    const signal = this.lifetime.signal;
    try {
      const playbackItem = await fetchPlaybackItem(api, itemId, signal);
      if (this.destroyed) return;
      const { item } = playbackItem;
      this.set({ item, chapters: playbackItem.chapters });
      this.setupMediaSession(item);

      void fetchSegments(api, itemId, signal).then((segments) => {
        this.segments = segments;
        this.updateTimeline();
      });
      if (item.episode) {
        void fetchNextEpisode(api, item.episode.seriesId, itemId, signal).then((next) => {
          this.nextItem = next;
          if (next) this.setupMediaSession(item);
          this.updateTimeline();
        });
      }

      await this.loadStream({ startSeconds: this.options.startSeconds, keepPaused: false });

      const plan = this.plan;
      if (plan) {
        const trickplay = chooseTrickplay(
          playbackItem.trickplay[plan.mediaSourceId],
          window.devicePixelRatio || 1,
        );
        this.set({
          trickplay: trickplay
            ? createTrickplayModel(api, itemId, plan.mediaSourceId, trickplay)
            : null,
        });
      }
    } catch (error) {
      this.fail(error);
    }
  }

  /** Requests a stream from the server and loads it into a fresh engine. */
  private async loadStream(request: StreamRequest): Promise<void> {
    const { api, video } = this.options;
    const token = ++this.loadToken;
    const signal = this.lifetime.signal;
    this.switching = true;
    this.switchKeepsPaused = request.keepPaused;
    if (this.hasPlayed) {
      this.freezeFrame();
      this.set({ adapting: true });
    } else {
      this.set({ status: 'loading' });
    }

    const previous = this.plan;
    if (previous && previous.method !== 'directPlay') {
      // Free the server's transcoder before it starts a new one.
      await stopActiveEncodings(api, this.options.deviceId, previous.playSessionId).catch(
        () => undefined,
      );
    }

    const capabilities = await this.capabilities();
    const maxBitrate = this.state.maxBitrate ?? (await automaticBitrate(api));
    const profile = buildDeviceProfile(capabilities, { maxBitrate });
    const base = {
      itemId: this.options.itemId,
      userId: this.options.userId,
      deviceId: this.options.deviceId,
      profile,
      maxBitrate,
      startSeconds: request.startSeconds,
      audioIndex: request.audioIndex,
      subtitleIndex: request.subtitleIndex,
      mediaSourceId: previous?.mediaSourceId,
      fallback: this.fallback,
    };
    const wantsBurnIn = (plan: PlaybackPlan | null, index: number | null | undefined) =>
      this.state.burnInStyled &&
      index !== null &&
      index !== undefined &&
      plan?.subtitleTracks.some((track) => track.index === index && track.styled) === true;

    let plan = await requestPlayback(
      api,
      { ...base, burnInSubtitle: wantsBurnIn(previous, request.subtitleIndex) },
      signal,
    );
    // The server's default subtitle may be a styled one the user wants burned in.
    if (!plan.subtitleBurnedIn && wantsBurnIn(plan, plan.subtitleIndex)) {
      plan = await requestPlayback(
        api,
        { ...base, subtitleIndex: plan.subtitleIndex, burnInSubtitle: true },
        signal,
      );
    }
    if (this.isStale(token)) return;

    const engineKind = plan.protocol === 'hls' ? hlsEngine(capabilities) : 'native';
    if (!engineKind) throw new PlaybackFailure('format', 'This browser cannot play HLS');

    this.engine?.destroy();
    this.subtitles.clear();
    this.engine = await this.createEngine(engineKind, {
      video,
      onFailure: (failure, detail) => {
        void this.handleFailure(failure, detail);
      },
    });
    if (this.isStale(token)) return;
    this.plan = plan;
    this.set({
      playMethod: plan.method,
      audioTracks: plan.audioTracks,
      subtitleTracks: plan.subtitleTracks,
      audioIndex: plan.audioIndex,
      subtitleIndex: plan.subtitleIndex,
      duration: plan.durationSeconds ?? this.state.duration,
      maxBitrate: this.state.maxBitrate,
    });

    await this.engine.load(plan.url, Math.max(0, request.startSeconds - plan.offsetSeconds));
    if (this.isStale(token)) return;
    this.switching = false;
    this.position = request.startSeconds;
    this.updateTimeline();

    if (plan.subtitleIndex !== null && !plan.subtitleBurnedIn) {
      void this.showTextSubtitle(plan.subtitleIndex);
    }
    if (request.keepPaused) {
      this.unfreeze();
      this.set({ adapting: false, status: 'paused' });
    } else {
      await video.play().catch((error: unknown) => {
        // Autoplay with sound needs a user gesture, e.g. after reloading the player page.
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          this.unfreeze();
          this.set({ adapting: false, status: 'paused' });
          return;
        }
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
      });
      // Usually "playing" ends the switch; an element that kept playing does not fire it again.
      if (!video.paused && this.state.adapting && !this.isStale(token)) {
        this.unfreeze();
        this.set({ adapting: false, status: 'playing' });
      }
    }
    this.reporter.progress();
  }

  private async showTextSubtitle(index: number): Promise<void> {
    const plan = this.plan;
    const track = plan?.subtitleTracks.find((candidate) => candidate.index === index);
    if (!plan || !track) return;
    try {
      const source = {
        itemId: this.options.itemId,
        mediaSourceId: plan.mediaSourceId,
        index,
        language: track.language,
        label: track.label,
      };
      const vtt = await fetchVtt(this.options.api, source, this.lifetime.signal);
      if (this.plan === plan && this.state.subtitleIndex === index)
        this.subtitles.show(vtt, source);
    } catch (error) {
      if (!this.destroyed) console.warn('Subtitles could not be loaded', error);
    }
  }

  /** Reloads the current position with changed stream parameters. */
  private reload(change: { audioIndex?: number; subtitleIndex?: number | null }): void {
    const state = this.state;
    void this.loadStream({
      startSeconds: this.position,
      audioIndex: change.audioIndex ?? state.audioIndex ?? undefined,
      subtitleIndex: 'subtitleIndex' in change ? change.subtitleIndex : state.subtitleIndex,
      keepPaused: this.switching
        ? this.switchKeepsPaused
        : this.options.video.paused && this.hasPlayed,
    }).catch((error: unknown) => {
      this.fail(error);
    });
  }

  private async handleFailure(failure: EngineFailure | 'stall', detail: string): Promise<void> {
    const plan = this.plan;
    if (this.destroyed || this.switching || !plan) return;
    console.warn(`Playback failure (${failure}, ${plan.method})`, detail);
    if (failure === 'network' && !this.networkRetried) {
      this.networkRetried = true;
    } else if (plan.canFallBack) {
      this.fallback = plan.method === 'transcode' || this.fallback === 1 ? 2 : 1;
    } else {
      this.fail(new PlaybackFailure(failure === 'network' ? 'network' : 'format', detail));
      return;
    }
    try {
      await this.loadStream({
        startSeconds: this.position,
        audioIndex: this.state.audioIndex ?? undefined,
        subtitleIndex: this.state.subtitleIndex,
        keepPaused: false,
      });
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.destroyed || (error instanceof DOMException && error.name === 'AbortError')) return;
    const engineFailure = (error as { failure?: EngineFailure } | null)?.failure;
    if (engineFailure && this.plan?.canFallBack) {
      // The new stream failed while loading: continue down the fallback chain.
      this.switching = false;
      void this.handleFailure(engineFailure, String(error));
      return;
    }
    console.error('Playback failed', error);
    this.switching = false;
    this.unfreeze();
    this.wakeLock.set(false);
    this.set({
      status: 'error',
      adapting: false,
      error: engineFailure
        ? engineFailure === 'network'
          ? 'network'
          : 'format'
        : playerErrorKind(error),
    });
  }

  // ----- media element events -----

  private listen(): void {
    const { video, stage } = this.options;
    const signal = this.lifetime.signal;
    const on = (event: string, handler: () => void) => {
      video.addEventListener(event, handler, { signal });
    };

    on('playing', () => {
      if (this.switching) return;
      this.hasPlayed = true;
      this.unfreeze();
      this.set({ status: 'playing', adapting: false });
      this.reporter.start();
      this.reporter.setPinging(false);
      this.wakeLock.set(true);
      this.watchStalls(true);
    });
    on('pause', () => {
      if (this.switching || video.ended) return;
      this.set({ status: 'paused' });
      this.reporter.progress();
      this.reporter.setPinging(this.plan?.method === 'transcode');
      this.wakeLock.set(false);
      this.watchStalls(false);
    });
    on('waiting', () => {
      if (this.switching) return;
      this.set({ status: 'buffering' });
    });
    on('timeupdate', () => {
      if (this.switching) return;
      this.position = video.currentTime + (this.plan?.offsetSeconds ?? 0);
      this.stallSince = null;
      this.updateTimeline();
    });
    on('seeked', () => {
      if (this.switching) return;
      if (this.seekReportTimer) clearTimeout(this.seekReportTimer);
      this.seekReportTimer = setTimeout(() => {
        this.reporter.progress();
      }, 800);
    });
    on('durationchange', () => {
      // The server's runtime is authoritative; browsers may only know the loaded part of a
      // stream (fragmented files, transcodes still in progress).
      if (this.switching || this.plan?.durationSeconds) return;
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0)
        this.set({ duration: duration + (this.plan?.offsetSeconds ?? 0) });
    });
    on('progress', () => {
      this.set({ bufferedEnd: this.bufferedEnd() });
    });
    on('volumechange', () => {
      this.set({ volume: video.volume, muted: video.muted });
      if (this.volumeSaveTimer) clearTimeout(this.volumeSaveTimer);
      this.volumeSaveTimer = setTimeout(() => {
        this.options.onPreferencesChange({ volume: video.volume, muted: video.muted });
        this.reporter.progress();
      }, 500);
    });
    on('ratechange', () => {
      this.set({ rate: video.playbackRate });
    });
    on('ended', () => {
      if (this.switching) return;
      this.handleEnded();
    });
    on('enterpictureinpicture', () => {
      this.set({ pictureInPicture: true });
    });
    on('leavepictureinpicture', () => {
      this.set({ pictureInPicture: false });
    });
    document.addEventListener(
      'fullscreenchange',
      () => {
        this.set({ fullscreen: document.fullscreenElement === stage });
      },
      { signal },
    );
    window.addEventListener(
      'pagehide',
      () => {
        void this.destroy({ keepalive: true });
      },
      { signal },
    );
  }

  private bufferedEnd(): number {
    const { video } = this.options;
    const offset = this.plan?.offsetSeconds ?? 0;
    for (let index = 0; index < video.buffered.length; index += 1) {
      if (
        video.buffered.start(index) <= video.currentTime + 0.5 &&
        video.buffered.end(index) >= video.currentTime
      )
        return video.buffered.end(index) + offset;
    }
    return this.position;
  }

  private watchStalls(active: boolean): void {
    if (!active) {
      if (this.stallTimer) clearInterval(this.stallTimer);
      this.stallTimer = null;
      this.stallSince = null;
      return;
    }
    if (this.stallTimer) return;
    this.stallTimer = setInterval(() => {
      const { video } = this.options;
      if (this.switching || video.paused || this.state.status !== 'buffering') {
        this.stallSince = null;
        return;
      }
      this.stallSince ??= Date.now();
      const buffered = this.bufferedEnd() - this.position > 1;
      const limit = buffered ? STALL_WITH_BUFFER_MS : STALL_WITHOUT_BUFFER_MS;
      if (Date.now() - this.stallSince > limit) {
        this.stallSince = null;
        void this.handleFailure('stall', `no progress for ${String(limit / 1000)} s`);
      }
    }, 1000);
  }

  /** Position-dependent state: time, skippable segment, next-episode offer. */
  private updateTimeline(): void {
    const { video } = this.options;
    const state = this.state;
    const duration = state.duration;
    const position = this.position;
    const nextFrom = duration > 0 ? nextUpStart(this.segments, duration) : Infinity;
    const offerNext = this.nextItem !== null && !this.nextCancelled && position >= nextFrom;

    let segment = segmentAt(this.segments, position);
    if (segment?.kind === 'outro' && offerNext) segment = null;

    let nextUp = state.nextUp;
    if (offerNext && this.nextItem) {
      if (nextUp?.item.id !== this.nextItem.id) {
        nextUp = {
          item: this.nextItem,
          countdown: this.options.autoplayNext() ? NEXT_UP_COUNTDOWN_SECONDS : null,
        };
        this.startCountdown();
      }
    } else if (nextUp) {
      nextUp = null;
      this.stopCountdown();
    }

    this.set({
      currentTime: position,
      bufferedEnd: this.bufferedEnd(),
      segment,
      nextUp,
    });
    if (Date.now() - this.lastSessionUpdate > 5000) {
      this.lastSessionUpdate = Date.now();
      updateMediaSessionPosition(duration, position, video.playbackRate);
    }
  }

  private startCountdown(): void {
    this.stopCountdown();
    if (!this.options.autoplayNext()) return;
    this.countdownTimer = setInterval(() => {
      const nextUp = this.state.nextUp;
      if (nextUp?.countdown == null) {
        this.stopCountdown();
        return;
      }
      if (this.options.video.paused) return;
      const countdown = nextUp.countdown - 1;
      if (countdown <= 0) {
        this.stopCountdown();
        this.playNext();
        return;
      }
      this.set({ nextUp: { ...nextUp, countdown } });
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  private handleEnded(): void {
    this.set({ status: 'ended' });
    this.wakeLock.set(false);
    this.watchStalls(false);
    if (this.nextItem && !this.nextCancelled && this.options.autoplayNext()) {
      this.playNext();
      return;
    }
    if (this.nextItem && !this.nextCancelled) {
      // Without autoplay the offer stays until the user decides.
      this.set({ nextUp: { item: this.nextItem, countdown: null } });
      return;
    }
    this.options.onFinished();
  }

  private freezeFrame(): void {
    const { video, freezeCanvas } = this.options;
    if (!freezeCanvas || video.readyState < 2 || video.videoWidth === 0) return;
    freezeCanvas.width = video.videoWidth;
    freezeCanvas.height = video.videoHeight;
    try {
      freezeCanvas.getContext('2d')?.drawImage(video, 0, 0);
      freezeCanvas.hidden = false;
    } catch {
      // Drawing can fail for protected content; then the picture is briefly black.
    }
  }

  private unfreeze(): void {
    if (this.options.freezeCanvas) this.options.freezeCanvas.hidden = true;
  }

  private setupMediaSession(item: MediaItem): void {
    setMediaSession(item, {
      play: () => {
        void this.options.video.play().catch(() => undefined);
      },
      pause: () => {
        this.options.video.pause();
      },
      seekBy: (seconds) => {
        this.seekBy(seconds);
      },
      seekTo: (seconds) => {
        this.seek(seconds);
      },
      stop: () => {
        this.options.onFinished();
      },
      next: this.nextItem
        ? () => {
            this.playNext();
          }
        : null,
    });
  }

  // ----- commands -----

  togglePlay(): void {
    const { video } = this.options;
    if (this.state.status === 'error' || this.switching) return;
    if (video.paused || video.ended) {
      if (video.ended) this.seek(0);
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  seek(seconds: number): void {
    const { video } = this.options;
    const plan = this.plan;
    if (!plan || this.switching) return;
    const duration = this.state.duration > 0 ? this.state.duration : (plan.durationSeconds ?? 0);
    const target = Math.min(Math.max(0, seconds), Math.max(0, duration - 0.25));
    if (target < plan.offsetSeconds) {
      // Progressive transcodes cannot go back before their start: request a new one.
      void this.loadStream({ startSeconds: target, keepPaused: video.paused }).catch(
        (error: unknown) => {
          this.fail(error);
        },
      );
      return;
    }
    video.currentTime = target - plan.offsetSeconds;
    this.position = target;
    this.updateTimeline();
  }

  seekBy(delta: number): void {
    this.seek(this.position + delta);
  }

  setVolume(volume: number): void {
    const { video } = this.options;
    video.volume = Math.min(1, Math.max(0, volume));
    if (video.volume > 0) video.muted = false;
  }

  toggleMute(): void {
    this.options.video.muted = !this.options.video.muted;
  }

  setRate(rate: number): void {
    this.options.video.playbackRate = rate;
  }

  selectAudio(index: number): void {
    if (index === this.state.audioIndex || !this.plan) return;
    this.set({ audioIndex: index });
    this.reload({ audioIndex: index });
  }

  selectSubtitle(index: number | null): void {
    const plan = this.plan;
    const state = this.state;
    if (!plan || index === state.subtitleIndex) return;
    if (this.switching) {
      // A stream is still being prepared with the old choice: prepare it again with this one.
      this.set({ subtitleIndex: index });
      this.reload({ subtitleIndex: index });
      return;
    }
    const track = plan.subtitleTracks.find((candidate) => candidate.index === index) ?? null;
    const needsBurnIn = track !== null && (track.burnIn || (track.styled && state.burnInStyled));
    if (needsBurnIn || plan.subtitleBurnedIn) {
      // Burned-in subtitles come with a new stream, also when removing them.
      this.set({ subtitleIndex: index });
      this.reload({ subtitleIndex: index });
      return;
    }
    this.subtitles.clear();
    this.set({ subtitleIndex: index });
    if (index !== null) void this.showTextSubtitle(index);
    this.reporter.progress();
  }

  setBurnInStyled(enabled: boolean): void {
    if (enabled === this.state.burnInStyled) return;
    this.set({ burnInStyled: enabled });
    this.options.onPreferencesChange({ burnInStyled: enabled });
    const index = this.state.subtitleIndex;
    const track = this.plan?.subtitleTracks.find((candidate) => candidate.index === index);
    if (track?.styled) this.reload({ subtitleIndex: index });
  }

  setMaxBitrate(maxBitrate: number | null): void {
    if (maxBitrate === this.state.maxBitrate) return;
    this.set({ maxBitrate });
    this.options.onPreferencesChange({ maxBitrate });
    this.fallback = 0;
    this.reload({});
  }

  skipSegment(): void {
    const segment = this.state.segment;
    if (segment) this.seek(segment.end);
  }

  playNext(): void {
    const next = this.nextItem;
    if (!next) return;
    this.stopCountdown();
    const resume =
      next.userData.positionTicks > 0 && !next.userData.played
        ? next.userData.positionTicks / 10_000_000
        : 0;
    this.options.onPlayNext(next, resume);
  }

  cancelNext(): void {
    this.nextCancelled = true;
    this.stopCountdown();
    this.set({ nextUp: null });
    if (this.state.status === 'ended') this.options.onFinished();
  }

  toggleFullscreen(): void {
    const { stage, video } = this.options;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (typeof stage.requestFullscreen === 'function') {
      void stage.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      return;
    }
    // iPhone Safari only allows the video element itself to go full screen.
    const webkitVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    webkitVideo.webkitEnterFullscreen?.();
  }

  togglePictureInPicture(): void {
    const { video } = this.options;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else if (document.pictureInPictureEnabled) {
      void video.requestPictureInPicture().catch(() => undefined);
    }
  }

  retry(): void {
    this.fallback = 0;
    this.networkRetried = false;
    this.set({ status: 'loading', error: null });
    if (!this.state.item) {
      void this.start();
      return;
    }
    void this.loadStream({
      startSeconds: this.position,
      audioIndex: this.state.audioIndex ?? undefined,
      subtitleIndex: this.state.subtitleIndex,
      keepPaused: false,
    }).catch((error: unknown) => {
      this.fail(error);
    });
  }

  /** Ends the playback: stop report, engine and listeners. Safe to call more than once. */
  async destroy(options: { keepalive?: boolean } = {}): Promise<void> {
    if (this.destroyed) return;
    const stopped = this.reporter.stop({ keepalive: options.keepalive });
    const hadStarted = this.reporter.hasStarted;
    this.destroyed = true;
    this.lifetime.abort();
    this.stopCountdown();
    this.watchStalls(false);
    if (this.seekReportTimer) clearTimeout(this.seekReportTimer);
    if (this.volumeSaveTimer) {
      clearTimeout(this.volumeSaveTimer);
      this.options.onPreferencesChange({
        volume: this.options.video.volume,
        muted: this.options.video.muted,
      });
    }
    this.wakeLock.release();
    clearMediaSession();
    if (document.pictureInPictureElement === this.options.video)
      void document.exitPictureInPicture().catch(() => undefined);
    this.subtitles.clear();
    this.engine?.destroy();
    this.engine = null;
    await stopped;
    if (hadStarted) this.options.onStopped();
  }
}
