/**
 * Builds the DeviceProfile sent with PlaybackInfo from the detected capabilities
 * (docs/architecture.md §9.3). Pure function; follows the conventions of jellyfin-web's browser
 * profile so the server makes the same decisions for both clients.
 */
import type { CodecProfile } from '@jellyfin/sdk/lib/generated-client/models/codec-profile';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { DirectPlayProfile } from '@jellyfin/sdk/lib/generated-client/models/direct-play-profile';
import type { ProfileCondition } from '@jellyfin/sdk/lib/generated-client/models/profile-condition';
import type { SubtitleProfile } from '@jellyfin/sdk/lib/generated-client/models/subtitle-profile';
import type { TranscodingProfile } from '@jellyfin/sdk/lib/generated-client/models/transcoding-profile';
import type { BrowserCapabilities } from './capabilities';

export interface ProfileOptions {
  maxBitrate: number;
}

function pick(entries: [string, boolean][]): string[] {
  return entries.filter(([, supported]) => supported).map(([codec]) => codec);
}

function condition(
  Condition: ProfileCondition['Condition'],
  Property: ProfileCondition['Property'],
  Value: string,
  IsRequired = false,
): ProfileCondition {
  return { Condition, Property, Value, IsRequired };
}

/** Video range types (HDR formats) the screen and decoder can show for a 10-bit codec. */
function rangeTypes(capabilities: BrowserCapabilities, tenBit: boolean): string {
  const { hdr } = capabilities;
  const ranges = ['SDR', 'DOVIWithSDR'];
  if (tenBit && hdr.hdr10) ranges.push('HDR10', 'HDR10Plus', 'DOVIWithHDR10', 'DOVIWithHDR10Plus');
  if (tenBit && hdr.hlg) ranges.push('HLG', 'DOVIWithHLG');
  if (tenBit && hdr.dolbyVision) ranges.push('DOVI');
  return ranges.join('|');
}

function directPlayProfiles(capabilities: BrowserCapabilities): DirectPlayProfile[] {
  const { containers, video, audio } = capabilities;
  const mp4Video = pick([
    ['h264', video.h264],
    ['hevc', video.hevc],
    ['av1', video.av1],
    ['vp9', video.vp9],
  ]);
  const mp4Audio = pick([
    ['aac', audio.aac],
    ['mp3', audio.mp3],
    ['opus', audio.opus],
    ['flac', audio.flac],
    ['alac', audio.alac],
    ['ac3', audio.ac3],
    ['eac3', audio.eac3],
  ]);
  const profiles: DirectPlayProfile[] = [];
  const add = (container: string, videoCodecs: string[], audioCodecs: string[]) => {
    if (videoCodecs.length === 0) return;
    profiles.push({
      Container: container,
      Type: 'Video',
      VideoCodec: videoCodecs.join(','),
      AudioCodec: audioCodecs.join(','),
    });
  };
  if (containers.mp4) add('mp4,m4v', mp4Video, mp4Audio);
  if (containers.mkv) {
    add(
      'mkv',
      [...mp4Video, ...pick([['vp8', video.vp8]])],
      [...mp4Audio.filter((codec) => codec !== 'alac'), ...pick([['vorbis', audio.vorbis]])],
    );
  }
  if (containers.webm) {
    add(
      'webm',
      pick([
        ['vp8', video.vp8],
        ['vp9', video.vp9],
        ['av1', video.av1],
      ]),
      pick([
        ['vorbis', audio.vorbis],
        ['opus', audio.opus],
      ]),
    );
  }
  if (containers.mov) {
    add(
      'mov',
      pick([
        ['h264', video.h264],
        ['hevc', video.hevc],
      ]),
      mp4Audio,
    );
  }
  return profiles;
}

function transcodingProfiles(capabilities: BrowserCapabilities): TranscodingProfile[] {
  const { video, audio, browser } = capabilities;
  const videoCodecs = pick([
    ['hevc', video.hevc],
    ['h264', video.h264],
  ]);
  // Without any common codec the server still needs a target; H.264 is the most likely to work.
  if (videoCodecs.length === 0) videoCodecs.push('h264');
  // HEVC needs fragmented MP4 segments; MPEG-TS is the most compatible otherwise.
  const container = video.hevc ? 'mp4' : 'ts';
  const audioCodecs = [
    'aac',
    'mp3',
    ...pick([
      ['ac3', audio.ac3],
      ['eac3', audio.eac3],
    ]),
  ];
  const apple = browser === 'safari';
  return [
    {
      Container: container,
      Type: 'Video',
      VideoCodec: videoCodecs.join(','),
      AudioCodec: audioCodecs.join(','),
      Context: 'Streaming',
      Protocol: 'hls',
      MaxAudioChannels: String(capabilities.maxAudioChannels),
      MinSegments: apple ? 2 : 1,
      BreakOnNonKeyFrames: true,
    },
  ];
}

function codecProfiles(capabilities: BrowserCapabilities): CodecProfile[] {
  const { video } = capabilities;
  const profiles: CodecProfile[] = [];
  if (video.h264) {
    profiles.push({
      Type: 'Video',
      Codec: 'h264',
      Conditions: [
        condition('NotEquals', 'IsAnamorphic', 'true'),
        condition(
          'EqualsAny',
          'VideoProfile',
          `high|main|baseline|constrained baseline${video.h264High10 ? '|high 10' : ''}`,
        ),
        condition('EqualsAny', 'VideoRangeType', 'SDR'),
        condition('LessThanEqual', 'VideoLevel', String(video.h264Level)),
        condition('NotEquals', 'IsInterlaced', 'true'),
      ],
    });
  }
  if (video.hevc) {
    profiles.push({
      Type: 'Video',
      Codec: 'hevc',
      Conditions: [
        condition('NotEquals', 'IsAnamorphic', 'true'),
        condition('EqualsAny', 'VideoProfile', video.hevcMain10 ? 'main|main 10' : 'main'),
        condition('EqualsAny', 'VideoRangeType', rangeTypes(capabilities, video.hevcMain10)),
        condition('LessThanEqual', 'VideoLevel', '183'),
        condition('NotEquals', 'IsInterlaced', 'true'),
      ],
    });
  }
  if (video.av1) {
    profiles.push({
      Type: 'Video',
      Codec: 'av1',
      Conditions: [
        condition('EqualsAny', 'VideoProfile', 'main'),
        condition('EqualsAny', 'VideoRangeType', rangeTypes(capabilities, video.av1Main10)),
        condition('LessThanEqual', 'VideoLevel', '19'),
        condition('LessThanEqual', 'VideoBitDepth', video.av1Main10 ? '10' : '8'),
      ],
    });
  }
  if (video.vp9) {
    profiles.push({
      Type: 'Video',
      Codec: 'vp9',
      Conditions: [
        condition('EqualsAny', 'VideoRangeType', rangeTypes(capabilities, video.vp9Profile2)),
      ],
    });
  }
  // Browsers cannot switch between audio tracks of one file: any track other than the first one
  // needs a new stream with that track (architecture §9.7).
  profiles.push({
    Type: 'VideoAudio',
    Conditions: [condition('Equals', 'IsSecondaryAudio', 'false')],
  });
  return profiles;
}

/**
 * Text subtitles arrive as WebVTT (the server converts SRT, ASS and others); image subtitles are
 * burned into the picture.
 */
const SUBTITLE_PROFILES: SubtitleProfile[] = [
  { Format: 'vtt', Method: 'External' },
  { Format: 'pgssub', Method: 'Encode' },
  { Format: 'dvdsub', Method: 'Encode' },
  { Format: 'dvbsub', Method: 'Encode' },
];

export function buildDeviceProfile(
  capabilities: BrowserCapabilities,
  options: ProfileOptions,
): DeviceProfile {
  return {
    Name: 'Jellymorph',
    MaxStreamingBitrate: options.maxBitrate,
    MaxStaticBitrate: options.maxBitrate,
    MusicStreamingTranscodingBitrate: Math.min(options.maxBitrate, 384_000),
    DirectPlayProfiles: directPlayProfiles(capabilities),
    TranscodingProfiles: transcodingProfiles(capabilities),
    ContainerProfiles: [],
    CodecProfiles: codecProfiles(capabilities),
    SubtitleProfiles: SUBTITLE_PROFILES,
  };
}
