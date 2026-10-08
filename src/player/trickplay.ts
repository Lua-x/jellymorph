/**
 * Trickplay thumbnails on the timeline (docs/architecture.md §9.9). Jellyfin stores them as tile
 * sheets: `TileWidth × TileHeight` thumbnails per image, one every `Interval` ms.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { TrickplayInfoDto } from '@jellyfin/sdk/lib/generated-client/models/trickplay-info-dto';
import type { TrickplayFrame, TrickplayModel } from './model';

export interface TrickplayInfo {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  thumbnailCount: number;
  intervalMs: number;
}

/** Picks the resolution closest to 320 px × device pixel ratio. */
export function chooseTrickplay(
  resolutions: Record<string, TrickplayInfoDto> | null | undefined,
  devicePixelRatio: number,
): TrickplayInfo | null {
  const target = 320 * devicePixelRatio;
  const candidates = Object.values(resolutions ?? {})
    .map((info) => ({
      width: info.Width ?? 0,
      height: info.Height ?? 0,
      tileWidth: info.TileWidth ?? 0,
      tileHeight: info.TileHeight ?? 0,
      thumbnailCount: info.ThumbnailCount ?? 0,
      intervalMs: info.Interval ?? 0,
    }))
    .filter(
      (info) =>
        info.width > 0 &&
        info.height > 0 &&
        info.tileWidth > 0 &&
        info.tileHeight > 0 &&
        info.thumbnailCount > 0 &&
        info.intervalMs > 0,
    );
  return (
    candidates.sort((a, b) => Math.abs(a.width - target) - Math.abs(b.width - target))[0] ?? null
  );
}

/**
 * Sheet index and position of the thumbnail for a time. Jellyfin's sheets always have
 * `TileWidth` columns; only the last one has fewer rows. Pure; tested.
 */
export function trickplayTile(info: TrickplayInfo, seconds: number) {
  const thumb = Math.min(
    info.thumbnailCount - 1,
    Math.max(0, Math.floor((seconds * 1000) / info.intervalMs)),
  );
  const perSheet = info.tileWidth * info.tileHeight;
  const sheet = Math.floor(thumb / perSheet);
  const inSheet = thumb % perSheet;
  const sheetThumbs = Math.min(perSheet, info.thumbnailCount - sheet * perSheet);
  const rows = Math.ceil(sheetThumbs / info.tileWidth);
  return {
    sheet,
    x: (inSheet % info.tileWidth) * info.width,
    y: Math.floor(inSheet / info.tileWidth) * info.height,
    sheetWidth: info.tileWidth * info.width,
    sheetHeight: rows * info.height,
  };
}

export function createTrickplayModel(
  api: Api,
  itemId: string,
  mediaSourceId: string,
  info: TrickplayInfo,
): TrickplayModel {
  const sheetUrl = (sheet: number) =>
    api.getUri(
      `/Videos/${encodeURIComponent(itemId)}/Trickplay/${String(info.width)}/${String(sheet)}.jpg`,
      {
        MediaSourceId: mediaSourceId,
        ApiKey: api.accessToken,
      },
    );
  const sheets = Math.ceil(info.thumbnailCount / (info.tileWidth * info.tileHeight));
  let preloaded = false;
  return {
    frameAt: (seconds) => {
      if (!Number.isFinite(seconds) || seconds < 0) return null;
      const tile = trickplayTile(info, seconds);
      return {
        url: sheetUrl(tile.sheet),
        x: tile.x,
        y: tile.y,
        width: info.width,
        height: info.height,
        sheetWidth: tile.sheetWidth,
        sheetHeight: tile.sheetHeight,
      } satisfies TrickplayFrame;
    },
    preload: () => {
      if (preloaded) return;
      preloaded = true;
      for (let sheet = 0; sheet < sheets; sheet += 1) {
        const image = new Image();
        image.decoding = 'async';
        image.src = sheetUrl(sheet);
      }
    },
  };
}
