import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FactId } from '@/domain/layout';
import type { MediaItem } from '@/domain/types';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';

export interface DataField {
  key: string;
  /** The arrangeable fact this field shows (phase 14); fields without one always show. */
  fact?: FactId;
  label: string;
  value: ReactNode;
}

/** Fields in the order of `facts`, without those it leaves out; fields without a fact first. */
export function arrangeFields(
  fields: readonly DataField[],
  facts?: readonly FactId[],
): DataField[] {
  if (!facts) return [...fields];
  const fixed = fields.filter((field) => !field.fact);
  const byFact = new Map(fields.map((field) => [field.fact, field]));
  return [
    ...fixed,
    ...facts.map((fact) => byFact.get(fact)).filter((field): field is DataField => !!field),
  ];
}

/**
 * The standard HUD fields of an item: episode, year, runtime or seasons, age rating, score.
 * `facts` arranges them on detail pages.
 */
export function useItemFields(item: MediaItem, facts?: readonly FactId[]): DataField[] {
  const { t, i18n } = useTranslation('content');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const score = ratingText(i18n.language, item.communityRating);
  const fields: (DataField | null)[] = [
    item.kind === 'episode'
      ? { key: 'episode', label: tNeon('data.episode'), value: episodeCode(t, item) ?? '' }
      : null,
    { key: 'year', fact: 'year', label: tNeon('data.year'), value: yearText(t, item) ?? '' },
    item.kind === 'series'
      ? {
          key: 'seasons',
          fact: 'runtime',
          label: tNeon('data.seasons'),
          value: item.childCount ? String(item.childCount) : '',
        }
      : {
          key: 'runtime',
          fact: 'runtime',
          label: tNeon('data.runtime'),
          value: runtimeText(t, item.runtimeMinutes) ?? '',
        },
    {
      key: 'rating',
      fact: 'officialRating',
      label: tNeon('data.rating'),
      value: item.officialRating ?? '',
    },
    {
      key: 'score',
      fact: 'communityRating',
      label: tNeon('data.score'),
      value: score ? `★ ${score}` : '',
    },
  ];
  return arrangeFields(
    fields.filter((field): field is DataField => field !== null && field.value !== ''),
    facts,
  );
}
