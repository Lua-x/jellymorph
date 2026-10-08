import { describe, expect, it } from 'vitest';
import type { PlayerSegment } from './model';
import { nextUpStart } from './next-episode';
import { segmentAt } from './segments';
import { chooseTrickplay, trickplayTile, type TrickplayInfo } from './trickplay';

const info: TrickplayInfo = {
  width: 320,
  height: 180,
  tileWidth: 10,
  tileHeight: 10,
  thumbnailCount: 250,
  intervalMs: 10_000,
};

describe('trickplay', () => {
  it('finds sheet and offset of a thumbnail', () => {
    expect(trickplayTile(info, 0)).toMatchObject({ sheet: 0, x: 0, y: 0 });
    // Thumbnail 23: row 2, column 3 of the first sheet.
    expect(trickplayTile(info, 235)).toMatchObject({ sheet: 0, x: 960, y: 360 });
    // Thumbnail 105: second sheet, row 0, column 5.
    expect(trickplayTile(info, 1050)).toMatchObject({ sheet: 1, x: 1600, y: 0 });
  });

  it('knows that the last sheet has fewer rows but all columns', () => {
    // Thumbnails 200–249 → 5 rows on the third sheet.
    expect(trickplayTile(info, 2400)).toMatchObject({
      sheet: 2,
      sheetWidth: 3200,
      sheetHeight: 900,
    });
  });

  it('stays inside the available thumbnails', () => {
    expect(trickplayTile(info, 99_999)).toMatchObject({ sheet: 2, x: 2880, y: 720 });
    expect(trickplayTile(info, -5)).toMatchObject({ sheet: 0, x: 0, y: 0 });
  });

  it('picks the resolution closest to 320 px times the pixel ratio', () => {
    const resolutions = {
      '320': {
        Width: 320,
        Height: 180,
        TileWidth: 10,
        TileHeight: 10,
        ThumbnailCount: 9,
        Interval: 10_000,
      },
      '640': {
        Width: 640,
        Height: 360,
        TileWidth: 10,
        TileHeight: 10,
        ThumbnailCount: 9,
        Interval: 10_000,
      },
    };
    expect(chooseTrickplay(resolutions, 1)?.width).toBe(320);
    expect(chooseTrickplay(resolutions, 2)?.width).toBe(640);
    expect(chooseTrickplay({}, 1)).toBeNull();
    expect(chooseTrickplay(null, 1)).toBeNull();
  });
});

const segments: PlayerSegment[] = [
  { kind: 'intro', start: 30, end: 90 },
  { kind: 'outro', start: 2500, end: 2600 },
];

describe('segments and next episode', () => {
  it('offers to skip while a segment runs, not in its last half second', () => {
    expect(segmentAt(segments, 29)).toBeNull();
    expect(segmentAt(segments, 30)?.kind).toBe('intro');
    expect(segmentAt(segments, 89.4)?.kind).toBe('intro');
    expect(segmentAt(segments, 89.6)).toBeNull();
  });

  it('offers the next episode at the outro, otherwise 30 s before the end', () => {
    expect(nextUpStart(segments, 2600)).toBe(2500);
    expect(nextUpStart([], 2600)).toBe(2570);
    expect(nextUpStart([], 20)).toBe(0);
  });
});
