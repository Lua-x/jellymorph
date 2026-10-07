import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearch } from '@/hooks/useSearch';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function SearchRoute() {
  const { t } = useTranslation('content');
  const [params, setParams] = useSearchParams();
  // The input stays responsive; the URL (for back/forward and sharing) follows along.
  const [term, setTerm] = useState(params.get('q') ?? '');
  const results = useSearch(term);
  useDocumentTitle(t('search.title'));
  return (
    <ThemeSlot
      name="SearchPage"
      props={{
        term,
        results,
        onTermChange: (next) => {
          setTerm(next);
          setParams(next.trim() ? { q: next } : {}, { replace: true });
        },
      }}
    />
  );
}
