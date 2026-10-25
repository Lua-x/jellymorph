/**
 * Arrangement of the interface (phase 14): which entries four lists show and in which order.
 * Every theme has its own default order; a user's own arrangement wins over the administrator's
 * default for everybody, which wins over the theme's, separately for each list. Pure functions
 * only, shared by the settings, the hooks and the themes.
 */

export const LAYOUT_LISTS = ['home', 'nav', 'detailActions', 'facts'] as const;
export type LayoutListId = (typeof LAYOUT_LISTS)[number];

/**
 * Areas of the home page. `latest` stands for one row per library ("New in …"). A theme offers
 * only the areas in its own default order (`LayoutDefaults.home`): `topRated` and `upcoming`
 * came with Onyx (phase 16) and stay out of the other themes.
 */
export const HOME_AREAS = [
  'hero',
  'libraries',
  'resume',
  'nextUp',
  'latest',
  'favorites',
  'collections',
  'genres',
  'topRated',
  'upcoming',
] as const;
export type HomeAreaKind = (typeof HOME_AREAS)[number];

/** Buttons of a detail page. `play` covers play, resume and start over. */
export const DETAIL_ACTIONS = ['play', 'trailer', 'favorite', 'played', 'edit'] as const;
export type DetailActionId = (typeof DETAIL_ACTIONS)[number];

/** Facts a detail page can show about a title. */
export const FACTS = [
  'year',
  'runtime',
  'officialRating',
  'communityRating',
  'videoQuality',
  'genres',
  'tagline',
  'directors',
  'cast',
  'audio',
  'subtitles',
  'studios',
] as const;
export type FactId = (typeof FACTS)[number];

/** A theme's own arrangement, used until a user or the administrator sets one. */
export interface LayoutDefaults {
  home: readonly HomeAreaKind[];
  detailActions: readonly DetailActionId[];
  /** The facts the theme shows, in its order (facts it never shows are left out). */
  facts: readonly FactId[];
}

/** One list as saved: an own order (null = the default order) and the hidden entries. */
export interface ListLayout {
  order: string[] | null;
  hidden: string[];
}

export type Layout = Partial<Record<LayoutListId, ListLayout>>;

export interface LayoutEntry {
  id: string;
  hidden: boolean;
}

/** Entries that keep their place: the hero opens the home page in every theme. */
const PINNED: ReadonlySet<string> = new Set(['hero']);
/** Entries that cannot be hidden: a detail page without "Play" would be a dead end. */
const ALWAYS_SHOWN: ReadonlySet<string> = new Set(['play']);

export function isPinned(id: string): boolean {
  return PINNED.has(id);
}

export function canHide(id: string): boolean {
  return !ALWAYS_SHOWN.has(id);
}

/**
 * The saved order applied to the entries that exist now. Entries the saved order does not know
 * (a library added later) keep their place behind the entry that precedes them by default.
 */
export function mergeOrder(defaults: readonly string[], saved: readonly string[] | null): string[] {
  const available = new Set(defaults);
  const result = (saved ?? defaults).filter(
    (id, index, list) => available.has(id) && list.indexOf(id) === index,
  );
  defaults.forEach((id, index) => {
    if (result.includes(id)) return;
    const before = defaults
      .slice(0, index)
      .reverse()
      .find((candidate) => result.includes(candidate));
    result.splice(before === undefined ? 0 : result.indexOf(before) + 1, 0, id);
  });
  const pinned = result.filter((id) => PINNED.has(id));
  return [...pinned, ...result.filter((id) => !PINNED.has(id))];
}

/** All entries in their order, with their visibility. */
export function arrange(
  defaults: readonly string[],
  layout: ListLayout | undefined,
): LayoutEntry[] {
  const hidden = new Set(layout?.hidden ?? []);
  return mergeOrder(defaults, layout?.order ?? null).map((id) => ({
    id,
    hidden: hidden.has(id) && canHide(id),
  }));
}

/** Only what is shown, in order. */
export function visibleIds(defaults: readonly string[], layout: ListLayout | undefined): string[] {
  return arrange(defaults, layout)
    .filter((entry) => !entry.hidden)
    .map((entry) => entry.id);
}

/** The arrangement in force for each list: the user's own, else the default for everybody. */
export function effectiveLayout(own: Layout, everybody: Layout): Layout {
  const result: Layout = {};
  for (const list of LAYOUT_LISTS) {
    const layout = own[list] ?? everybody[list];
    if (layout) result[list] = layout;
  }
  return result;
}

/** A list after moving the entry at `from` to `to` (both indexes in `entries`). */
export function moveEntry(entries: readonly LayoutEntry[], from: number, to: number): ListLayout {
  const order = entries.map((entry) => entry.id);
  const [moved] = order.splice(from, 1);
  if (moved !== undefined && !PINNED.has(moved)) {
    const target = Math.max(order.filter((id) => PINNED.has(id)).length, to);
    order.splice(Math.min(target, order.length), 0, moved);
  } else if (moved !== undefined) {
    order.splice(from, 0, moved);
  }
  return {
    order,
    hidden: entries.filter((entry) => entry.hidden).map((entry) => entry.id),
  };
}

/** A list after showing or hiding one entry; the order stays as it was (null stays null). */
export function setEntryHidden(
  current: ListLayout | undefined,
  id: string,
  hidden: boolean,
): ListLayout {
  const others = (current?.hidden ?? []).filter((entry) => entry !== id);
  return {
    order: current?.order ?? null,
    hidden: hidden && canHide(id) ? [...others, id] : others,
  };
}

const MAX_ENTRIES = 200;
const MAX_ID_LENGTH = 100;

function idList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter(
      (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH,
    )
    .slice(0, MAX_ENTRIES);
}

/** The valid parts of a stored arrangement; anything else is dropped, never applied. */
export function parseLayout(raw: unknown): Layout {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: Layout = {};
  for (const list of LAYOUT_LISTS) {
    const value = (raw as Record<string, unknown>)[list];
    if (typeof value !== 'object' || value === null) continue;
    const record = value as Record<string, unknown>;
    result[list] = {
      order: record.order === null ? null : idList(record.order),
      hidden: idList(record.hidden) ?? [],
    };
  }
  return result;
}

/** From the JSON text kept in DisplayPreferences; broken text counts as "nothing set". */
export function layoutFromJson(text: string | null | undefined): Layout {
  if (!text) return {};
  try {
    return parseLayout(JSON.parse(text));
  } catch {
    return {};
  }
}

export function layoutToJson(layout: Layout): string {
  return JSON.stringify(layout);
}
