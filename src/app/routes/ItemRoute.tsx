import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { ItemDetail } from '@/domain/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useItemDetail, useSeries, useSimilarItems } from '@/hooks/useItem';
import { ThemeSlot } from '@/themes/ThemeSlot';

function useClose(): () => void {
  const navigate = useNavigate();
  return () => {
    void navigate(-1);
  };
}

function SeriesView({ series }: { series: ItemDetail }) {
  const [params, setParams] = useSearchParams();
  const model = useSeries(series.id, params.get('season'));
  const similar = useSimilarItems(series.id);
  const onClose = useClose();
  return (
    <ThemeSlot
      name="SeriesPage"
      props={{
        series,
        ...model,
        onSelectSeason: (seasonId) => {
          setParams({ season: seasonId }, { replace: true });
        },
        similar,
        presentation: 'page',
        onClose,
      }}
    />
  );
}

function ItemView({ itemId }: { itemId: string }) {
  const detail = useItemDetail(itemId);
  const isEpisode = detail.status === 'success' && detail.data.kind === 'episode';
  const isSeries = detail.status === 'success' && detail.data.kind === 'series';
  const similar = useSimilarItems(itemId, detail.status === 'success' && !isEpisode && !isSeries);
  const onClose = useClose();
  useDocumentTitle(detail.status === 'success' ? detail.data.name : null);

  if (detail.status === 'success' && detail.data.kind === 'series') {
    return <SeriesView series={detail.data} />;
  }
  return (
    <ThemeSlot name="ItemDetailPage" props={{ detail, similar, presentation: 'page', onClose }} />
  );
}

export function ItemRoute() {
  const { itemId = '' } = useParams();
  return <ItemView key={itemId} itemId={itemId} />;
}
