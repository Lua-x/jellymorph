import type { LayoutDefaults } from '@/domain/layout';

/**
 * Classic's arrangement (phase 14), also the starting point of the other themes, which replace
 * the lists they order differently.
 */
export const classicLayout: LayoutDefaults = {
  home: ['hero', 'libraries', 'resume', 'nextUp', 'latest', 'favorites', 'collections', 'genres'],
  detailActions: ['play', 'trailer', 'favorite', 'played', 'edit'],
  facts: [
    'year',
    'runtime',
    'officialRating',
    'communityRating',
    'videoQuality',
    'genres',
    'tagline',
    'directors',
    'audio',
    'subtitles',
    'studios',
  ],
};
