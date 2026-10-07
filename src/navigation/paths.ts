import type { MediaItem } from '@/domain/types';

/** All route paths in one place, so hooks and themes never hard-code URLs. */
export const paths = {
  home: '/',
  servers: '/servers',
  login: '/login',
  password: (username?: string) =>
    username ? `/login/password?user=${encodeURIComponent(username)}` : '/login/password',
  quickConnect: '/login/quick-connect',
  library: (libraryId: string) => `/library/${encodeURIComponent(libraryId)}`,
  collection: (collectionId: string) => `/collection/${encodeURIComponent(collectionId)}`,
  genre: (genreId: string) => `/genre/${encodeURIComponent(genreId)}`,
  person: (personId: string) => `/person/${encodeURIComponent(personId)}`,
  item: (itemId: string) => `/item/${encodeURIComponent(itemId)}`,
  season: (seriesId: string, seasonId: string) =>
    `/item/${encodeURIComponent(seriesId)}?season=${encodeURIComponent(seasonId)}`,
  search: (term?: string) => (term ? `/search?q=${encodeURIComponent(term)}` : '/search'),
  favorites: '/favorites',
} as const;

/** Where a card for this item leads. */
export function linkTo(item: Pick<MediaItem, 'id' | 'kind'>): string {
  switch (item.kind) {
    case 'collection':
      return paths.collection(item.id);
    case 'person':
      return paths.person(item.id);
    default:
      return paths.item(item.id);
  }
}

/** Router state used to return to the page that required a sign-in. */
export interface ReturnState {
  from?: string;
}

export function returnTarget(state: unknown): string {
  const from = (state as ReturnState | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : paths.home;
}
