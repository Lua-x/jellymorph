import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { paths } from '@/navigation/paths';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function NotFoundRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('notFound.title'));
  return (
    <ThemeSlot
      name="EmptyState"
      props={{
        title: t('notFound.title'),
        message: t('notFound.message'),
        action: {
          label: t('notFound.action'),
          onAction: () => {
            void navigate(paths.home);
          },
        },
      }}
    />
  );
}
