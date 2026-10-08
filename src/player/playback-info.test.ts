import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { createApi } from '@/api/client';
import { PlaybackFailure, planFor, playerErrorKind, type PlaybackRequest } from './playback-info';

const api = createApi('https://media.example', 'token123');

const request: PlaybackRequest = {
  itemId: 'item1',
  userId: 'user1',
  deviceId: 'device1',
  profile: {},
  maxBitrate: 20_000_000,
  startSeconds: 90,
  fallback: 0,
  burnInSubtitle: false,
};

const streams: MediaSourceInfo['MediaStreams'] = [
  { Index: 0, Type: 'Video', Codec: 'h264' },
  {
    Index: 1,
    Type: 'Audio',
    Codec: 'aac',
    Language: 'ger',
    DisplayTitle: 'Deutsch',
    IsDefault: true,
  },
  { Index: 2, Type: 'Audio', Codec: 'ac3', Language: 'eng', DisplayTitle: 'English' },
  {
    Index: 3,
    Type: 'Subtitle',
    Codec: 'subrip',
    DisplayTitle: 'Deutsch - SRT',
    DeliveryMethod: 'External',
    IsTextSubtitleStream: true,
  },
  {
    Index: 4,
    Type: 'Subtitle',
    Codec: 'PGSSUB',
    DisplayTitle: 'Deutsch - PGS',
    DeliveryMethod: 'Encode',
    IsTextSubtitleStream: false,
  },
  {
    Index: 5,
    Type: 'Subtitle',
    Codec: 'ass',
    DisplayTitle: 'Signs',
    DeliveryMethod: 'External',
    IsTextSubtitleStream: true,
  },
];

const source: MediaSourceInfo = {
  Id: 'source1',
  ETag: 'etag1',
  RunTimeTicks: 600_000_000,
  SupportsDirectPlay: true,
  SupportsDirectStream: true,
  SupportsTranscoding: true,
  MediaStreams: streams,
  DefaultAudioStreamIndex: 1,
  DefaultSubtitleStreamIndex: -1,
};

describe('planFor', () => {
  it('plays the static file directly with the token in the URL', () => {
    const plan = planFor(api, request, source, 'session1');
    expect(plan.method).toBe('directPlay');
    expect(plan.protocol).toBe('file');
    const url = new URL(plan.url);
    expect(url.pathname).toBe('/Videos/item1/stream');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      static: 'true',
      mediaSourceId: 'source1',
      deviceId: 'device1',
      ApiKey: 'token123',
      Tag: 'etag1',
      PlaySessionId: 'session1',
    });
    expect(plan.durationSeconds).toBe(60);
    expect(plan.audioIndex).toBe(1);
    expect(plan.subtitleIndex).toBeNull();
    expect(plan.canFallBack).toBe(true);
  });

  it('describes audio and subtitle tracks for the overlay', () => {
    const plan = planFor(api, request, source, 'session1');
    expect(plan.audioTracks.map((track) => track.label)).toEqual(['Deutsch', 'English']);
    expect(plan.subtitleTracks.map((track) => [track.label, track.burnIn, track.styled])).toEqual([
      ['Deutsch - SRT', false, false],
      ['Deutsch - PGS', true, false],
      ['Signs', false, true],
    ]);
  });

  it('uses the transcoding URL after a direct play failure and adds the token if missing', () => {
    const plan = planFor(
      api,
      { ...request, fallback: 1 },
      {
        ...source,
        TranscodingUrl: '/videos/item1/master.m3u8?MediaSourceId=source1',
        TranscodingSubProtocol: 'hls',
      },
      'session2',
    );
    expect(plan.method).toBe('transcode');
    expect(plan.protocol).toBe('hls');
    expect(plan.url).toBe(
      'https://media.example/videos/item1/master.m3u8?MediaSourceId=source1&ApiKey=token123',
    );
    expect(plan.offsetSeconds).toBe(0);
  });

  it('keeps a token the server already put into the URL', () => {
    const plan = planFor(
      api,
      request,
      {
        ...source,
        SupportsDirectPlay: false,
        SupportsDirectStream: false,
        TranscodingUrl: '/videos/item1/master.m3u8?api_key=server',
        TranscodingSubProtocol: 'hls',
      },
      's',
    );
    expect(plan.url).toBe('https://media.example/videos/item1/master.m3u8?api_key=server');
  });

  it('shifts positions of progressive transcodes that start at the requested time', () => {
    const plan = planFor(
      api,
      request,
      {
        ...source,
        SupportsDirectPlay: false,
        SupportsDirectStream: false,
        TranscodingUrl: '/videos/item1/stream.mkv?StartTimeTicks=900000000',
        TranscodingSubProtocol: 'http',
      },
      's',
    );
    expect(plan.protocol).toBe('file');
    expect(plan.offsetSeconds).toBe(90);
  });

  it('knows when the chosen subtitle is part of the picture', () => {
    expect(planFor(api, { ...request, subtitleIndex: 4 }, source, 's').subtitleBurnedIn).toBe(true);
    expect(planFor(api, { ...request, subtitleIndex: 3 }, source, 's').subtitleBurnedIn).toBe(
      false,
    );
    expect(planFor(api, { ...request, subtitleIndex: null }, source, 's').subtitleIndex).toBeNull();
  });

  it('cannot fall back any further after full transcoding', () => {
    const plan = planFor(
      api,
      { ...request, fallback: 2 },
      { ...source, TranscodingUrl: '/videos/item1/master.m3u8', TranscodingSubProtocol: 'hls' },
      's',
    );
    expect(plan.canFallBack).toBe(false);
  });

  it('fails clearly when no stream fits', () => {
    expect(() =>
      planFor(
        api,
        request,
        {
          ...source,
          SupportsDirectPlay: false,
          SupportsDirectStream: false,
          SupportsTranscoding: false,
        },
        's',
      ),
    ).toThrow(PlaybackFailure);
  });
});

describe('playerErrorKind', () => {
  const httpError = (status: number) =>
    new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: null,
    });

  it('maps server answers to reasons the player explains', () => {
    expect(playerErrorKind(new PlaybackFailure('notAllowed'))).toBe('notAllowed');
    expect(playerErrorKind(httpError(429))).toBe('rateLimit');
    expect(playerErrorKind(httpError(403))).toBe('notAllowed');
    expect(playerErrorKind(httpError(404))).toBe('notFound');
    expect(playerErrorKind(httpError(500))).toBe('server');
    expect(playerErrorKind(new AxiosError('offline', 'ERR_NETWORK'))).toBe('network');
  });
});
