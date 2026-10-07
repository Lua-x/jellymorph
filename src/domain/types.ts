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

export type LibraryKind = 'movies' | 'shows' | 'collections' | 'videos' | 'mixed';

export interface Library {
  id: string;
  name: string;
  kind: LibraryKind;
  imageUrl: string | null;
}

/** The signed-in user. */
export interface CurrentUser {
  id: string;
  name: string;
  imageUrl: string | null;
  isAdministrator: boolean;
}
