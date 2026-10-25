import { useId } from 'react';
import type { ItemDetailPageProps } from '../../contract';
import { ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';
import { DetailHeader } from './DetailHeader';
import { DetailsSection, ExtrasSection, RelatedRow } from './DetailSections';

/** A film or an episode: the stage, "More like this", the extras (trailers), the details. */
export function ItemDetailPage({ detail, similar, layout }: ItemDetailPageProps) {
  const headingId = useId();
  if (detail.status === 'pending') return <LoadingState />;
  if (detail.status === 'error') return <ErrorState error={detail.error} onRetry={detail.retry} />;
  const item = detail.data;
  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailHeader item={item} headingId={headingId} layout={layout} />
      <div className={styles.sections}>
        {item.kind !== 'episode' && <RelatedRow items={similar} />}
        <ExtrasSection item={item} />
        <DetailsSection item={item} facts={layout.facts} />
      </div>
    </article>
  );
}
