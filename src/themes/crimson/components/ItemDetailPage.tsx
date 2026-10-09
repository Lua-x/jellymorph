import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, QueryResult } from '@/domain/types';
import { paths } from '@/navigation/paths';
import { useThemeComponent } from '../../context';
import type { ItemDetailPageProps } from '../../contract';
import { ErrorState, LoadingState } from '../../default/components/States';
import { errorText } from '../../default/components/text';
import { DetailHeader } from './DetailHeader';
import styles from './Detail.module.css';
import { DetailSheet } from './DetailSheet';

/** "More like this": a grid of wide cards inside the details. */
export function MoreLikeThis({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('theme-crimson');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  if (items.status !== 'success' || items.data.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {t('detail.more')}
      </h2>
      <ul className={styles.grid}>
        {items.data.slice(0, 12).map((item) => (
          <li key={item.id}>
            <MediaCard item={item} variant="landscape" context="page" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ItemDetailPage({ detail, similar, presentation, onClose }: ItemDetailPageProps) {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const headingId = useId();
  const returnHref = detail.status === 'success' ? paths.item(detail.data.id) : '';

  return (
    <DetailSheet
      presentation={presentation}
      onClose={onClose}
      labelledBy={headingId}
      returnHref={returnHref}
      ready={detail.status === 'success'}
    >
      {/* Until the details are there, a hidden heading keeps the dialog named. */}
      {detail.status === 'pending' && (
        <div className={styles.loading}>
          <h1 id={headingId} className="visually-hidden">
            {t('loading')}
          </h1>
          <LoadingState variant="section" />
        </div>
      )}
      {detail.status === 'error' && (
        <div className={styles.loading}>
          <h1 id={headingId} className="visually-hidden">
            {errorText(tErrors, detail.error).title}
          </h1>
          <ErrorState variant="section" error={detail.error} onRetry={detail.retry} />
        </div>
      )}
      {detail.status === 'success' && (
        <>
          <DetailHeader item={detail.data} headingId={headingId} />
          {detail.data.kind !== 'episode' && (
            <div className={styles.body}>
              <MoreLikeThis items={similar} />
            </div>
          )}
        </>
      )}
    </DetailSheet>
  );
}
