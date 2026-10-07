import type { SessionKey } from '@/api/session-store';

/**
 * Query keys. Everything that belongs to a user starts with [serverId, userId], so data of one
 * user can never show up for another one, and `user(key)` invalidates all of it at once.
 */
const user = ({ serverId, userId }: SessionKey) => [serverId, userId] as const;

export const queryKeys = {
  fixedServer: (url: string) => ['fixedServer', url] as const,
  publicProfiles: (serverId: string) => ['server', serverId, 'publicProfiles'] as const,
  quickConnectEnabled: (serverId: string) => ['server', serverId, 'quickConnectEnabled'] as const,
  user,
  currentUser: (key: SessionKey) => [...user(key), 'currentUser'] as const,
  libraries: (key: SessionKey) => [...user(key), 'libraries'] as const,
  featured: (key: SessionKey, count: number) => [...user(key), 'featured', count] as const,
  resume: (key: SessionKey) => [...user(key), 'resume'] as const,
  nextUp: (key: SessionKey, seriesId: string | null) => [...user(key), 'nextUp', seriesId] as const,
  latest: (key: SessionKey, libraryId: string) => [...user(key), 'latest', libraryId] as const,
  favoritesPreview: (key: SessionKey) => [...user(key), 'favoritesPreview'] as const,
  collections: (key: SessionKey) => [...user(key), 'collections'] as const,
  genres: (key: SessionKey) => [...user(key), 'genres'] as const,
  itemPage: (key: SessionKey, query: string, page: number) =>
    [...user(key), 'itemPage', query, page] as const,
  letterIndex: (key: SessionKey, query: string, letter: string) =>
    [...user(key), 'letterIndex', query, letter] as const,
  filterOptions: (key: SessionKey, query: string) =>
    [...user(key), 'filterOptions', query] as const,
  item: (key: SessionKey, itemId: string) => [...user(key), 'item', itemId] as const,
  similar: (key: SessionKey, itemId: string) => [...user(key), 'similar', itemId] as const,
  seasons: (key: SessionKey, seriesId: string) => [...user(key), 'seasons', seriesId] as const,
  episodes: (key: SessionKey, seriesId: string, seasonId: string) =>
    [...user(key), 'episodes', seriesId, seasonId] as const,
  search: (key: SessionKey, term: string, kind: string) =>
    [...user(key), 'search', term, kind] as const,
  favorites: (key: SessionKey) => [...user(key), 'favorites'] as const,
};
