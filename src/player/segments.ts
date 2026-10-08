/**
 * Media segments (intro, recap, outro …) for "skip" buttons (docs/architecture.md §9.9). Servers
 * without a segment provider return none; then no button appears.
 */
import type { Api } from '@jellyfin/sdk/lib/api';
import type { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import { getMediaSegmentApi } from '@jellyfin/sdk/lib/utils/api/media-segment-api';
import type { PlayerSegment, SegmentKind } from './model';
import { toSeconds } from './model';

const KINDS: Partial<Record<MediaSegmentType, SegmentKind>> = {
  Intro: 'intro',
  Recap: 'recap',
  Outro: 'outro',
  Preview: 'preview',
  Commercial: 'commercial',
};

/** Segments shorter than this are not worth a button. */
const MIN_LENGTH_SECONDS = 2;

export async function fetchSegments(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<PlayerSegment[]> {
  try {
    const { data } = await getMediaSegmentApi(api).getItemSegments(
      { itemId, includeSegmentTypes: ['Intro', 'Recap', 'Outro', 'Preview', 'Commercial'] },
      { signal },
    );
    return (data.Items ?? [])
      .map((segment) => ({
        kind: (segment.Type && KINDS[segment.Type]) ?? null,
        start: toSeconds(segment.StartTicks ?? 0),
        end: toSeconds(segment.EndTicks ?? 0),
      }))
      .filter(
        (segment): segment is PlayerSegment =>
          segment.kind !== null && segment.end - segment.start >= MIN_LENGTH_SECONDS,
      )
      .sort((a, b) => a.start - b.start);
  } catch {
    // Older servers or a missing provider: playback works without skip buttons.
    return [];
  }
}

/**
 * The segment a skip button is offered for. The last half second is left out, so the button
 * does not flash up again right after skipping.
 */
export function segmentAt(
  segments: readonly PlayerSegment[],
  seconds: number,
): PlayerSegment | null {
  return (
    segments.find((segment) => seconds >= segment.start && seconds < segment.end - 0.5) ?? null
  );
}
