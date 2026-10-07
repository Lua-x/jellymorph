import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useFavorites } from '@/hooks/useFavorites';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function FavoritesRoute() {
  const { t } = useTranslation('content');
  useDocumentTitle(t('favorites.title'));
  return <ThemeSlot name="FavoritesPage" props={{ groups: useFavorites() }} />;
}
