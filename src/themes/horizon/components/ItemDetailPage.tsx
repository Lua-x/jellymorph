import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetailPageProps } from '../../contract';
import { ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';
import { DetailHeader } from './DetailHeader';
import { DetailTabs, DetailsPanel, RelatedPanel } from './DetailTabs';

/** A film or an episode: the header, then tabs "More like this" and "Details". */
export function ItemDetailPage({ detail, similar }: ItemDetailPageProps) {
  const { t } = useTranslation('theme-horizon');
  const headingId = useId();
  if (detail.status === 'pending') return <LoadingState />;
  if (detail.status === 'error') return <ErrorState error={detail.error} onRetry={detail.retry} />;
  const item = detail.data;
  // Episodes have no "similar" list; their tabs would be a single one, so details show directly.
  const episode = item.kind === 'episode';
  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailHeader item={item} headingId={headingId} />
      {episode ? (
        <div className={styles.panel}>
          <DetailsPanel item={item} />
        </div>
      ) : (
        <DetailTabs
          tabs={[
            {
              id: 'related',
              label: t('detail.related'),
              content: <RelatedPanel items={similar} />,
            },
            { id: 'details', label: t('detail.details'), content: <DetailsPanel item={item} /> },
          ]}
        />
      )}
    </article>
  );
}
