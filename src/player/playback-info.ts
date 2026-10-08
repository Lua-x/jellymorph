/**
 * Asks the server how to play an item and turns the answer into a playback plan: which URL,
 * which engine, which tracks (docs/architecture.md §9.2, §9.4). The source selection follows
 * jellyfin-web: direct play or direct stream use the static file, everything else the server's
 * transcoding URL.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { isAxiosError } from 'axios';
import { toAppError } from '@/api/errors';
import type { PlayerErrorKind, PlayerTrack, PlayMethod } from './model';
import { toSeconds, toTicks } from './model';

/** Fallback level (§9.11): 0 = best quality, 1 = no direct play, 2 = full transcode. */
export type FallbackLevel = 0 | 1 | 2;

export interface PlaybackRequest {
  itemId: string;
  userId: string;
  deviceId: string;
  profile: DeviceProfile;
  maxBitrate: number;
  startSeconds: number;
  /** undefined = the server's default track. */
  audioIndex?: number;
  /** undefined = the server's default, null = subtitles off. */
  subtitleIndex?: number | null;
  mediaSourceId?: string;
  fallback: FallbackLevel;
  /** Burn the chosen subtitle into the picture (styled subtitles on request). */
  burnInSubtitle: boolean;
}

export interface PlaybackPlan {
  method: PlayMethod;
  url: string;
  protocol: 'file' | 'hls';
  /** Item position of stream time 0 (progressive transcodes without copied timestamps). */
  offsetSeconds: number;
  playSessionId: string;
  mediaSourceId: string;
  durationSeconds: number | null;
  audioTracks: PlayerTrack[];
  subtitleTracks: PlayerTrack[];
  audioIndex: number | null;
  subtitleIndex: number | null;
  /** The chosen subtitle is part of the picture; no text track is needed. */
  subtitleBurnedIn: boolean;
  /** Further fallback levels are possible for this source. */
  canFallBack: boolean;
}

export class PlaybackFailure extends Error {
  readonly kind: PlayerErrorKind;

  constructor(kind: PlayerErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'PlaybackFailure';
    this.kind = kind;
  }
}

/** Maps request failures to the reasons the player explains. */
export function playerErrorKind(error: unknown): PlayerErrorKind {
  if (error instanceof PlaybackFailure) return error.kind;
  if (isAxiosError(error) && error.response?.status === 429) return 'rateLimit';
  const appError = toAppError(error);
  switch (appError.kind) {
    case 'network':
    case 'timeout':
      return 'network';
    case 'auth':
      return 'auth';
    case 'forbidden':
      return 'notAllowed';
    case 'notFound':
      return 'notFound';
    case 'server':
      return 'server';
    default:
      return 'unknown';
  }
}

const STYLED_CODECS = new Set(['ass', 'ssa']);

function toTrack(stream: MediaStream): PlayerTrack {
  const codec = stream.Codec?.toLowerCase() ?? null;
  return {
    index: stream.Index ?? 0,
    label: stream.DisplayTitle ?? stream.Title ?? stream.Language ?? codec ?? '',
    language: stream.Language ?? null,
    codec,
    isDefault: stream.IsDefault ?? false,
    isForced: stream.IsForced ?? false,
    burnIn: stream.DeliveryMethod === 'Encode' || stream.IsTextSubtitleStream === false,
    styled: codec !== null && STYLED_CODECS.has(codec),
  };
}

function withApiKey(url: string, token: string): string {
  if (/[?&](api_?key)=/i.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}ApiKey=${encodeURIComponent(token)}`;
}

/** Builds the plan for one media source of a PlaybackInfo answer. */
export function planFor(
  api: Api,
  request: PlaybackRequest,
  source: MediaSourceInfo,
  playSessionId: string,
): PlaybackPlan {
  const streams = source.MediaStreams ?? [];
  const audioTracks = streams.filter((stream) => stream.Type === 'Audio').map(toTrack);
  const subtitleTracks = streams.filter((stream) => stream.Type === 'Subtitle').map(toTrack);
  const mediaSourceId = source.Id ?? request.itemId;

  const audioIndex =
    request.audioIndex ?? source.DefaultAudioStreamIndex ?? audioTracks[0]?.index ?? null;
  const requestedSubtitle =
    request.subtitleIndex === undefined
      ? (source.DefaultSubtitleStreamIndex ?? -1)
      : (request.subtitleIndex ?? -1);
  const subtitle = subtitleTracks.find((track) => track.index === requestedSubtitle) ?? null;

  let method: PlayMethod;
  let url: string;
  let protocol: PlaybackPlan['protocol'] = 'file';
  let offsetSeconds = 0;
  const staticFile =
    request.fallback === 0 &&
    !request.burnInSubtitle &&
    (source.SupportsDirectPlay === true || source.SupportsDirectStream === true);

  if (staticFile) {
    method = source.SupportsDirectPlay ? 'directPlay' : 'directStream';
    url = api.getUri(`/Videos/${encodeURIComponent(request.itemId)}/stream`, {
      static: true,
      mediaSourceId,
      deviceId: request.deviceId,
      ApiKey: api.accessToken,
      Tag: source.ETag ?? undefined,
      PlaySessionId: playSessionId,
    });
  } else if (source.SupportsTranscoding && source.TranscodingUrl) {
    method = 'transcode';
    url = withApiKey(`${api.basePath}${source.TranscodingUrl}`, api.accessToken);
    if (source.TranscodingSubProtocol === 'hls') protocol = 'hls';
    else if (!/copytimestamps=true/i.test(url)) offsetSeconds = request.startSeconds;
  } else {
    throw new PlaybackFailure('format', 'No playable stream for this media source');
  }

  return {
    method,
    url,
    protocol,
    offsetSeconds,
    playSessionId,
    mediaSourceId,
    durationSeconds: source.RunTimeTicks ? toSeconds(source.RunTimeTicks) : null,
    audioTracks,
    subtitleTracks,
    audioIndex,
    subtitleIndex: subtitle?.index ?? null,
    subtitleBurnedIn:
      subtitle !== null && (subtitle.burnIn || (request.burnInSubtitle && method === 'transcode')),
    canFallBack: request.fallback < 2 && source.SupportsTranscoding === true,
  };
}

/** POST /Items/{id}/PlaybackInfo with the device profile, then picks the media source. */
export async function requestPlayback(
  api: Api,
  request: PlaybackRequest,
  signal?: AbortSignal,
): Promise<PlaybackPlan> {
  const full = request.fallback === 2;
  const burnIn = request.burnInSubtitle;
  const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo(
    {
      itemId: request.itemId,
      playbackInfoDto: {
        UserId: request.userId,
        DeviceProfile: request.profile,
        MaxStreamingBitrate: request.maxBitrate,
        StartTimeTicks: toTicks(request.startSeconds),
        AudioStreamIndex: request.audioIndex,
        SubtitleStreamIndex:
          request.subtitleIndex === undefined ? undefined : (request.subtitleIndex ?? -1),
        MediaSourceId: request.mediaSourceId,
        EnableDirectPlay: request.fallback === 0 && !burnIn,
        EnableDirectStream: !full && !burnIn,
        EnableTranscoding: true,
        AllowVideoStreamCopy: !full && !burnIn,
        AllowAudioStreamCopy: !full,
        AlwaysBurnInSubtitleWhenTranscoding: burnIn,
        AutoOpenLiveStream: false,
      },
    },
    { signal },
  );

  switch (data.ErrorCode) {
    case 'NotAllowed':
      throw new PlaybackFailure('notAllowed');
    case 'NoCompatibleStream':
      throw new PlaybackFailure('format');
    case 'RateLimitExceeded':
      throw new PlaybackFailure('rateLimit');
    default:
      break;
  }
  const sources = data.MediaSources ?? [];
  const source =
    sources.find((candidate) => candidate.Id === request.mediaSourceId) ?? sources[0] ?? null;
  if (!source) throw new PlaybackFailure('format', 'PlaybackInfo returned no media source');
  return planFor(api, request, source, data.PlaySessionId ?? '');
}

/**
 * Ends the server's transcode of a play session (track or quality change). The endpoint is
 * missing from the generated SDK client, so it goes through the SDK's axios instance.
 */
export async function stopActiveEncodings(
  api: Api,
  deviceId: string,
  playSessionId: string,
): Promise<void> {
  await api.axiosInstance.delete(api.getUri('/Videos/ActiveEncodings'), {
    params: { deviceId, playSessionId },
    headers: { Authorization: api.authorizationHeader },
  });
}

const MIN_BITRATE = 1_000_000;
const MAX_BITRATE = 120_000_000;
/** Measurements per server address. */
const measured = new Map<string, Promise<number>>();

async function downloadRate(
  api: Api,
  size: number,
): Promise<{ bitsPerSecond: number; ms: number }> {
  const started = performance.now();
  await getMediaInfoApi(api).getBitrateTestBytes({ size }, { responseType: 'arraybuffer' });
  const ms = Math.max(1, performance.now() - started);
  return { bitsPerSecond: (size * 8 * 1000) / ms, ms };
}

/**
 * "Automatic" quality: measures the connection to the server once per session and uses 80 % of
 * it (architecture §9.3). Fast connections are measured again with a larger sample.
 */
export function automaticBitrate(api: Api): Promise<number> {
  const known = measured.get(api.basePath);
  if (known) return known;
  const measurement = (async () => {
    let result = await downloadRate(api, 1_000_000);
    if (result.ms < 400) result = await downloadRate(api, 4_000_000);
    return Math.round(Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, result.bitsPerSecond * 0.8)));
  })().catch(() => {
    // Measure again next time; until then assume a typical broadband connection.
    measured.delete(api.basePath);
    return 20_000_000;
  });
  measured.set(api.basePath, measurement);
  return measurement;
}
