/**
 * Playback side of the demo server: PlaybackInfo with a simplified version of Jellyfin's stream
 * decision, the demo clip as direct stream and as HLS, WebVTT subtitles, media segments, chapters
 * and trickplay sheets. Every title plays the same recorded clip (scripts/record-demo-clip.ts).
 */
import clipUrl from './media/demo-clip.mp4?url';
import clipTable from './media/demo-clip.json';
import { CLIP_PARTS, CLIP_SECONDS, clipTimecode, hueAt, partAt } from './media/timeline';
import type { MockItem, MockStream } from './catalog';

export const CLIP_URL = clipUrl;

const TICKS = 10_000_000;

export function isPlayableItem(item: MockItem): boolean {
  return item.type === 'Movie' || item.type === 'Episode' || item.type === 'Trailer';
}

// ----- streams -----

interface DeviceProfileLike {
  MaxStreamingBitrate?: number | null;
  DirectPlayProfiles?: {
    Container?: string;
    Type?: string;
    VideoCodec?: string | null;
    AudioCodec?: string | null;
  }[];
  CodecProfiles?: {
    Type?: string;
    Codec?: string | null;
    Conditions?: { Condition?: string; Property?: string; Value?: string | null }[];
  }[];
  TranscodingProfiles?: {
    Container?: string;
    VideoCodec?: string;
    AudioCodec?: string;
    Protocol?: string;
  }[];
  SubtitleProfiles?: { Format?: string | null; Method?: string }[];
}

export interface PlaybackInfoBody {
  UserId?: string;
  DeviceProfile?: DeviceProfileLike;
  MaxStreamingBitrate?: number;
  StartTimeTicks?: number;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
  MediaSourceId?: string;
  EnableDirectPlay?: boolean;
  EnableDirectStream?: boolean;
  EnableTranscoding?: boolean;
  AllowVideoStreamCopy?: boolean;
  AllowAudioStreamCopy?: boolean;
  AlwaysBurnInSubtitleWhenTranscoding?: boolean;
}

const IMAGE_SUBTITLES = new Set(['pgssub', 'dvdsub', 'dvbsub']);
const isImageSubtitle = (stream: MockStream) => IMAGE_SUBTITLES.has(stream.codec.toLowerCase());

function subtitlePath(item: MockItem, index: number): string {
  return `/Videos/${item.id}/${item.id}/Subtitles/${String(index)}/0/Stream.vtt`;
}

/** MediaStreams of the item; with a decision, subtitles carry their delivery method. */
export function mediaStreamsDto(item: MockItem, delivery?: { burnIn: number | null }) {
  return item.streams.map((stream, index) => {
    const subtitle = stream.type === 'Subtitle';
    const encode = subtitle && (isImageSubtitle(stream) || delivery?.burnIn === index);
    return {
      Index: index,
      Type: stream.type,
      Language: stream.language ?? undefined,
      Codec: stream.codec,
      DisplayTitle: stream.title,
      Title: stream.title,
      IsDefault: stream.isDefault,
      IsForced: false,
      IsExternal: false,
      IsTextSubtitleStream: subtitle ? !isImageSubtitle(stream) : undefined,
      SupportsExternalStream: subtitle ? !isImageSubtitle(stream) : undefined,
      Width: stream.width,
      Height: stream.height,
      Profile: stream.profile,
      Level: stream.level,
      Channels: stream.channels,
      BitRate: stream.bitrate,
      VideoRangeType: stream.type === 'Video' ? (stream.rangeType ?? 'SDR') : undefined,
      ...(subtitle && delivery
        ? encode
          ? { DeliveryMethod: 'Encode' }
          : { DeliveryMethod: 'External', DeliveryUrl: subtitlePath(item, index) }
        : {}),
    };
  });
}

function listIncludes(list: string | null | undefined, value: string): boolean {
  if (!list) return true;
  return list
    .toLowerCase()
    .split(',')
    .map((entry) => entry.trim())
    .includes(value.toLowerCase());
}

const PROPERTY_VALUES: Record<
  string,
  (video: MockStream, secondaryAudio: boolean) => string | undefined
> = {
  VideoRangeType: (video) => video.rangeType ?? 'SDR',
  VideoProfile: (video) => video.profile?.toLowerCase(),
  VideoLevel: (video) => (video.level === undefined ? undefined : String(video.level)),
  IsSecondaryAudio: (_video, secondary) => String(secondary),
  IsAnamorphic: () => 'false',
  IsInterlaced: () => 'false',
};

function conditionHolds(
  condition: { Condition?: string; Property?: string; Value?: string | null },
  video: MockStream,
  secondaryAudio: boolean,
): boolean {
  const actual = condition.Property
    ? PROPERTY_VALUES[condition.Property]?.(video, secondaryAudio)
    : undefined;
  if (actual === undefined) return true;
  const expected = (condition.Value ?? '').toLowerCase();
  switch (condition.Condition) {
    case 'Equals':
      return actual.toLowerCase() === expected;
    case 'NotEquals':
      return actual.toLowerCase() !== expected;
    case 'EqualsAny':
      return expected.split('|').includes(actual.toLowerCase());
    case 'LessThanEqual':
      return Number(actual) <= Number(expected);
    case 'GreaterThanEqual':
      return Number(actual) >= Number(expected);
    default:
      return true;
  }
}

interface Decision {
  directPlay: boolean;
  audioIndex: number;
  subtitleIndex: number;
  burnIn: number | null;
}

/** A small version of Jellyfin's StreamBuilder: can the browser play the file as it is? */
export function decide(item: MockItem, body: PlaybackInfoBody): Decision {
  const profile = body.DeviceProfile ?? {};
  const video = item.streams.find((stream) => stream.type === 'Video');
  const audioIndexes = item.streams.flatMap((stream, index) =>
    stream.type === 'Audio' ? [index] : [],
  );
  const defaultAudio =
    audioIndexes.find((index) => item.streams[index]?.isDefault) ?? audioIndexes[0] ?? -1;
  const audioIndex = body.AudioStreamIndex ?? defaultAudio;
  const defaultSubtitle = item.streams.findIndex(
    (stream) => stream.type === 'Subtitle' && stream.isDefault,
  );
  const subtitleIndex = body.SubtitleStreamIndex ?? defaultSubtitle;
  const audio = item.streams[audioIndex];
  const subtitle = subtitleIndex >= 0 ? item.streams[subtitleIndex] : undefined;
  const burnIn =
    subtitle && (isImageSubtitle(subtitle) || body.AlwaysBurnInSubtitleWhenTranscoding === true)
      ? subtitleIndex
      : null;
  if (!video) return { directPlay: false, audioIndex, subtitleIndex, burnIn };

  const bitrate = (video.bitrate ?? 0) + (audio?.bitrate ?? 0);
  const maxBitrate = body.MaxStreamingBitrate ?? profile.MaxStreamingBitrate ?? Infinity;
  const secondaryAudio = audioIndex !== audioIndexes[0];
  const containerOk = (profile.DirectPlayProfiles ?? []).some(
    (entry) =>
      entry.Type === 'Video' &&
      listIncludes(entry.Container, item.container) &&
      listIncludes(entry.VideoCodec, video.codec) &&
      (!audio || listIncludes(entry.AudioCodec, audio.codec)),
  );
  const conditionsOk = (profile.CodecProfiles ?? []).every((codecProfile) => {
    const applies =
      codecProfile.Type === 'VideoAudio' ||
      (codecProfile.Type === 'Video' &&
        (!codecProfile.Codec || listIncludes(codecProfile.Codec, video.codec)));
    return (
      !applies ||
      (codecProfile.Conditions ?? []).every((condition) =>
        conditionHolds(condition, video, secondaryAudio),
      )
    );
  });
  const directPlay =
    body.EnableDirectPlay !== false &&
    containerOk &&
    conditionsOk &&
    burnIn === null &&
    bitrate <= maxBitrate;
  return { directPlay, audioIndex, subtitleIndex, burnIn };
}

/** The PlaybackInfo answer for one item. */
export function playbackInfo(
  item: MockItem,
  body: PlaybackInfoBody,
  token: string,
  playSessionId: string,
) {
  const decision = decide(item, body);
  const profile = body.DeviceProfile?.TranscodingProfiles?.[0];
  const query = new URLSearchParams({
    DeviceId: 'demo',
    MediaSourceId: item.id,
    PlaySessionId: playSessionId,
    ApiKey: token,
    VideoCodec: profile?.VideoCodec ?? 'h264',
    AudioCodec: profile?.AudioCodec ?? 'aac',
    AudioStreamIndex: String(decision.audioIndex),
    SegmentContainer: profile?.Container ?? 'ts',
    TranscodeReasons:
      decision.burnIn === null ? 'ContainerNotSupported' : 'SubtitleCodecNotSupported',
  });
  if (decision.burnIn !== null) {
    query.set('SubtitleStreamIndex', String(decision.burnIn));
    query.set('SubtitleMethod', 'Encode');
  }
  return {
    MediaSources: [
      {
        Protocol: 'File',
        Id: item.id,
        Path: `/media/demo/${item.id}.${item.container}`,
        Type: 'Default',
        Container: item.container,
        Name: item.name,
        IsRemote: false,
        ETag: `${item.id.slice(0, 8)}clip`,
        RunTimeTicks: Math.round(clipTable.durationSeconds * TICKS),
        SupportsTranscoding: body.EnableTranscoding !== false,
        SupportsDirectStream: decision.directPlay,
        SupportsDirectPlay: decision.directPlay,
        IsInfiniteStream: false,
        RequiresOpening: false,
        RequiresClosing: false,
        VideoType: 'VideoFile',
        MediaStreams: mediaStreamsDto(item, { burnIn: decision.burnIn }),
        Bitrate: item.streams.reduce((sum, stream) => sum + (stream.bitrate ?? 0), 0),
        DefaultAudioStreamIndex: decision.audioIndex,
        DefaultSubtitleStreamIndex: decision.subtitleIndex,
        ...(decision.directPlay
          ? {}
          : {
              TranscodingUrl: `/videos/${item.id}/master.m3u8?${query.toString()}`,
              TranscodingSubProtocol: 'hls',
              TranscodingContainer: profile?.Container ?? 'ts',
            }),
      },
    ],
    PlaySessionId: playSessionId,
  };
}

// ----- HLS -----

export function masterPlaylist(query: string): string {
  const bandwidth = Math.round(
    (clipTable.fragments.reduce((sum, fragment) => sum + fragment.length, 0) * 8) /
      clipTable.durationSeconds,
  );
  return [
    '#EXTM3U',
    `#EXT-X-STREAM-INF:BANDWIDTH=${String(Math.round(bandwidth * 1.3))},AVERAGE-BANDWIDTH=${String(bandwidth)},RESOLUTION=${String(clipTable.width)}x${String(clipTable.height)},CODECS="${clipTable.codecs}"`,
    `main.m3u8?${query}`,
    '',
  ].join('\n');
}

/** Media playlist: the clip's fragments as byte ranges of the one file. */
export function mediaPlaylist(baseUrl: string): string {
  const url = new URL(CLIP_URL, baseUrl).href;
  const target = Math.ceil(Math.max(...clipTable.fragments.map((fragment) => fragment.duration)));
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    `#EXT-X-TARGETDURATION:${String(target)}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    `#EXT-X-MAP:URI="${url}",BYTERANGE="${String(clipTable.init.length)}@${String(clipTable.init.offset)}"`,
    ...clipTable.fragments.flatMap((fragment) => [
      `#EXTINF:${fragment.duration.toFixed(3)},`,
      `#EXT-X-BYTERANGE:${String(fragment.length)}@${String(fragment.offset)}`,
      url,
    ]),
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');
}

// ----- subtitles -----

const LINES: Record<string, string[]> = {
  ger: [
    '♪ Leise Musik ♪',
    'Hörst du das auch?',
    'Das Signal kommt wieder – jede Nacht um dieselbe Zeit.',
    'Dann sollten wir herausfinden, wer es sendet.',
    'Morgen früh fahren wir zum Leuchtturm.',
    'Und wenn dort niemand ist?',
    'Dann warten wir. So lange, bis jemand kommt.',
    '♪ Abspannmusik ♪',
  ],
  eng: [
    '♪ Soft music ♪',
    'Do you hear that too?',
    'The signal is back – every night at the same time.',
    'Then we should find out who is sending it.',
    "We'll drive to the lighthouse in the morning.",
    'And if nobody is there?',
    'Then we wait. As long as it takes.',
    '♪ Closing music ♪',
  ],
};

const CUE_TIMES: [number, number][] = [
  [4, 9],
  [16, 19],
  [20, 25],
  [26, 30],
  [33, 37],
  [38, 41],
  [42, 46.5],
  [49, 55],
];

function vttTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const millis = Math.round((seconds - whole) * 1000);
  return `00:${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function subtitleVtt(item: MockItem, index: number): string | null {
  const stream = item.streams[index];
  if (stream?.type !== 'Subtitle' || isImageSubtitle(stream)) return null;
  const lines = LINES[stream.language ?? ''] ?? LINES.eng ?? [];
  return [
    'WEBVTT',
    '',
    ...CUE_TIMES.flatMap(([start, end], cue) => [
      String(cue + 1),
      `${vttTime(start)} --> ${vttTime(end)}`,
      lines[cue] ?? '',
      '',
    ]),
  ].join('\n');
}

// ----- segments, chapters, trickplay -----

export function segmentsDto(item: MockItem) {
  const intro = CLIP_PARTS.find((part) => part.kind === 'intro');
  const outro = CLIP_PARTS.find((part) => part.kind === 'outro');
  return [
    ...(intro ? [{ Type: 'Intro', start: intro.start, end: intro.end }] : []),
    ...(outro ? [{ Type: 'Outro', start: outro.start, end: clipTable.durationSeconds }] : []),
  ].map((segment, index) => ({
    Id: `${item.id.slice(0, 24)}${String(index).padStart(8, '0')}`,
    ItemId: item.id,
    Type: segment.Type,
    StartTicks: Math.round(segment.start * TICKS),
    EndTicks: Math.round(segment.end * TICKS),
  }));
}

const CHAPTER_NAMES = ['Anfang', 'Vorspann', 'Teil 1', 'Teil 2', 'Abspann'];

export function chaptersDto() {
  return CLIP_PARTS.map((part, index) => ({
    StartPositionTicks: part.start * TICKS,
    Name: CHAPTER_NAMES[index] ?? '',
    ImageDateModified: '2026-01-01T00:00:00.000Z',
  }));
}

export const TRICKPLAY = {
  Width: 320,
  Height: 180,
  TileWidth: 10,
  TileHeight: 10,
  ThumbnailCount: Math.ceil(CLIP_SECONDS / 2),
  Interval: 2000,
  Bandwidth: 40_000,
};

export function trickplayDto(item: MockItem) {
  return { [item.id]: { [String(TRICKPLAY.Width)]: TRICKPLAY } };
}

/** One tile sheet as SVG: a thumbnail every 2 s in the clip's colors with its timecode. */
export function trickplaySheetSvg(sheet: number): string | null {
  const perSheet = TRICKPLAY.TileWidth * TRICKPLAY.TileHeight;
  const first = sheet * perSheet;
  const count = Math.min(perSheet, TRICKPLAY.ThumbnailCount - first);
  if (count <= 0) return null;
  const { Width: w, Height: h, TileWidth: columns } = TRICKPLAY;
  const rows = Math.ceil(count / columns);
  const tiles = Array.from({ length: count }, (_, offset) => {
    const time = ((first + offset) * TRICKPLAY.Interval) / 1000;
    const hue = hueAt(time);
    const part = partAt(time);
    const x = (offset % columns) * w;
    const y = Math.floor(offset / columns) * h;
    const label =
      part.kind === 'intro' ? 'DEMO' : part.kind === 'outro' ? '· · ·' : clipTimecode(time);
    return `<g transform="translate(${String(x)} ${String(y)})"><rect width="${String(w)}" height="${String(h)}" fill="hsl(${String(hue)} 45% 14%)"/><circle cx="${String(80 + ((offset * 37) % 160))}" cy="${String(50 + ((offset * 23) % 80))}" r="46" fill="hsl(${String(hue + 40)} 70% 60% / 0.18)"/><text x="${String(w / 2)}" y="${String(h / 2 + 14)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="700" fill="#fff">${label}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(columns * w)}" height="${String(rows * h)}" viewBox="0 0 ${String(columns * w)} ${String(rows * h)}">${tiles.join('')}</svg>`;
}

/** Random bytes for the bandwidth test. */
export function bitrateTestBytes(size: number): Uint8Array {
  return new Uint8Array(Math.min(Math.max(0, size), 10_000_000));
}
