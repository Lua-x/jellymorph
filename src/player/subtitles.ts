/**
 * Text subtitles as WebVTT in a <track> (docs/architecture.md §9.6). The file is fetched through
 * the SDK (with the auth header) and handed to the track as a Blob URL, so the <video> needs no
 * crossorigin attribute and direct play from another origin keeps working without CORS headers.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import { getSubtitleApi } from '@jellyfin/sdk/lib/utils/api/subtitle-api';

export interface SubtitleSource {
  itemId: string;
  mediaSourceId: string;
  index: number;
  language: string | null;
  label: string;
}

export async function fetchVtt(
  api: Api,
  source: SubtitleSource,
  signal?: AbortSignal,
): Promise<string> {
  const { data } = await getSubtitleApi(api).getSubtitle(
    {
      routeItemId: source.itemId,
      routeMediaSourceId: source.mediaSourceId,
      routeIndex: source.index,
      routeFormat: 'vtt',
    },
    { signal, responseType: 'text' },
  );
  return typeof data === 'string' ? data : await (data as Blob).text();
}

/** Owns the <track> element of the current text subtitle. */
export class SubtitleTrack {
  private element: HTMLTrackElement | null = null;
  private url: string | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  show(vtt: string, source: SubtitleSource): void {
    this.clear();
    this.url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = source.label;
    if (source.language) track.srclang = source.language;
    track.src = this.url;
    track.default = true;
    this.video.append(track);
    this.element = track;
    // Some browsers only render a track that was switched on after it was added.
    track.track.mode = 'showing';
  }

  clear(): void {
    if (this.element) {
      this.element.track.mode = 'disabled';
      this.element.remove();
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.element = null;
    this.url = null;
  }
}
