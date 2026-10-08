/**
 * Invented demo catalog. Every title, name and description is made up; artwork is generated
 * (svg.ts). The catalog is deterministic so tests and screenshots are stable.
 */
import { DEMO_VIEWS } from './fixtures';
import { CLIP_SECONDS } from './media/timeline';

/** Length of the demo clip in ticks; saved positions refer to it (every title plays the clip). */
export const CLIP_TICKS = CLIP_SECONDS * 10_000_000;

export type MockItemType =
  'Movie' | 'Series' | 'Season' | 'Episode' | 'BoxSet' | 'Person' | 'Trailer';
export type MockImageType = 'Primary' | 'Backdrop' | 'Thumb' | 'Logo';

export interface MockPersonRef {
  personId: string;
  type: 'Actor' | 'Director' | 'Writer';
  role: string | null;
}

export interface MockStream {
  type: 'Video' | 'Audio' | 'Subtitle';
  language: string | null;
  codec: string;
  title: string;
  isDefault: boolean;
  width?: number;
  height?: number;
  rangeType?: string;
  profile?: string;
  level?: number;
  channels?: number;
  bitrate?: number;
}

export interface MockItem {
  id: string;
  type: MockItemType;
  name: string;
  sortName: string;
  libraryId: string | null;
  parentId: string | null;
  seriesId: string | null;
  seasonId: string | null;
  indexNumber: number | null;
  parentIndexNumber: number | null;
  year: number | null;
  premiereDate: string | null;
  endDate: string | null;
  status: 'Continuing' | 'Ended' | null;
  runtimeTicks: number | null;
  officialRating: string | null;
  communityRating: number | null;
  criticRating: number | null;
  genres: string[];
  overview: string | null;
  tagline: string | null;
  dateCreated: string;
  hue: number;
  hue2: number;
  images: MockImageType[];
  people: MockPersonRef[];
  studios: string[];
  streams: MockStream[];
  /** File container of a movie or episode. */
  container: 'mkv' | 'mp4';
  memberIds: string[];
  localTrailerCount: number;
}

export const LIBRARY = {
  movies: DEMO_VIEWS[0]?.id ?? '',
  shows: DEMO_VIEWS[1]?.id ?? '',
  anime: DEMO_VIEWS[2]?.id ?? '',
  collections: DEMO_VIEWS[3]?.id ?? '',
} as const;

/** Small deterministic PRNG (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = random(20261007);
/** Separate generator for media details, so the rest of the catalog stays the same. */
const mediaRand = random(4242);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const chance = (probability: number) => rand() < probability;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter.toString(16)}`.padEnd(32, '0');
}

/** Jellyfin sort names are lower case without leading articles. */
export function sortNameOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(der|die|das|the|a|an)\s+/, '')
    .trim();
}

export const GENRES = [
  'Abenteuer',
  'Action',
  'Animation',
  'Dokumentation',
  'Drama',
  'Fantasy',
  'Komödie',
  'Krimi',
  'Mystery',
  'Romantik',
  'Science-Fiction',
  'Thriller',
] as const;

export const GENRE_IDS = new Map<string, string>(
  GENRES.map((genre, index) => [genre, `f${String(index + 1).padStart(31, '0')}`]),
);

const FIRST_NAMES = [
  'Ana',
  'Ben',
  'Carla',
  'David',
  'Elif',
  'Finn',
  'Greta',
  'Hannes',
  'Ida',
  'Jonas',
  'Kaja',
  'Leon',
  'Mara',
  'Noah',
  'Olga',
  'Paul',
  'Rosa',
  'Samir',
  'Tilda',
  'Umut',
  'Vera',
  'Wim',
  'Yara',
  'Zoe',
];
const LAST_NAMES = [
  'Achterberg',
  'Brandt',
  'Corvin',
  'Dahl',
  'Engel',
  'Falk',
  'Grünwald',
  'Hartmann',
  'Imhof',
  'Jansen',
  'Kessler',
  'Lindqvist',
  'Moreau',
  'Novak',
  'Oberle',
  'Petersen',
  'Quast',
  'Reuter',
  'Sommer',
  'Thalberg',
  'Ulrich',
  'Vogt',
  'Weiland',
  'Zeller',
];
const CHARACTERS = [
  'Kommissarin Sander',
  'Dr. Ruben Hall',
  'Mila',
  'Kapitän Ostrow',
  'Lenz',
  'Frau Adler',
  'Teo',
  'Die Archivarin',
  'Max Kogel',
  'Inspektor Varga',
  'Nell',
  'Ivo',
  'Agentin Rhee',
  'Der Fremde',
  'Jule',
  'Professor Amsel',
];
const STUDIOS = [
  'Nordlicht Film',
  'Kranich Pictures',
  'Studio Halbmond',
  'Bernstein Media',
  'Atelier Sieben',
];

export const people: MockItem[] = [];

function baseItem(type: MockItemType, name: string, prefix: string): MockItem {
  return {
    id: nextId(prefix),
    type,
    name,
    sortName: sortNameOf(name),
    libraryId: null,
    parentId: null,
    seriesId: null,
    seasonId: null,
    indexNumber: null,
    parentIndexNumber: null,
    year: null,
    premiereDate: null,
    endDate: null,
    status: null,
    runtimeTicks: null,
    officialRating: null,
    communityRating: null,
    criticRating: null,
    genres: [],
    overview: null,
    tagline: null,
    dateCreated: '2026-01-01T12:00:00.000Z',
    hue: between(0, 359),
    hue2: between(0, 359),
    images: ['Primary'],
    people: [],
    studios: [],
    streams: [],
    container: 'mkv',
    memberIds: [],
    localTrailerCount: 0,
  };
}

for (let index = 0; index < 32; index += 1) {
  // The offset after each full round of first names keeps every combination unique.
  const last = (index * 7 + Math.floor(index / FIRST_NAMES.length) * 5) % LAST_NAMES.length;
  const name = `${FIRST_NAMES[index % FIRST_NAMES.length] ?? ''} ${LAST_NAMES[last] ?? ''}`;
  const person = baseItem('Person', name, 'c');
  if (!chance(0.65)) person.images = [];
  people.push(person);
}

function castFor(count: number): MockPersonRef[] {
  const chosen = new Set<MockItem>();
  while (chosen.size < count) chosen.add(pick(people));
  const [director, ...actors] = [...chosen];
  return [
    ...actors.map((person) => ({
      personId: person.id,
      type: 'Actor' as const,
      role: pick(CHARACTERS),
    })),
    ...(director ? [{ personId: director.id, type: 'Director' as const, role: null }] : []),
  ];
}

/**
 * Streams as Jellyfin would probe them. 1080p titles are H.264 with AAC (direct play in most
 * browsers), 4K titles HEVC with E-AC3 (usually transcoded). Anime has styled ASS subtitles.
 */
function streamsFor(anime = false): MockStream[] {
  const fourK = chance(0.3);
  const streams: MockStream[] = [
    {
      type: 'Video',
      language: null,
      codec: fourK ? 'hevc' : 'h264',
      title: fourK ? '4K HEVC' : '1080p H264',
      isDefault: true,
      width: fourK ? 3840 : 1920,
      height: fourK ? 2160 : 1080,
      rangeType: fourK && chance(0.6) ? 'HDR10' : 'SDR',
      profile: fourK ? 'Main 10' : 'High',
      level: fourK ? 153 : 41,
      bitrate: fourK ? 42_000_000 : 9_000_000,
    },
    {
      type: 'Audio',
      language: 'ger',
      codec: fourK ? 'eac3' : 'aac',
      title: fourK ? 'Deutsch - E-AC3 5.1' : 'Deutsch - AAC 5.1',
      isDefault: true,
      channels: 6,
      bitrate: 640_000,
    },
    {
      type: 'Audio',
      language: anime ? 'jpn' : 'eng',
      codec: 'aac',
      title: anime ? '日本語 - AAC Stereo' : 'English - AAC Stereo',
      isDefault: false,
      channels: 2,
      bitrate: 192_000,
    },
    {
      type: 'Subtitle',
      language: 'ger',
      codec: 'subrip',
      title: 'Deutsch - SRT',
      isDefault: false,
    },
    {
      type: 'Subtitle',
      language: 'eng',
      codec: 'subrip',
      title: 'English - SRT',
      isDefault: false,
    },
  ];
  if (chance(0.3)) {
    streams.push({
      type: 'Subtitle',
      language: 'ger',
      codec: 'PGSSUB',
      title: 'Deutsch - PGS',
      isDefault: false,
    });
  }
  if (anime) {
    streams.push({
      type: 'Subtitle',
      language: 'ger',
      codec: 'ass',
      title: 'Deutsch - ASS (gestaltet)',
      isDefault: true,
    });
  }
  return streams;
}

function containerFor(): 'mkv' | 'mp4' {
  return mediaRand() < 0.35 ? 'mp4' : 'mkv';
}

const RATINGS = ['FSK-0', 'FSK-6', 'FSK-12', 'FSK-12', 'FSK-16', 'FSK-16', 'FSK-18'];

const OVERVIEW_OPENINGS = [
  'Als ein rätselhaftes Signal die Küstenstadt erreicht,',
  'Nach zwanzig Jahren kehrt sie in ihr Heimatdorf zurück –',
  'Eine einzige Nacht verändert alles:',
  'Zwischen Eis und Funkstille',
  'Mitten im Herbststurm',
  'In einer Stadt, die niemals schläft,',
  'Ein vergessenes Archiv birgt ein Geheimnis:',
  'Auf der letzten Fahrt des Nachtzugs',
];
const OVERVIEW_MIDDLES = [
  'muss eine Kartographin entscheiden, wem sie noch trauen kann',
  'geraten zwei ungleiche Geschwister zwischen alle Fronten',
  'beginnt eine junge Ermittlerin Fragen zu stellen, die niemand hören will',
  'stößt ein Uhrmacher auf einen Plan, der die Zeit selbst bedroht',
  'kämpft eine kleine Crew ums Überleben',
  'findet ein Junge einen Freund, den es eigentlich nicht geben dürfte',
];
const OVERVIEW_ENDINGS = [
  ' – und merkt zu spät, dass sie längst Teil des Spiels ist.',
  '. Ein Wettlauf gegen die Zeit beginnt.',
  ', bevor der Morgen dämmert.',
  '. Nichts ist, wie es scheint.',
  ' – mit Folgen, die bis heute nachhallen.',
];
const TAGLINES = [
  'Manche Türen sollten verschlossen bleiben.',
  'Die Wahrheit liegt unter der Oberfläche.',
  'Jede Spur führt zurück.',
  'Bis zum letzten Signal.',
  'Nur wer loslässt, kommt an.',
];

function overview(): string {
  return `${pick(OVERVIEW_OPENINGS)} ${pick(OVERVIEW_MIDDLES)}${pick(OVERVIEW_ENDINGS)}`;
}

function dateIn(year: number): string {
  return new Date(Date.UTC(year, between(0, 11), between(1, 28))).toISOString();
}

function genresFor(count: number): string[] {
  const chosen = new Set<string>();
  while (chosen.size < count) chosen.add(pick(GENRES));
  return [...chosen];
}

const MOVIE_TITLES = [
  'Abendzug',
  'Das Archiv',
  'Brückenlicht',
  'Die Erfinderin',
  'Echotal',
  'Eisvogel',
  'Fernlicht',
  'Ferne Ufer',
  'Feuerwache 12',
  'Fabrik 9',
  'Gegenwind',
  'Glutnester',
  'Grenzgänger',
  'Hafenkinder',
  'Halbschatten',
  'Herbstmanöver',
  'Die Insel der Uhren',
  'Kaltfront',
  'Die Kartographin',
  'Kometenjahr',
  'Kopfüber',
  'Kranichzug',
  'Kupferherz',
  'Das Labyrinth unter der Stadt',
  'Lautlose Straßen',
  'Der Leuchtturmwärter',
  'Die letzte Fähre',
  'Mitternachtsgarten',
  'Mondscheinbahn',
  'Morgenrot',
  'Nebelstadt',
  'Nebelstadt 2',
  'Neonregen',
  'Nordgrat',
  'Orbit',
  'Orbit: Rückkehr',
  'Polarnacht',
  'Die Prüfung',
  'Rotes Rauschen',
  'Salzwiesen',
  'Sandsturm',
  'Die Sammlerin',
  'Seidenfaden',
  'Signal 47',
  'Silberne Stunde',
  'Spiegelbild',
  'Sternenstaub',
  'Stille Wasser',
  'Tiefblau',
  'Der Uhrmacher',
  'Unter dem Eis',
  'Die vierte Wand',
  'Westwärts',
  'Wolkenläufer',
  'Wüstenwind',
  'Zeitsprung',
];

const BASE_DATE = Date.UTC(2026, 8, 30);

export const movies: MockItem[] = MOVIE_TITLES.map((title, index) => {
  const movie = baseItem('Movie', title, 'a');
  const year = between(1978, 2025);
  Object.assign(movie, {
    libraryId: LIBRARY.movies,
    parentId: LIBRARY.movies,
    year,
    premiereDate: dateIn(year),
    runtimeTicks: between(84, 168) * 600_000_000,
    officialRating: pick(RATINGS),
    communityRating: Math.round((5 + rand() * 4.3) * 10) / 10,
    criticRating: between(38, 98),
    genres: genresFor(between(1, 3)),
    overview: overview(),
    tagline: chance(0.6) ? pick(TAGLINES) : null,
    dateCreated: new Date(BASE_DATE - index * 2.5 * 86_400_000).toISOString(),
    images: ['Primary', 'Backdrop', 'Thumb', ...(chance(0.7) ? (['Logo'] as const) : [])],
    people: castFor(between(4, 7)),
    studios: [pick(STUDIOS)],
    streams: streamsFor(),
    container: containerFor(),
    localTrailerCount: chance(0.4) ? 1 : 0,
  });
  return movie;
});

interface SeriesPlan {
  title: string;
  library: string;
  seasons: number[];
  status: 'Continuing' | 'Ended';
  genres: string[];
}

const SERIES_PLANS: SeriesPlan[] = [
  {
    title: 'Hafenviertel',
    library: LIBRARY.shows,
    seasons: [8, 8, 6],
    status: 'Continuing',
    genres: ['Krimi', 'Drama'],
  },
  {
    title: 'Die Akte Lindholm',
    library: LIBRARY.shows,
    seasons: [6, 6],
    status: 'Ended',
    genres: ['Mystery', 'Thriller'],
  },
  {
    title: 'Nachtschicht',
    library: LIBRARY.shows,
    seasons: [10],
    status: 'Continuing',
    genres: ['Drama'],
  },
  {
    title: 'Grüne Grenze',
    library: LIBRARY.shows,
    seasons: [6, 6, 6],
    status: 'Ended',
    genres: ['Drama', 'Abenteuer'],
  },
  {
    title: 'Kanzlei Berg & Söhne',
    library: LIBRARY.shows,
    seasons: [8, 8],
    status: 'Continuing',
    genres: ['Komödie'],
  },
  {
    title: 'Sternwarte',
    library: LIBRARY.shows,
    seasons: [6],
    status: 'Continuing',
    genres: ['Science-Fiction', 'Mystery'],
  },
  {
    title: 'Almhütte 7',
    library: LIBRARY.shows,
    seasons: [8, 8, 8, 8],
    status: 'Ended',
    genres: ['Komödie', 'Romantik'],
  },
  {
    title: 'Code Atlas',
    library: LIBRARY.shows,
    seasons: [8],
    status: 'Continuing',
    genres: ['Thriller', 'Action'],
  },
  {
    title: 'Familie Kranich',
    library: LIBRARY.shows,
    seasons: [6, 6],
    status: 'Ended',
    genres: ['Komödie', 'Drama'],
  },
  {
    title: 'Tiefsee',
    library: LIBRARY.shows,
    seasons: [6],
    status: 'Continuing',
    genres: ['Dokumentation'],
  },
  {
    title: 'Kaze no Tobira',
    library: LIBRARY.anime,
    seasons: [12, 12],
    status: 'Continuing',
    genres: ['Animation', 'Fantasy'],
  },
  {
    title: 'Hoshizora Academy',
    library: LIBRARY.anime,
    seasons: [12],
    status: 'Ended',
    genres: ['Animation', 'Komödie'],
  },
  {
    title: 'Mecha Unit Tsubame',
    library: LIBRARY.anime,
    seasons: [12, 12, 12],
    status: 'Ended',
    genres: ['Animation', 'Science-Fiction', 'Action'],
  },
  {
    title: 'Yoru no Sakana',
    library: LIBRARY.anime,
    seasons: [10],
    status: 'Continuing',
    genres: ['Animation', 'Drama'],
  },
];

const EPISODE_TITLES = [
  'Der Anfang',
  'Spuren im Schnee',
  'Funkstille',
  'Das zweite Gesicht',
  'Unter Verdacht',
  'Ebbe',
  'Die Abmachung',
  'Grenzwerte',
  'Neue Allianzen',
  'Rauch',
  'Der Tausch',
  'Heimweg',
  'Gegenlicht',
  'Die Warnung',
  'Kettenreaktion',
  'Stille Post',
  'Alte Rechnungen',
  'Das Finale',
];

export const series: MockItem[] = [];
export const seasons: MockItem[] = [];
export const episodes: MockItem[] = [];

SERIES_PLANS.forEach((plan, planIndex) => {
  const show = baseItem('Series', plan.title, 'b');
  const startYear = between(2008, 2022);
  Object.assign(show, {
    libraryId: plan.library,
    parentId: plan.library,
    year: startYear,
    premiereDate: dateIn(startYear),
    endDate: plan.status === 'Ended' ? dateIn(startYear + plan.seasons.length - 1) : null,
    status: plan.status,
    runtimeTicks: (plan.library === LIBRARY.anime ? 24 : between(42, 58)) * 600_000_000,
    officialRating: pick(RATINGS),
    communityRating: Math.round((6.4 + rand() * 2.8) * 10) / 10,
    genres: plan.genres,
    overview: overview(),
    dateCreated: new Date(BASE_DATE - planIndex * 4 * 86_400_000).toISOString(),
    images: ['Primary', 'Backdrop', 'Thumb', ...(chance(0.75) ? (['Logo'] as const) : [])],
    people: castFor(between(4, 6)),
    studios: [pick(STUDIOS)],
  });
  series.push(show);

  plan.seasons.forEach((episodeCount, seasonIndex) => {
    const season = baseItem('Season', `Staffel ${seasonIndex + 1}`, 'd');
    Object.assign(season, {
      libraryId: plan.library,
      parentId: show.id,
      seriesId: show.id,
      indexNumber: seasonIndex + 1,
      year: startYear + seasonIndex,
      hue: show.hue,
      hue2: (show.hue2 + seasonIndex * 25) % 360,
      dateCreated: show.dateCreated,
    });
    seasons.push(season);

    for (let number = 1; number <= episodeCount; number += 1) {
      const title = EPISODE_TITLES[(number - 1 + seasonIndex * 3) % EPISODE_TITLES.length] ?? '';
      const episode = baseItem('Episode', title, 'e');
      Object.assign(episode, {
        libraryId: plan.library,
        parentId: season.id,
        seriesId: show.id,
        seasonId: season.id,
        indexNumber: number,
        parentIndexNumber: seasonIndex + 1,
        year: startYear + seasonIndex,
        premiereDate: dateIn(startYear + seasonIndex),
        runtimeTicks: show.runtimeTicks,
        officialRating: show.officialRating,
        overview: overview(),
        dateCreated: new Date(
          Date.parse(show.dateCreated) + seasonIndex * 3_600_000 + number * 60_000,
        ).toISOString(),
        hue: show.hue,
        hue2: (show.hue2 + number * 11) % 360,
        streams: streamsFor(plan.library === LIBRARY.anime),
        container: containerFor(),
      });
      episodes.push(episode);
    }
  });
});

interface CollectionPlan {
  name: string;
  members: string[];
}

const COLLECTION_PLANS: CollectionPlan[] = [
  { name: 'Nebelstadt – Die Sammlung', members: ['Nebelstadt', 'Nebelstadt 2'] },
  { name: 'Orbit – Die Reihe', members: ['Orbit', 'Orbit: Rückkehr'] },
  {
    name: 'Winterabende',
    members: ['Polarnacht', 'Kaltfront', 'Eisvogel', 'Unter dem Eis', 'Nordgrat'],
  },
  {
    name: 'Am Wasser',
    members: [
      'Die letzte Fähre',
      'Salzwiesen',
      'Stille Wasser',
      'Tiefblau',
      'Hafenkinder',
      'Ferne Ufer',
    ],
  },
];

export const collections: MockItem[] = COLLECTION_PLANS.map((plan, index) => {
  const collection = baseItem('BoxSet', plan.name, 'g');
  const members = plan.members
    .map((title) => movies.find((movie) => movie.name === title))
    .filter((movie): movie is MockItem => movie !== undefined);
  Object.assign(collection, {
    libraryId: LIBRARY.collections,
    parentId: LIBRARY.collections,
    memberIds: members.map((movie) => movie.id),
    overview: `${String(members.length)} Filme, die zusammengehören.`,
    year: Math.min(...members.map((movie) => movie.year ?? 2000)),
    dateCreated: new Date(BASE_DATE - index * 9 * 86_400_000).toISOString(),
    images: ['Primary', 'Backdrop'],
    genres: [...new Set(members.flatMap((movie) => movie.genres))].slice(0, 3),
  });
  return collection;
});

export const allItems: MockItem[] = [
  ...movies,
  ...series,
  ...seasons,
  ...episodes,
  ...collections,
  ...people,
];
/** Local trailers of movies; reachable by id, but not listed in libraries. */
export const trailers: MockItem[] = movies
  .filter((movie) => movie.localTrailerCount > 0)
  .map((movie) => ({
    ...movie,
    id: `t${movie.id.slice(1)}`,
    type: 'Trailer' as const,
    name: `${movie.name} – Trailer`,
    sortName: `${movie.sortName} trailer`,
    libraryId: null,
    parentId: movie.id,
    people: [],
    localTrailerCount: 0,
  }));

export const itemsById = new Map([...allItems, ...trailers].map((item) => [item.id, item]));

/** Initial watch state shared by all demo users (each user's changes are kept separately). */
export interface SeedUserData {
  played: boolean;
  favorite: boolean;
  positionTicks: number;
  lastPlayed: string | null;
}

export function seedUserData(): Map<string, SeedUserData> {
  const seed = random(4711);
  const data = new Map<string, SeedUserData>();
  const set = (id: string, value: Partial<SeedUserData>) => {
    data.set(id, {
      played: false,
      favorite: false,
      positionTicks: 0,
      lastPlayed: null,
      ...data.get(id),
      ...value,
    });
  };
  movies.forEach((movie, index) => {
    const roll = seed();
    if (roll < 0.22)
      set(movie.id, {
        played: true,
        lastPlayed: new Date(BASE_DATE - index * 86_400_000).toISOString(),
      });
    else if (roll < 0.34) {
      set(movie.id, {
        positionTicks: Math.round(CLIP_TICKS * (0.15 + seed() * 0.6)),
        lastPlayed: new Date(BASE_DATE - index * 3_600_000).toISOString(),
      });
    }
    if (seed() < 0.14) set(movie.id, { favorite: true });
  });
  // Series progress so "next up" and "continue watching" have content.
  const watchedUpTo: [string, number, number, number][] = [
    ['Hafenviertel', 2, 3, 0.4],
    ['Die Akte Lindholm', 1, 2, 0],
    ['Kaze no Tobira', 1, 5, 0.65],
    ['Sternwarte', 1, 1, 0],
  ];
  watchedUpTo.forEach(([title, seasonNumber, episodeNumber, nextProgress], seriesIndex) => {
    const show = series.find((candidate) => candidate.name === title);
    if (!show) return;
    const showEpisodes = episodes.filter((episode) => episode.seriesId === show.id);
    for (const episode of showEpisodes) {
      const season = episode.parentIndexNumber ?? 0;
      const number = episode.indexNumber ?? 0;
      const lastPlayed = new Date(
        BASE_DATE - seriesIndex * 7_200_000 - (100 - number) * 60_000,
      ).toISOString();
      if (season < seasonNumber || (season === seasonNumber && number <= episodeNumber)) {
        set(episode.id, { played: true, lastPlayed });
      } else if (season === seasonNumber && number === episodeNumber + 1 && nextProgress > 0) {
        set(episode.id, {
          positionTicks: Math.round(CLIP_TICKS * nextProgress),
          lastPlayed,
        });
      }
    }
  });
  for (const title of ['Hafenviertel', 'Kaze no Tobira', 'Code Atlas']) {
    const show = series.find((candidate) => candidate.name === title);
    if (show) set(show.id, { favorite: true });
  }
  const winter = collections.find((collection) => collection.name === 'Winterabende');
  if (winter) set(winter.id, { favorite: true });
  return data;
}
