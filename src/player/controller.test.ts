import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '@/api/client';
import { episodes, movies, type MockItem } from '@/mocks/catalog';
import { DEMO_USERS } from '@/mocks/fixtures';
import { mockState, resetMockServer, TEST_SERVER_URL } from '@/mocks/node';
import { DEFAULT_PLAYER_PREFERENCES } from '@/settings/store';
import { CHROME } from '@/test/capabilities';
import { PlaybackController } from './controller';
import type { EngineFactory, EngineFailure, EngineKind } from './engines';
import { createPlayerStore, type PlayerStore } from './store';

const alex = DEMO_USERS[0];

interface FakeEngine {
  kind: EngineKind;
  url: string | null;
  start: number | null;
  destroyed: boolean;
  fail: (failure: EngineFailure) => void;
}

/** Records every engine the controller creates; loading succeeds unless told otherwise. */
function engineFactory(options: { rejectNative?: EngineFailure } = {}) {
  const engines: FakeEngine[] = [];
  const factory: EngineFactory = (kind, { video: element, onFailure }) => {
    const engine: FakeEngine = {
      kind,
      url: null,
      start: null,
      destroyed: false,
      fail: (failure) => {
        onFailure(failure, 'test');
      },
    };
    engines.push(engine);
    return Promise.resolve({
      kind,
      load: (url: string, start: number) => {
        engine.url = url;
        engine.start = start;
        if (kind === 'native' && options.rejectNative) {
          return Promise.reject(
            Object.assign(new Error('fails'), { failure: options.rejectNative }),
          );
        }
        // Like the real engines: the start position is set once the metadata is known.
        element.currentTime = start;
        return Promise.resolve();
      },
      destroy: () => {
        engine.destroyed = true;
        element.load();
      },
    });
  };
  return { engines, factory };
}

/** A 1080p H.264 title with AAC sound, which Chrome plays directly. */
function directPlayable(list: MockItem[]): MockItem {
  const item = list.find(
    (candidate) =>
      candidate.streams[0]?.codec === 'h264' &&
      candidate.streams.some(
        (stream) => stream.type === 'Audio' && stream.isDefault && stream.codec === 'aac',
      ) &&
      !candidate.streams.some((stream) => stream.type === 'Subtitle' && stream.isDefault),
  );
  if (!item) throw new Error('No direct playable demo title');
  return item;
}

let store: PlayerStore;
let video: HTMLVideoElement;
const controllers: PlaybackController[] = [];

function createController(
  item: MockItem,
  factory: EngineFactory,
  overrides: { start?: number } = {},
) {
  const token = mockState.issueToken(alex?.id ?? '');
  const callbacks = {
    onFinished: vi.fn(),
    onPlayNext: vi.fn(),
    onStopped: vi.fn(),
    onPreferencesChange: vi.fn(),
  };
  const controller = new PlaybackController({
    api: createApi(TEST_SERVER_URL, token),
    userId: alex?.id ?? '',
    deviceId: 'test-device',
    itemId: item.id,
    startSeconds: overrides.start ?? 0,
    video,
    stage: document.createElement('div'),
    freezeCanvas: null,
    store,
    preferences: { ...DEFAULT_PLAYER_PREFERENCES, maxBitrate: 60_000_000 },
    autoplayNext: () => true,
    createEngine: factory,
    capabilities: () => Promise.resolve(CHROME),
    ...callbacks,
  });
  controllers.push(controller);
  return { controller, callbacks };
}

const settle = () =>
  vi.waitFor(() => {
    expect(store.getState().status).not.toBe('loading');
  });

beforeEach(() => {
  resetMockServer();
  store = createPlayerStore();
  video = document.createElement('video');
  document.body.append(video);
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
  }
});

afterEach(async () => {
  await Promise.all(controllers.splice(0).map((controller) => controller.destroy()));
  video.remove();
});

describe('PlaybackController', () => {
  it('plays a compatible file directly and reports the start', async () => {
    const movie = directPlayable([...movies]);
    const { engines, factory } = engineFactory();
    const { controller } = createController(movie, factory, { start: 12 });
    await controller.start();
    await settle();

    expect(engines).toHaveLength(1);
    expect(engines[0]?.kind).toBe('native');
    expect(engines[0]?.url).toContain(`/Videos/${movie.id}/stream?static=true`);
    expect(engines[0]?.start).toBe(12);
    const state = store.getState();
    expect(state.item?.name).toBe(movie.name);
    expect(state.status).toBe('playing');
    expect(state.playMethod).toBe('directPlay');
    expect(state.duration).toBeCloseTo(60.19, 1);
    expect(state.chapters.map((chapter) => chapter.name)).toEqual([
      'Anfang',
      'Vorspann',
      'Teil 1',
      'Teil 2',
      'Abspann',
    ]);
    expect(state.trickplay?.frameAt(10)?.url).toContain(`/Videos/${movie.id}/Trickplay/320/0.jpg`);
    await vi.waitFor(() => {
      expect(mockState.reports.map((report) => report.kind)).toContain('start');
    });
    expect(mockState.reports.find((report) => report.kind === 'start')?.body).toMatchObject({
      ItemId: movie.id,
      PlayMethod: 'DirectPlay',
      PositionTicks: 120_000_000,
    });
  });

  it('switches to a new stream for another audio track and keeps the position', async () => {
    const movie = directPlayable([...movies]);
    const { engines, factory } = engineFactory();
    const { controller } = createController(movie, factory, { start: 20 });
    await controller.start();
    await settle();
    video.currentTime = 25;
    video.dispatchEvent(new Event('timeupdate'));

    const secondary = store.getState().audioTracks[1];
    if (!secondary) throw new Error('Expected a second audio track');
    controller.selectAudio(secondary.index);
    await vi.waitFor(() => {
      expect(engines).toHaveLength(2);
      expect(store.getState().adapting).toBe(false);
    });

    expect(engines[0]?.destroyed).toBe(true);
    expect(engines[1]?.kind).toBe('hlsjs');
    expect(engines[1]?.url).toContain(`/videos/${movie.id}/master.m3u8`);
    expect(engines[1]?.url).toContain(`AudioStreamIndex=${String(secondary.index)}`);
    expect(engines[1]?.start).toBe(25);
    expect(store.getState().audioIndex).toBe(secondary.index);
    expect(store.getState().playMethod).toBe('transcode');
  });

  it('keeps a subtitle chosen while another stream is still being prepared', async () => {
    const movie = directPlayable([...movies]);
    const { engines, factory } = engineFactory();
    const { controller } = createController(movie, factory, { start: 20 });
    await controller.start();
    await settle();

    const state = store.getState();
    const secondary = state.audioTracks[1];
    const srt = state.subtitleTracks.find((track) => track.codec === 'subrip');
    if (!secondary || !srt) throw new Error('Expected audio and subtitle tracks');
    controller.selectAudio(secondary.index);
    controller.selectSubtitle(srt.index);
    await vi.waitFor(() => {
      expect(video.querySelector('track')?.label).toBe(srt.label);
    });

    expect(store.getState()).toMatchObject({
      audioIndex: secondary.index,
      subtitleIndex: srt.index,
      status: 'playing',
      adapting: false,
    });
    expect(engines.at(-1)?.url).toContain(`AudioStreamIndex=${String(secondary.index)}`);
  });

  it('falls back to transcoding when the browser cannot decode the file', async () => {
    const movie = directPlayable([...movies]);
    const { engines, factory } = engineFactory({ rejectNative: 'format' });
    const { controller } = createController(movie, factory, { start: 5 });
    await controller.start();
    await vi.waitFor(() => {
      expect(store.getState().status).toBe('playing');
    });

    expect(engines.map((engine) => engine.kind)).toEqual(['native', 'hlsjs']);
    expect(engines[1]?.start).toBe(5);
    expect(store.getState().playMethod).toBe('transcode');
    expect(store.getState().error).toBeNull();
  });

  it('shows an error after the last fallback failed', async () => {
    const movie = directPlayable([...movies]);
    const { engines, factory } = engineFactory();
    const { controller } = createController(movie, factory);
    await controller.start();
    await settle();

    engines[0]?.fail('decode');
    await vi.waitFor(() => {
      expect(engines).toHaveLength(2);
    });
    engines[1]?.fail('decode');
    await vi.waitFor(() => {
      expect(engines).toHaveLength(3);
    });
    engines[2]?.fail('decode');
    await vi.waitFor(() => {
      expect(store.getState().status).toBe('error');
    });
    expect(store.getState().error).toBe('format');
  });

  it('explains when the server refuses playback', async () => {
    resetMockServer({ faults: ['playbackInfo'] });
    const { factory } = engineFactory();
    const { controller } = createController(directPlayable([...movies]), factory);
    await controller.start();
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('server');
  });

  it('loads text subtitles as a track and burns image subtitles into a new stream', async () => {
    const movie = movies.find(
      (candidate) =>
        candidate.streams[0]?.codec === 'h264' &&
        candidate.streams.some((stream) => stream.codec === 'PGSSUB'),
    );
    if (!movie) throw new Error('No demo title with image subtitles');
    const { engines, factory } = engineFactory();
    const { controller } = createController(movie, factory);
    await controller.start();
    await settle();

    const srt = store.getState().subtitleTracks.find((track) => track.codec === 'subrip');
    if (!srt) throw new Error('Expected an SRT track');
    controller.selectSubtitle(srt.index);
    await vi.waitFor(() => {
      expect(video.querySelector('track')?.label).toBe(srt.label);
    });
    expect(engines).toHaveLength(1);

    const pgs = store.getState().subtitleTracks.find((track) => track.burnIn);
    if (!pgs) throw new Error('Expected a PGS track');
    controller.selectSubtitle(pgs.index);
    await vi.waitFor(() => {
      expect(engines).toHaveLength(2);
    });
    expect(engines[1]?.url).toContain('SubtitleMethod=Encode');
    expect(video.querySelector('track')).toBeNull();
  });

  it('reports the stop with the position and saves it on the server', async () => {
    const movie = directPlayable([...movies]);
    const { factory } = engineFactory();
    const { controller, callbacks } = createController(movie, factory, { start: 30 });
    await controller.start();
    await settle();
    video.currentTime = 31;
    video.dispatchEvent(new Event('timeupdate'));
    await vi.waitFor(() => {
      expect(mockState.reports.some((report) => report.kind === 'start')).toBe(true);
    });

    await controller.destroy();
    expect(callbacks.onStopped).toHaveBeenCalled();
    expect(mockState.reports.at(-1)).toMatchObject({
      kind: 'stopped',
      body: { ItemId: movie.id, PositionTicks: 310_000_000 },
    });
    expect(mockState.library.get(alex?.id ?? '', movie.id).positionTicks).toBe(310_000_000);
  });

  it('offers the next episode at the outro and starts it after the countdown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const episode = directPlayable([...episodes]);
      const { factory } = engineFactory();
      const { controller, callbacks } = createController(episode, factory, { start: 40 });
      await controller.start();
      await settle();
      await vi.waitFor(() => {
        expect(store.getState().chapters.length).toBeGreaterThan(0);
      });

      video.currentTime = 49;
      video.dispatchEvent(new Event('timeupdate'));
      await vi.waitFor(() => {
        expect(store.getState().nextUp?.countdown).toBe(10);
      });
      expect(store.getState().segment).toBeNull();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(callbacks.onPlayNext).toHaveBeenCalledWith(
        expect.objectContaining({ id: store.getState().nextUp?.item.id }),
        expect.any(Number),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers to skip the intro', async () => {
    const movie = directPlayable([...movies]);
    const { factory } = engineFactory();
    const { controller } = createController(movie, factory, { start: 4 });
    await controller.start();
    await settle();
    await vi.waitFor(() => {
      video.dispatchEvent(new Event('timeupdate'));
      expect(store.getState().segment?.kind).toBe('intro');
    });
    controller.skipSegment();
    expect(video.currentTime).toBe(15);
  });
});
