/**
 * Timeline of the demo clip. Shared by the recording script (scripts/record-demo-clip.ts) and the
 * mock server, so chapters, media segments and trickplay thumbnails match what the clip shows.
 * Every title in demo mode plays this clip.
 */
export const CLIP_SECONDS = 60;

export const CLIP_PARTS = [
  { kind: 'opening', start: 0, end: 3, label: '' },
  { kind: 'intro', start: 3, end: 15, label: 'INTRO' },
  { kind: 'part', start: 15, end: 32, label: '1' },
  { kind: 'part', start: 32, end: 48, label: '2' },
  { kind: 'outro', start: 48, end: 60, label: 'OUTRO' },
] as const;

export type ClipPart = (typeof CLIP_PARTS)[number];

export function partAt(seconds: number): ClipPart {
  return CLIP_PARTS.find((part) => seconds >= part.start && seconds < part.end) ?? CLIP_PARTS[4];
}

/** Background hue of the clip at a time; trickplay thumbnails use the same colors. */
export function hueAt(seconds: number): number {
  return Math.round(228 + 34 * Math.sin((seconds / CLIP_SECONDS) * Math.PI * 2));
}

/** "00:23" */
export function clipTimecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
