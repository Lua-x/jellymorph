const QUALITY = 90;

/** Adds the size the UI renders at to a Jellyfin image URL. */
export function sizedImageUrl(url: string, width: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}maxWidth=${String(width)}&quality=${String(QUALITY)}`;
}
