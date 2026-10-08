import { useTranslation } from 'react-i18next';
import { ThemeSlot } from '../../ThemeSlot';
import type { ItemDetailPageProps } from '../../contract';
import { CastList, DossierHeader, DossierSkeleton } from './Dossier';
import styles from './ItemDetailPage.module.css';
import { ErrorState } from './States';

export function ItemDetailPage({ detail, similar }: ItemDetailPageProps) {
  const { t } = useTranslation('content');

  if (detail.status === 'pending') return <DossierSkeleton />;
  if (detail.status === 'error') return <ErrorState error={detail.error} onRetry={detail.retry} />;
  const item = detail.data;

  return (
    <article className={styles.page}>
      <DossierHeader item={item} />
      <CastList cast={item.cast} />
      {item.kind !== 'episode' && !(similar.status === 'success' && similar.data.length === 0) && (
        <ThemeSlot
          name="Row"
          props={{
            title: t('detail.similar'),
            items: similar,
            variant: 'poster',
            seeAll: null,
            context: 'page',
          }}
        />
      )}
    </article>
  );
}
