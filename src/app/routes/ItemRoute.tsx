import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type { ItemDetail } from '@/domain/types';
import type { Presentation } from '@/themes/contract';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useItemDetail, useSeries, useSimilarItems } from '@/hooks/useItem';
import { ThemeSlot } from '@/themes/ThemeSlot';

function useClose(): () => void {
  const navigate = useNavigate();
  return () => {
    void navigate(-1);
  };
}

function SeriesView({ series, presentation }: { series: ItemDetail; presentation: Presentation }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
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
          // Keeps the history state: details shown as an overlay stay one.
          setParams({ season: seasonId }, { replace: true, state: location.state as unknown });
        },
        similar,
        presentation,
        onClose,
      }}
    />
  );
}

function ItemView({ itemId, presentation }: { itemId: string; presentation: Presentation }) {
  const detail = useItemDetail(itemId);
  const isEpisode = detail.status === 'success' && detail.data.kind === 'episode';
  const isSeries = detail.status === 'success' && detail.data.kind === 'series';
  const similar = useSimilarItems(itemId, detail.status === 'success' && !isEpisode && !isSeries);
  const onClose = useClose();
  useDocumentTitle(detail.status === 'success' ? detail.data.name : null);

  if (detail.status === 'success' && detail.data.kind === 'series') {
    return <SeriesView series={detail.data} presentation={presentation} />;
  }
  return <ThemeSlot name="ItemDetailPage" props={{ detail, similar, presentation, onClose }} />;
}

/** Details as a page, or as an overlay above the previous page (see ShellRoutes). */
export function ItemRoute({ presentation = 'page' }: { presentation?: Presentation }) {
  const { itemId = '' } = useParams();
  return <ItemView key={itemId} itemId={itemId} presentation={presentation} />;
}
