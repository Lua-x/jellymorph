/**
 * The featured titles of the day (1.4.1): positions in a stable list, the same all day on every
 * device. A new random pick per visit showed artwork Jellyfin had never resized, so it read the
 * originals and woke sleeping disks; with a daily pick that happens at most once a day.
 */

/** The local calendar day, e.g. "2026-10-25". */
export function dayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** FNV-1a: a small, stable hash of the day as the seed. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** mulberry32: numbers in [0, 1), always the same sequence for the same seed. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` different positions below `total` for the day, in the order they were drawn. */
export function dailyPicks(total: number, count: number, day: string): number[] {
  const next = random(hash(day));
  const picks: number[] = [];
  const wanted = Math.min(Math.max(count, 0), Math.max(total, 0));
  while (picks.length < wanted) {
    const index = Math.floor(next() * total);
    if (!picks.includes(index)) picks.push(index);
  }
  return picks;
}
