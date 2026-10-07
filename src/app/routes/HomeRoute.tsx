import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useFeatured, useHomeSections } from '@/hooks/useHome';
import { useCurrentUser, useLibraries } from '@/hooks/useUser';
import { useThemeOptions } from '@/themes/context';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function HomeRoute() {
  const { t } = useTranslation();
  const { heroItemCount } = useThemeOptions();
  useDocumentTitle(t('nav.home'));
  return (
    <ThemeSlot
      name="HomePage"
      props={{
        user: useCurrentUser(),
        hero: useFeatured(heroItemCount),
        libraries: useLibraries(),
        sections: useHomeSections(),
      }}
    />
  );
}
