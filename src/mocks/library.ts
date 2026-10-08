/**
 * Query engine of the mock server: turns catalog entries into Jellyfin DTOs and answers item
 * queries (filters, sorting, paging) the way the real /Items endpoints do.
 */
import { blurHashFor } from './artwork';
import {
  allItems,
  CLIP_TICKS,
  collections,
  episodes,
  GENRE_IDS,
  GENRES,
  itemsById,
  people,
  seasons,
  seedUserData,
  series,
  type MockImageType,
  type MockItem,
  type SeedUserData,
} from './catalog';
import { DEMO_SERVER } from './fixtures';
import { chaptersDto, isPlayableItem, mediaStreamsDto, trickplayDto } from './playback';

const blurHashes = new Map<string, string>();
function hashFor(item: MockItem, type: MockImageType): string {
  const key = `${item.id}:${type}`;
  let hash = blurHashes.get(key);
  if (!hash) {
    hash = blurHashFor(item, type);
    blurHashes.set(key, hash);
  }
  return hash;
}

const STORAGE_KEY = 'jellymorph.demo.userData';
type StoredChanges = Record<string, Record<string, SeedUserData>>;

/**
 * Per-user watch state on top of the shared seed. In demo mode the user's changes are kept in
 * browser storage, so favorites and progress survive a reload like on a real server.
 */
export class UserLibrary {
  private readonly data = new Map<string, Map<string, SeedUserData>>();
  private readonly changes: StoredChanges;

  constructor(private readonly storage: Storage | null = null) {
    this.changes = this.load();
  }

  private load(): StoredChanges {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? (parsed as StoredChanges) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.changes));
    } catch {
      // Demo persistence is best effort.
    }
  }

  forUser(userId: string): Map<string, SeedUserData> {
    let data = this.data.get(userId);
    if (!data) {
      data = seedUserData();
      for (const [itemId, value] of Object.entries(this.changes[userId] ?? {}))
        data.set(itemId, value);
      this.data.set(userId, data);
    }
    return data;
  }

  get(userId: string, itemId: string): SeedUserData {
    return (
      this.forUser(userId).get(itemId) ?? {
        played: false,
        favorite: false,
        positionTicks: 0,
        lastPlayed: null,
      }
    );
  }

  set(userId: string, itemId: string, change: Partial<SeedUserData>): SeedUserData {
    const next = { ...this.get(userId, itemId), ...change };
    this.forUser(userId).set(itemId, next);
    this.changes[userId] = { ...this.changes[userId], [itemId]: next };
    this.save();
    return next;
  }
}

function episodesOf(item: MockItem): MockItem[] {
  if (item.type === 'Series') return episodes.filter((episode) => episode.seriesId === item.id);
  if (item.type === 'Season') return episodes.filter((episode) => episode.seasonId === item.id);
  return [];
}

function isPlayed(library: UserLibrary, userId: string, item: MockItem): boolean {
  const children = episodesOf(item);
  if (children.length > 0)
    return children.every((episode) => library.get(userId, episode.id).played);
  return library.get(userId, item.id).played;
}

export function userDataDto(library: UserLibrary, userId: string, item: MockItem) {
  const data = library.get(userId, item.id);
  const children = episodesOf(item);
  const unplayed = children.filter((episode) => !library.get(userId, episode.id).played).length;
  // Saved positions refer to the demo clip every title plays.
  const runtime = CLIP_TICKS;
  return {
    Key: item.id,
    ItemId: item.id,
    Played: isPlayed(library, userId, item),
    IsFavorite: data.favorite,
    PlaybackPositionTicks: data.positionTicks,
    PlayedPercentage:
      runtime > 0 && data.positionTicks > 0 ? (data.positionTicks / runtime) * 100 : null,
    PlayCount: data.played ? 1 : 0,
    LastPlayedDate: data.lastPlayed,
    UnplayedItemCount: children.length > 0 ? unplayed : null,
  };
}

function imageTags(item: MockItem): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const type of item.images)
    if (type !== 'Backdrop') tags[type] = `${item.id.slice(0, 8)}${type}`;
  return tags;
}

function backdropTags(item: MockItem): string[] {
  return item.images.includes('Backdrop') ? [`${item.id.slice(0, 8)}Backdrop`] : [];
}

function blurHashMap(item: MockItem, owner: MockItem | undefined, types: MockImageType[]) {
  const result: Record<string, Record<string, string>> = {};
  for (const source of [item, owner]) {
    if (!source) continue;
    for (const type of types) {
      if (!source.images.includes(type)) continue;
      const tag = `${source.id.slice(0, 8)}${type}`;
      result[type] = { ...result[type], [tag]: hashFor(source, type) };
    }
  }
  return result;
}

const SERVER = { ServerId: DEMO_SERVER.Id };

/** Full DTO of a catalog item for one user, including parent images for episodes. */
export function itemDto(library: UserLibrary, userId: string, item: MockItem) {
  const show = item.seriesId ? itemsById.get(item.seriesId) : undefined;
  const season = item.seasonId ? itemsById.get(item.seasonId) : undefined;
  const parentImages =
    show && item.type !== 'Series'
      ? {
          ParentBackdropItemId: show.id,
          ParentBackdropImageTags: backdropTags(show),
          ParentLogoItemId: show.images.includes('Logo') ? show.id : undefined,
          ParentLogoImageTag: show.images.includes('Logo')
            ? `${show.id.slice(0, 8)}Logo`
            : undefined,
          ParentThumbItemId: show.images.includes('Thumb') ? show.id : undefined,
          ParentThumbImageTag: show.images.includes('Thumb')
            ? `${show.id.slice(0, 8)}Thumb`
            : undefined,
          SeriesPrimaryImageTag: `${show.id.slice(0, 8)}Primary`,
        }
      : {};
  const isFolder = item.type === 'Series' || item.type === 'Season' || item.type === 'BoxSet';
  const childCount =
    item.type === 'Series'
      ? seasons.filter((candidate) => candidate.seriesId === item.id).length
      : item.type === 'Season'
        ? episodesOf(item).length
        : item.type === 'BoxSet'
          ? item.memberIds.length
          : undefined;
  return {
    ...SERVER,
    Id: item.id,
    Name: item.name,
    SortName: item.sortName,
    Type: item.type,
    IsFolder: isFolder,
    ParentId: item.parentId,
    SeriesId: item.seriesId ?? undefined,
    SeriesName: show?.name,
    SeasonId: item.seasonId ?? undefined,
    SeasonName: season?.name,
    IndexNumber: item.indexNumber ?? undefined,
    ParentIndexNumber: item.parentIndexNumber ?? undefined,
    ProductionYear: item.year ?? undefined,
    PremiereDate: item.premiereDate ?? undefined,
    EndDate: item.endDate ?? undefined,
    Status: item.status ?? undefined,
    RunTimeTicks: item.runtimeTicks ?? undefined,
    OfficialRating: item.officialRating ?? undefined,
    CommunityRating: item.communityRating ?? undefined,
    CriticRating: item.criticRating ?? undefined,
    Genres: item.genres,
    GenreItems: item.genres.map((genre) => ({ Name: genre, Id: GENRE_IDS.get(genre) })),
    Overview: item.overview ?? undefined,
    Taglines: item.tagline ? [item.tagline] : [],
    DateCreated: item.dateCreated,
    ChildCount: childCount,
    LocalTrailerCount: item.localTrailerCount,
    PrimaryImageAspectRatio:
      item.type === 'Episode' ? 16 / 9 : item.type === 'Person' ? 2 / 3 : 2 / 3,
    ImageTags: imageTags(item),
    BackdropImageTags: backdropTags(item),
    ImageBlurHashes: blurHashMap(item, show, ['Primary', 'Backdrop', 'Thumb', 'Logo']),
    ...parentImages,
    UserData: userDataDto(library, userId, item),
    People: item.people.map((ref) => {
      const person = itemsById.get(ref.personId);
      return {
        Id: ref.personId,
        Name: person?.name,
        Role: ref.role,
        Type: ref.type,
        PrimaryImageTag: person?.images.includes('Primary')
          ? `${ref.personId.slice(0, 8)}Primary`
          : undefined,
        ImageBlurHashes: person?.images.includes('Primary')
          ? { Primary: { [`${ref.personId.slice(0, 8)}Primary`]: hashFor(person, 'Primary') } }
          : undefined,
      };
    }),
    Studios: item.studios.map((name) => ({ Name: name })),
    MediaStreams: mediaStreamsDto(item),
    ...(isPlayableItem(item)
      ? {
          MediaType: 'Video',
          LocationType: 'FileSystem',
          Container: item.container,
          MediaSources: [
            {
              Id: item.id,
              Protocol: 'File',
              Type: 'Default',
              Container: item.container,
              Name: item.name,
              RunTimeTicks: CLIP_TICKS,
              MediaStreams: mediaStreamsDto(item),
            },
          ],
          Chapters: chaptersDto(),
          Trickplay: trickplayDto(item),
        }
      : {}),
  };
}

export interface ItemQuery {
  parentId?: string | null;
  includeItemTypes?: string[];
  recursive?: boolean;
  genreIds?: string[];
  genres?: string[];
  years?: number[];
  personIds?: string[];
  ids?: string[];
  isPlayed?: boolean;
  isFavorite?: boolean;
  searchTerm?: string;
  nameLessThan?: string;
  imageTypes?: string[];
  hasOverview?: boolean;
  sortBy?: string[];
  sortOrder?: string[];
  startIndex?: number;
  limit?: number;
}

/** Reads the query string the SDK produces (arrays as repeated params or comma lists). */
export function parseItemQuery(url: URL): ItemQuery {
  const params = url.searchParams;
  const list = (name: string): string[] | undefined => {
    const values = params.getAll(name).flatMap((value) => value.split(','));
    return values.length > 0 ? values.filter(Boolean) : undefined;
  };
  const flag = (name: string) => (params.has(name) ? params.get(name) === 'true' : undefined);
  const number = (name: string) => (params.has(name) ? Number(params.get(name)) : undefined);
  return {
    parentId: params.get('parentId') ?? params.get('ParentId'),
    includeItemTypes: list('includeItemTypes'),
    recursive: flag('recursive'),
    genreIds: list('genreIds'),
    genres: list('genres')?.flatMap((value) => value.split('|')),
    years: list('years')?.map(Number),
    personIds: list('personIds'),
    ids: list('ids'),
    isPlayed: flag('isPlayed'),
    isFavorite: flag('isFavorite'),
    searchTerm: params.get('searchTerm') ?? undefined,
    nameLessThan: params.get('nameLessThan') ?? undefined,
    imageTypes: list('imageTypes'),
    hasOverview: flag('hasOverview'),
    sortBy: list('sortBy'),
    sortOrder: list('sortOrder'),
    startIndex: number('startIndex'),
    limit: number('limit'),
  };
}

function scope(query: ItemQuery): MockItem[] {
  const parent = query.parentId ? itemsById.get(query.parentId) : undefined;
  if (parent?.type === 'BoxSet') {
    return parent.memberIds
      .map((id) => itemsById.get(id))
      .filter((item): item is MockItem => item !== undefined);
  }
  if (parent?.type === 'Series') return seasons.filter((season) => season.seriesId === parent.id);
  if (parent?.type === 'Season') return episodesOf(parent);
  const candidates = allItems.filter((item) => item.type !== 'Person');
  if (!query.parentId) return candidates;
  return candidates.filter((item) =>
    query.recursive ? item.libraryId === query.parentId : item.parentId === query.parentId,
  );
}

function compare(a: MockItem, b: MockItem, field: string, random: Map<string, number>): number {
  switch (field) {
    case 'SortName':
    case 'Name':
      return a.sortName.localeCompare(b.sortName);
    case 'DateCreated':
      return a.dateCreated.localeCompare(b.dateCreated);
    case 'ProductionYear':
      return (a.year ?? 0) - (b.year ?? 0);
    case 'PremiereDate':
      return (a.premiereDate ?? '').localeCompare(b.premiereDate ?? '');
    case 'CommunityRating':
      return (a.communityRating ?? 0) - (b.communityRating ?? 0);
    case 'Random':
      return (random.get(a.id) ?? 0) - (random.get(b.id) ?? 0);
    default:
      return 0;
  }
}

export function queryItems(library: UserLibrary, userId: string, query: ItemQuery) {
  let items = scope(query);
  const types = query.includeItemTypes;
  if (types) items = items.filter((item) => types.includes(item.type));
  if (query.ids) items = items.filter((item) => query.ids?.includes(item.id));
  if (query.genreIds) {
    const names = GENRES.filter((genre) => query.genreIds?.includes(GENRE_IDS.get(genre) ?? ''));
    items = items.filter((item) =>
      item.genres.some((genre) => (names as string[]).includes(genre)),
    );
  }
  if (query.genres)
    items = items.filter((item) => item.genres.some((genre) => query.genres?.includes(genre)));
  if (query.years)
    items = items.filter((item) => item.year !== null && query.years?.includes(item.year));
  if (query.personIds) {
    items = items.filter((item) =>
      item.people.some((ref) => query.personIds?.includes(ref.personId)),
    );
  }
  if (query.isPlayed !== undefined) {
    items = items.filter((item) => isPlayed(library, userId, item) === query.isPlayed);
  }
  if (query.isFavorite !== undefined) {
    items = items.filter((item) => library.get(userId, item.id).favorite === query.isFavorite);
  }
  if (query.searchTerm) {
    const term = query.searchTerm.toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(term));
  }
  if (query.nameLessThan) {
    const bound = query.nameLessThan.toLowerCase();
    items = items.filter((item) => item.sortName < bound);
  }
  if (query.imageTypes) {
    items = items.filter((item) =>
      query.imageTypes?.every((type) => item.images.includes(type as MockImageType)),
    );
  }
  if (query.hasOverview) items = items.filter((item) => Boolean(item.overview));

  const sortBy = query.sortBy ?? ['SortName'];
  const descending = query.sortOrder?.[0] === 'Descending';
  const random = new Map(items.map((item) => [item.id, Math.random()]));
  items = [...items].sort((a, b) => {
    for (const field of sortBy) {
      const result = compare(a, b, field, random);
      if (result !== 0) return descending ? -result : result;
    }
    return 0;
  });

  const total = items.length;
  const start = query.startIndex ?? 0;
  const page =
    query.limit === undefined ? items.slice(start) : items.slice(start, start + query.limit);
  return {
    Items: page.map((item) => itemDto(library, userId, item)),
    TotalRecordCount: total,
    StartIndex: start,
  };
}

export function resumeItems(library: UserLibrary, userId: string) {
  return allItems
    .filter((item) => item.type === 'Movie' || item.type === 'Episode')
    .map((item) => ({ item, data: library.get(userId, item.id) }))
    .filter(({ data }) => data.positionTicks > 0 && !data.played)
    .sort((a, b) => (b.data.lastPlayed ?? '').localeCompare(a.data.lastPlayed ?? ''))
    .map(({ item }) => itemDto(library, userId, item));
}

function ordered(list: MockItem[]): MockItem[] {
  return [...list].sort(
    (a, b) =>
      (a.parentIndexNumber ?? 0) - (b.parentIndexNumber ?? 0) ||
      (a.indexNumber ?? 0) - (b.indexNumber ?? 0),
  );
}

/** All episodes of a series in viewing order. */
export function seriesEpisodes(seriesId: string): MockItem[] {
  return ordered(episodes.filter((episode) => episode.seriesId === seriesId));
}

export function nextUp(
  library: UserLibrary,
  userId: string,
  seriesId?: string,
  includeResumable = true,
) {
  const result: { item: MockItem; lastPlayed: string }[] = [];
  for (const show of series) {
    if (seriesId && show.id !== seriesId) continue;
    const list = ordered(episodesOf(show));
    let lastIndex = -1;
    let lastPlayed = '';
    list.forEach((episode, index) => {
      const data = library.get(userId, episode.id);
      if (data.played) {
        lastIndex = index;
        lastPlayed = data.lastPlayed ?? lastPlayed;
      }
    });
    if (lastIndex < 0) continue;
    const next = list
      .slice(lastIndex + 1)
      .find((episode) => !library.get(userId, episode.id).played);
    if (!next) continue;
    if (!includeResumable && library.get(userId, next.id).positionTicks > 0) continue;
    result.push({ item: next, lastPlayed });
  }
  return result
    .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))
    .map(({ item }) => itemDto(library, userId, item));
}

export function latestItems(library: UserLibrary, userId: string, parentId: string, limit: number) {
  const inLibrary = allItems.filter((item) => item.libraryId === parentId);
  const movies = inLibrary.filter((item) => item.type === 'Movie' || item.type === 'BoxSet');
  const shows = inLibrary.filter((item) => item.type === 'Series');
  const latestOfShow = (show: MockItem) =>
    episodesOf(show).reduce(
      (latest, episode) => (episode.dateCreated > latest ? episode.dateCreated : latest),
      show.dateCreated,
    );
  const candidates = [
    ...movies.map((item) => ({ item, date: item.dateCreated })),
    ...shows.map((item) => ({ item, date: latestOfShow(item) })),
  ];
  return candidates
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(({ item }) => itemDto(library, userId, item));
}

export function similarItems(library: UserLibrary, userId: string, itemId: string, limit: number) {
  const item = itemsById.get(itemId);
  if (!item) return [];
  return allItems
    .filter((candidate) => candidate.type === item.type && candidate.id !== item.id)
    .map((candidate) => ({
      candidate,
      score: candidate.genres.filter((genre) => item.genres.includes(genre)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.sortName.localeCompare(b.candidate.sortName))
    .slice(0, limit)
    .map(({ candidate }) => itemDto(library, userId, candidate));
}

export function genreItems(includeTypes: string[] | undefined) {
  const relevant = allItems.filter((item) => !includeTypes || includeTypes.includes(item.type));
  return GENRES.filter((genre) => relevant.some((item) => item.genres.includes(genre))).map(
    (genre) => ({
      ...SERVER,
      Id: GENRE_IDS.get(genre),
      Name: genre,
      Type: 'Genre',
      ImageTags: {},
    }),
  );
}

export function filterOptions(parentId: string | null, includeTypes: string[] | undefined) {
  const relevant = allItems.filter(
    (item) =>
      item.type !== 'Person' &&
      (!parentId || item.libraryId === parentId) &&
      (!includeTypes || includeTypes.includes(item.type)),
  );
  return {
    Genres: [...new Set(relevant.flatMap((item) => item.genres))],
    Years: [
      ...new Set(relevant.map((item) => item.year).filter((year): year is number => year !== null)),
    ],
    Tags: [],
    OfficialRatings: [...new Set(relevant.map((item) => item.officialRating).filter(Boolean))],
  };
}

export function searchPeople(library: UserLibrary, userId: string, term: string, limit: number) {
  const lower = term.toLowerCase();
  return people
    .filter((person) => person.name.toLowerCase().includes(lower))
    .slice(0, limit)
    .map((person) => itemDto(library, userId, person));
}

/** Marks an item (and for series/seasons/collections all their episodes or members). */
export function markPlayed(library: UserLibrary, userId: string, item: MockItem, played: boolean) {
  const targets =
    item.type === 'Series' || item.type === 'Season'
      ? episodesOf(item)
      : item.type === 'BoxSet'
        ? item.memberIds
            .map((id) => itemsById.get(id))
            .filter((member): member is MockItem => member !== undefined)
        : [item];
  const now = new Date().toISOString();
  for (const target of targets) {
    library.set(userId, target.id, { played, positionTicks: 0, lastPlayed: played ? now : null });
  }
  if (targets[0] !== item) library.set(userId, item.id, { played });
  return userDataDto(library, userId, item);
}

export { collections };
