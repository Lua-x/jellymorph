import { useId } from 'react';
import type { ItemDetailPageProps } from '../../contract';
import { ErrorState, LoadingState } from '../../default/components/States';
import { CastShelf, InfoPanel, SimilarShelf } from './DetailSections';
import { DetailStage } from './DetailStage';
import styles from './ItemDetailPage.module.css';

/** Details of a film or an episode: the full-window stage, then cast, related titles and facts. */
export function ItemDetailPage({ detail, similar }: ItemDetailPageProps) {
  const headingId = useId();
  if (detail.status === 'pending') return <LoadingState />;
  if (detail.status === 'error') return <ErrorState error={detail.error} onRetry={detail.retry} />;
  const item = detail.data;
  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailStage item={item} headingId={headingId} />
      <div className={styles.body}>
        <CastShelf cast={item.cast} />
        {item.kind !== 'episode' && <SimilarShelf items={similar} />}
        <InfoPanel item={item} />
      </div>
    </article>
  );
}
