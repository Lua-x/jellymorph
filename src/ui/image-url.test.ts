import { describe, expect, it } from 'vitest';
import { imageQuality, sizedImageUrl } from './image-url';

const base = 'http://server/Items/abc/Images';

describe('sizedImageUrl', () => {
  it('adds width and quality to the existing query', () => {
    expect(sizedImageUrl(`${base}/Primary?tag=t1`, 480)).toBe(
      `${base}/Primary?tag=t1&maxWidth=480&quality=85`,
    );
    expect(sizedImageUrl(`${base}/Primary`, 480)).toBe(`${base}/Primary?maxWidth=480&quality=85`);
  });

  it('uses jellyfin-web’s quality for backdrops, with and without an index', () => {
    expect(sizedImageUrl(`${base}/Backdrop?tag=t1`, 2560)).toContain('quality=80');
    expect(sizedImageUrl(`${base}/Backdrop/2?tag=t1`, 2560)).toContain('quality=80');
    expect(imageQuality(`${base}/Backdrop`)).toBe(80);
  });

  // Quality 90 or more lets Jellyfin send the original file instead of its cached copy, which
  // wakes a hard disk with the artwork on every detail page.
  it('always stays below the quality that makes Jellyfin send the original', () => {
    for (const type of ['Primary', 'Backdrop', 'Logo', 'Thumb', 'Banner']) {
      expect(imageQuality(`${base}/${type}?tag=t1`)).toBeLessThan(90);
    }
  });
});
