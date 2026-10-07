import type { Api } from '@jellyfin/sdk/lib/api';
import type { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';

/**
 * Image URLs for <img>. Built with api.getUri() (SDK) instead of the ImageUrlsApi helpers:
 * those pull the whole generated ImageApi class (~48 KB minified) into the bundle, and
 * getUserImageUrl() targets a route that no longer exists. Image endpoints need no token.
 * Size parameters (maxWidth, quality) are added by the UI for the size it renders.
 */
export interface ImageParams {
  tag: string;
  maxWidth?: number;
  quality?: number;
}

export function itemImageUrl(
  api: Api,
  itemId: string,
  type: ImageType,
  params: ImageParams,
  index?: number,
): string {
  const path = `/Items/${encodeURIComponent(itemId)}/Images/${type}`;
  return api.getUri(index === undefined ? path : `${path}/${index}`, params);
}

export function userImageUrl(api: Api, userId: string, tag: string): string {
  return api.getUri('/UserImage', { userId, tag });
}
