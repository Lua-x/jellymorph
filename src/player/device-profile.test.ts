import { describe, expect, it } from 'vitest';
import { CHROME, FIREFOX, SAFARI, TV } from '@/test/capabilities';
import { browserFamily, hlsEngine } from './capabilities';
import { buildDeviceProfile } from './device-profile';

const options = { maxBitrate: 20_000_000 };

function directPlay(profile: ReturnType<typeof buildDeviceProfile>, container: string) {
  return profile.DirectPlayProfiles?.find((entry) =>
    entry.Container?.split(',').includes(container),
  );
}

function codecConditions(
  profile: ReturnType<typeof buildDeviceProfile>,
  codec: string,
): Record<string, string | undefined> {
  const entry = profile.CodecProfiles?.find((candidate) => candidate.Codec === codec);
  const result: Record<string, string | undefined> = {};
  for (const condition of entry?.Conditions ?? []) {
    if (condition.Property) result[condition.Property] = condition.Value ?? undefined;
  }
  return result;
}

describe('buildDeviceProfile', () => {
  it('lets Chromium play MKV and MP4 directly and transcodes to H.264 in MPEG-TS', () => {
    const profile = buildDeviceProfile(CHROME, options);
    expect(profile.MaxStreamingBitrate).toBe(20_000_000);
    expect(directPlay(profile, 'mkv')?.VideoCodec).toBe('h264,av1,vp9,vp8');
    expect(directPlay(profile, 'mp4')?.AudioCodec).toBe('aac,mp3,opus,flac');
    expect(directPlay(profile, 'mov')).toBeUndefined();
    expect(profile.TranscodingProfiles).toEqual([
      expect.objectContaining({
        Container: 'ts',
        VideoCodec: 'h264',
        AudioCodec: 'aac,mp3',
        Protocol: 'hls',
        Context: 'Streaming',
        MaxAudioChannels: '2',
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      }),
    ]);
  });

  it('describes H.264 limits and allows only SDR for it', () => {
    const h264 = codecConditions(buildDeviceProfile(CHROME, options), 'h264');
    expect(h264.VideoLevel).toBe('52');
    expect(h264.VideoRangeType).toBe('SDR');
    expect(h264.VideoProfile).toBe('high|main|baseline|constrained baseline|high 10');
    expect(codecConditions(buildDeviceProfile(FIREFOX, options), 'h264').VideoProfile).toBe(
      'high|main|baseline|constrained baseline',
    );
  });

  it('never plays a secondary audio track directly (browsers cannot switch tracks)', () => {
    const profile = buildDeviceProfile(CHROME, options);
    expect(profile.CodecProfiles).toContainEqual({
      Type: 'VideoAudio',
      Conditions: [
        { Condition: 'Equals', Property: 'IsSecondaryAudio', Value: 'false', IsRequired: false },
      ],
    });
  });

  it('leaves MKV out where the browser cannot open it', () => {
    expect(directPlay(buildDeviceProfile(FIREFOX, options), 'mkv')).toBeUndefined();
  });

  it('uses HEVC, fragmented MP4 and Dolby audio where available', () => {
    const profile = buildDeviceProfile(SAFARI, options);
    expect(directPlay(profile, 'mov')?.VideoCodec).toBe('h264,hevc');
    expect(directPlay(profile, 'mp4')?.AudioCodec).toBe('aac,mp3,opus,flac,alac,ac3,eac3');
    expect(profile.TranscodingProfiles?.[0]).toMatchObject({
      Container: 'mp4',
      VideoCodec: 'hevc,h264',
      AudioCodec: 'aac,mp3,ac3,eac3',
      MinSegments: 2,
    });
  });

  it('allows HDR only for 10-bit codecs on an HDR screen', () => {
    const hevc = codecConditions(buildDeviceProfile(TV, options), 'hevc');
    expect(hevc.VideoRangeType?.split('|')).toEqual(
      expect.arrayContaining(['SDR', 'HDR10', 'HLG', 'DOVIWithHDR10']),
    );
    expect(hevc.VideoRangeType?.split('|')).not.toContain('DOVI');
    expect(codecConditions(buildDeviceProfile(CHROME, options), 'vp9').VideoRangeType).toBe(
      'SDR|DOVIWithSDR',
    );
    expect(
      codecConditions(buildDeviceProfile(SAFARI, options), 'hevc').VideoRangeType?.split('|'),
    ).toContain('DOVI');
  });

  it('delivers text subtitles as WebVTT and burns in image subtitles', () => {
    expect(buildDeviceProfile(CHROME, options).SubtitleProfiles).toEqual([
      { Format: 'vtt', Method: 'External' },
      { Format: 'pgssub', Method: 'Encode' },
      { Format: 'dvdsub', Method: 'Encode' },
      { Format: 'dvbsub', Method: 'Encode' },
    ]);
  });

  it('passes the 5.1 capability of a TV on to the transcoder', () => {
    expect(buildDeviceProfile(TV, options).TranscodingProfiles?.[0]?.MaxAudioChannels).toBe('6');
  });
});

describe('engine choice', () => {
  it('uses Safari’s own HLS player and hls.js everywhere else', () => {
    expect(hlsEngine(SAFARI)).toBe('native');
    expect(hlsEngine(CHROME)).toBe('hlsjs');
    expect(hlsEngine(FIREFOX)).toBe('hlsjs');
    expect(hlsEngine({ ...FIREFOX, hls: { native: false, mse: false } })).toBeNull();
    expect(hlsEngine({ ...CHROME, hls: { native: true, mse: false } })).toBe('native');
  });

  it('recognizes browser families from the user agent', () => {
    expect(
      browserFamily(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0 Safari/537.36 Edg/153.0',
      ),
    ).toBe('chromium');
    expect(
      browserFamily(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toBe('safari');
    expect(
      browserFamily('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'),
    ).toBe('firefox');
  });
});
