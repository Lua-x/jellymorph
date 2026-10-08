import { describe, expect, it } from 'vitest';
import { buildDeviceProfile } from '@/player/device-profile';
import { CHROME, SAFARI } from '@/test/capabilities';
import { movies, type MockItem } from './catalog';
import { decide, subtitleVtt, trickplaySheetSvg } from './playback';

const chrome = buildDeviceProfile(CHROME, { maxBitrate: 60_000_000 });
const safari = buildDeviceProfile(SAFARI, { maxBitrate: 60_000_000 });

function title(predicate: (item: MockItem) => boolean): MockItem {
  const item = movies.find(predicate);
  if (!item) throw new Error('No matching demo title');
  return item;
}

const h264Mkv = title((item) => item.streams[0]?.codec === 'h264' && item.container === 'mkv');
const hevc = title((item) => item.streams[0]?.codec === 'hevc');
const withPgs = title((item) => item.streams.some((stream) => stream.codec === 'PGSSUB'));

describe('demo server stream decision', () => {
  it('plays H.264 with AAC in MKV directly in Chrome', () => {
    expect(decide(h264Mkv, { DeviceProfile: chrome }).directPlay).toBe(true);
  });

  it('transcodes what the browser cannot decode or switch', () => {
    expect(decide(hevc, { DeviceProfile: chrome }).directPlay).toBe(false);
    expect(decide(h264Mkv, { DeviceProfile: safari }).directPlay).toBe(false);
    expect(decide(h264Mkv, { DeviceProfile: chrome, AudioStreamIndex: 2 }).directPlay).toBe(false);
    expect(
      decide(h264Mkv, { DeviceProfile: chrome, MaxStreamingBitrate: 2_000_000 }).directPlay,
    ).toBe(false);
    expect(decide(h264Mkv, { DeviceProfile: chrome, EnableDirectPlay: false }).directPlay).toBe(
      false,
    );
  });

  it('burns in image subtitles', () => {
    const index = withPgs.streams.findIndex((stream) => stream.codec === 'PGSSUB');
    const decision = decide(withPgs, { DeviceProfile: chrome, SubtitleStreamIndex: index });
    expect(decision.burnIn).toBe(index);
    expect(decision.directPlay).toBe(false);
  });

  it('serves WebVTT for text subtitles and trickplay sheets as SVG', () => {
    const srt = h264Mkv.streams.findIndex((stream) => stream.codec === 'subrip');
    expect(subtitleVtt(h264Mkv, srt)).toMatch(/^WEBVTT\n\n1\n00:00:04\.000 --> 00:00:09\.000\n/);
    expect(subtitleVtt(h264Mkv, 0)).toBeNull();
    expect(trickplaySheetSvg(0)).toContain('width="3200" height="540"');
    expect(trickplaySheetSvg(1)).toBeNull();
  });
});
