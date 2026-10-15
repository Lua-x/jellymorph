import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FactId } from '@/domain/layout';
import type { MediaItem } from '@/domain/types';
import { Icon } from './icons';
import { episodeCode, ratingText, runtimeText, yearText } from './meta';
import styles from './MetaLine.module.css';

/** The facts this line can show, in its own order (used when no arrangement is passed). */
const META_FACTS: readonly FactId[] = [
  'year',
  'runtime',
  'officialRating',
  'communityRating',
  'videoQuality',
];

/**
 * Year · runtime · age rating · community rating (· video quality) in one compact line. `facts`
 * (phase 14) chooses which of them show and in which order; the episode code always leads.
 */
export function MetaLine({
  item,
  extra,
  facts = META_FACTS,
}: {
  item: MediaItem;
  extra?: string | null;
  facts?: readonly FactId[];
}) {
  const { t, i18n } = useTranslation('content');
  const rating = ratingText(i18n.language, item.communityRating);
  const parts: Partial<Record<FactId, ReactNode>> = {
    year: yearText(t, item),
    runtime:
      item.kind === 'series'
        ? item.childCount
          ? t('meta.seasons', { count: item.childCount })
          : null
        : runtimeText(t, item.runtimeMinutes),
    officialRating: item.officialRating && (
      <span className={styles.badge}>{item.officialRating}</span>
    ),
    communityRating: rating && (
      <span className={styles.rating}>
        <Icon name="star" filled />
        <span className="visually-hidden">{t('meta.rating')}</span>
        {rating}
      </span>
    ),
    videoQuality: extra && <span className={styles.badge}>{extra}</span>,
  };
  const shown = facts.filter((id) => Boolean(parts[id]));
  const code = item.kind === 'episode' ? episodeCode(t, item) : null;

  return (
    <p className={styles.meta}>
      {code && <span>{code}</span>}
      {shown.map((id) => {
        const part = parts[id];
        return typeof part === 'string' ? (
          <span key={id}>{part}</span>
        ) : (
          <Fragment key={id}>{part}</Fragment>
        );
      })}
    </p>
  );
}
