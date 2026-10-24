/**
 * Image quality we ask Jellyfin for. It must stay below 90: with quality 90 or more and a size at
 * least as large as the original, Jellyfin skips its cache of resized images and sends the
 * original file from wherever it lies (ImageProcessingOptions.HasDefaultOptions). Artwork often
 * sits next to the media on a hard disk, which then wakes up for a detail page. Below 90 the
 * server always answers from its image cache after the first request.
 */
const QUALITY = 85;

/** Backdrops use jellyfin-web's quality, so sizes both clients request share cache entries. */
const BACKDROP_QUALITY = 80;

const BACKDROP_PATH = /\/Images\/Backdrop(?:[/?]|$)/;

export function imageQuality(url: string): number {
  return BACKDROP_PATH.test(url) ? BACKDROP_QUALITY : QUALITY;
}

/** Adds the size the UI renders at to a Jellyfin image URL. */
export function sizedImageUrl(url: string, width: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}maxWidth=${String(width)}&quality=${String(imageQuality(url))}`;
}
