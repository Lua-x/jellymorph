/**
 * Domain types shared between the headless layers and the themes.
 * Themes only ever see these types, never SDK DTOs.
 */

export type AppErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'server'
  | 'unsupported'
  | 'aborted'
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  /** HTTP status, when the error came from a response. */
  status?: number;
  /** Technical detail for logs; never shown as UI text. */
  detail?: string;
}

/** Loading state handed to themes, independent of the data library. */
export type QueryResult<T> =
  | { status: 'pending' }
  | { status: 'error'; error: AppError; retry: () => void }
  | { status: 'success'; data: T; isRefreshing: boolean };

/** A Jellyfin server as shown to the user. */
export interface ServerSummary {
  id: string;
  name: string;
  url: string;
  version: string;
}

/** Why a server address could not be used. */
export type ServerProblem =
  | { reason: 'invalidAddress' }
  | { reason: 'unreachable' }
  | { reason: 'notJellyfin' }
  | { reason: 'setupIncomplete' }
  | { reason: 'unsupportedVersion'; version: string };

/** A user that can be picked on the profile screen. */
export interface Profile {
  id: string;
  name: string;
  imageUrl: string | null;
  hasPassword: boolean;
  /** A token for this user is stored on this device, so no password is needed. */
  remembered: boolean;
}

/**
 * A server image. `url` already identifies the exact image version (tag); the UI adds the size
 * it needs (see ui/JellyImage). `blurHash` is the placeholder shown while it loads.
 */
export interface ImageRef {
  url: string;
  blurHash: string | null;
  /** Width / height, when the server knows it. */
  aspectRatio: number | null;
}

export type LibraryKind = 'movies' | 'shows' | 'collections' | 'videos' | 'mixed';

export interface Library {
  id: string;
  name: string;
  kind: LibraryKind;
  image: ImageRef | null;
}

/** The signed-in user. */
export interface CurrentUser {
  id: string;
  name: string;
  imageUrl: string | null;
  isAdministrator: boolean;
  /** Libraries the user excluded from "Latest" in their Jellyfin settings. */
  latestExcludes: string[];
}

export type ItemKind =
  | 'movie'
  | 'series'
  | 'season'
  | 'episode'
  | 'collection'
  | 'video'
  | 'folder'
  | 'person'
  | 'other';

export interface UserItemData {
  played: boolean;
  favorite: boolean;
  /** Watched share 0..1 of a started item, null when not started. */
  progress: number | null;
  positionTicks: number;
  /** Unwatched episodes of a series or season. */
  unplayedCount: number | null;
}

export interface EpisodeInfo {
  seriesId: string;
  seriesName: string;
  seasonId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeNumberEnd: number | null;
}

/** A playable or browsable item as shown on cards, rows and in lists. */
export interface MediaItem {
  id: string;
  kind: ItemKind;
  name: string;
  year: number | null;
  /** Last year of a series run, null while it is continuing. */
  endYear: number | null;
  runtimeMinutes: number | null;
  officialRating: string | null;
  communityRating: number | null;
  criticRating: number | null;
  genres: string[];
  overview: string | null;
  tagline: string | null;
  premiereDate: string | null;
  images: {
    primary: ImageRef | null;
    backdrop: ImageRef | null;
    thumb: ImageRef | null;
    logo: ImageRef | null;
  };
  userData: UserItemData;
  episode: EpisodeInfo | null;
  /** Seasons of a series, items of a collection. */
  childCount: number | null;
}

export type PersonRole = 'actor' | 'director' | 'writer' | 'producer' | 'other';

export interface CastMember {
  id: string;
  name: string;
  /** Character for actors, job for crew. */
  role: string | null;
  kind: PersonRole;
  image: ImageRef | null;
}

export interface MediaTrack {
  index: number;
  title: string;
  language: string | null;
  codec: string | null;
  isDefault: boolean;
  isForced: boolean;
}

/** Everything the detail pages show about one item. */
export interface ItemDetail extends MediaItem {
  backdrops: ImageRef[];
  cast: CastMember[];
  studios: string[];
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  /** Short technical summary, e.g. "4K · HDR10". */
  videoLabel: string | null;
  localTrailerCount: number;
  seriesStatus: 'continuing' | 'ended' | null;
}

export interface Season {
  id: string;
  name: string;
  number: number | null;
  image: ImageRef | null;
  episodeCount: number | null;
  unplayedCount: number | null;
  played: boolean;
}

export interface Genre {
  id: string;
  name: string;
  image: ImageRef | null;
}

export type HomeSectionKind = 'resume' | 'nextUp' | 'latest' | 'favorites' | 'collections';

/**
 * A row on the home page. Each section loads independently; empty sections are left out by the
 * hook. Wording ("Continue watching", "New in Movies") is up to the theme.
 */
export type HomeSection =
  | {
      id: string;
      kind: HomeSectionKind;
      /** Set for "latest" sections. */
      library: Library | null;
      items: QueryResult<MediaItem[]>;
      /** Link to the full list, when there is one. */
      seeAll: string | null;
    }
  | { id: string; kind: 'genres'; genres: QueryResult<Genre[]> };

export type SearchGroupKind = 'movies' | 'shows' | 'episodes' | 'collections' | 'people';

export interface SearchGroup {
  kind: SearchGroupKind;
  items: MediaItem[];
}

export type FavoriteGroupKind = 'movies' | 'shows' | 'episodes' | 'collections' | 'videos';

export interface FavoriteGroup {
  kind: FavoriteGroupKind;
  items: MediaItem[];
}
