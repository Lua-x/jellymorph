import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';

export interface DataField {
  key: string;
  label: string;
  value: string;
}

/** The standard HUD fields of an item: episode, year, runtime or seasons, age rating, score. */
export function useItemFields(item: MediaItem): DataField[] {
  const { t, i18n } = useTranslation('content');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const score = ratingText(i18n.language, item.communityRating);
  const fields: (DataField | null)[] = [
    item.kind === 'episode'
      ? { key: 'episode', label: tNeon('data.episode'), value: episodeCode(t, item) ?? '' }
      : null,
    { key: 'year', label: tNeon('data.year'), value: yearText(t, item) ?? '' },
    item.kind === 'series'
      ? {
          key: 'seasons',
          label: tNeon('data.seasons'),
          value: item.childCount ? String(item.childCount) : '',
        }
      : {
          key: 'runtime',
          label: tNeon('data.runtime'),
          value: runtimeText(t, item.runtimeMinutes) ?? '',
        },
    { key: 'rating', label: tNeon('data.rating'), value: item.officialRating ?? '' },
    { key: 'score', label: tNeon('data.score'), value: score ? `★ ${score}` : '' },
  ];
  return fields.filter((field): field is DataField => field !== null && field.value !== '');
}
