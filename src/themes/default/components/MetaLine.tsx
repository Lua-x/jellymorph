import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { Icon } from './icons';
import { episodeCode, ratingText, runtimeText, yearText } from './meta';
import styles from './MetaLine.module.css';

/** Year · runtime · age rating · community rating (· extra) in one compact line. */
export function MetaLine({ item, extra }: { item: MediaItem; extra?: string | null }) {
  const { t, i18n } = useTranslation('content');
  const rating = ratingText(i18n.language, item.communityRating);
  const parts = [
    item.kind === 'episode' ? episodeCode(t, item) : null,
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : null,
    item.kind !== 'series' ? runtimeText(t, item.runtimeMinutes) : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <p className={styles.meta}>
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
      {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
      {rating && (
        <span className={styles.rating}>
          <Icon name="star" filled />
          <span className="visually-hidden">{t('meta.rating')}</span>
          {rating}
        </span>
      )}
      {extra && <span className={styles.badge}>{extra}</span>}
    </p>
  );
}
