import { beforeEach, describe, expect, it } from 'vitest';
import { describeDevice, getDeviceId } from './device';

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a 32 character hex id once and reuses it', () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(getDeviceId()).toBe(first);
  });

  it('replaces a corrupted stored id', () => {
    localStorage.setItem('jellymorph.deviceId', 'not-an-id');
    expect(getDeviceId()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('describeDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Safari · macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari · iOS',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox · Linux'],
    [
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Chrome · webOS',
    ],
    ['curl/8.0', 'Browser'],
  ])('describes %s', (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });
});
