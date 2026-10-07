import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCurrentUser, useLibraries } from '@/hooks/useUser';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function HomeRoute() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.home'));
  return (
    <ThemeSlot name="HomePage" props={{ user: useCurrentUser(), libraries: useLibraries() }} />
  );
}
