import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { IdentifyResult, ItemDetail } from '@/domain/types';
import { useIdentify } from '@/hooks/useItemAdmin';
import { useToasts } from '@/ui/toast-store';
import { Button } from '../Button';
import { Icon } from '../icons';
import styles from './Admin.module.css';
import { AdminDialog, Field } from './AdminDialog';
import { useExternalIdLabel } from './external-ids';

/**
 * Identify: search the metadata providers by title, year or an external ID, then apply one
 * match. Jellyfin then reloads the metadata (and, if chosen, the pictures) from that match.
 */
export function IdentifyDialog({
  item,
  kind,
  onClose,
}: {
  item: ItemDetail;
  kind: 'movie' | 'series';
  onClose: () => void;
}) {
  const { t } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const identify = useIdentify(item.id, kind, true);
  const [name, setName] = useState(item.name);
  const [year, setYear] = useState(item.year === null ? '' : String(item.year));
  const [ids, setIds] = useState<Record<string, string>>({});
  const [results, setResults] = useState<IdentifyResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [replaceImages, setReplaceImages] = useState(true);
  const idLabel = useExternalIdLabel(
    identify.externalIds.status === 'success' ? identify.externalIds.data : [],
  );

  const search = (event: SyntheticEvent) => {
    event.preventDefault();
    setSearching(true);
    identify
      .search({
        name,
        year: /^\d{4}$/.test(year.trim()) ? Number(year.trim()) : null,
        providerIds: Object.fromEntries(
          Object.entries(ids).filter(([, value]) => value.trim() !== ''),
        ),
      })
      .then(setResults)
      .catch(() => {
        showToast('error', t('admin.failed'));
      })
      .finally(() => {
        setSearching(false);
      });
  };

  const apply = (result: IdentifyResult) => {
    setApplying(result.id);
    identify
      .apply(result.id, replaceImages)
      .then(() => {
        showToast('success', t('admin.identifyDialog.applied', { name: result.name }));
        onClose();
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
        setApplying(null);
      });
  };

  return (
    <AdminDialog title={t('admin.identifyDialog.title', { name: item.name })} onClose={onClose}>
      <form className={styles.section} onSubmit={search}>
        <p className={styles.muted}>{t('admin.identifyDialog.intro')}</p>
        <div className={styles.grid}>
          <Field label={t('admin.identifyDialog.name')}>
            {({ id }) => (
              <input
                id={id}
                className={styles.input}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label={t('admin.identifyDialog.year')}>
            {({ id }) => (
              <input
                id={id}
                className={styles.input}
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                }}
              />
            )}
          </Field>
          {identify.externalIds.status === 'success' &&
            identify.externalIds.data.map((field) => (
              <Field key={field.key} label={idLabel(field)}>
                {({ id }) => (
                  <input
                    id={id}
                    className={styles.input}
                    value={ids[field.key] ?? ''}
                    onChange={(event) => {
                      setIds((current) => ({ ...current, [field.key]: event.target.value }));
                    }}
                  />
                )}
              </Field>
            ))}
        </div>
        <div className={styles.toolbar}>
          <Button type="submit" icon={<Icon name="search" />} busy={searching}>
            {t('admin.identifyDialog.search')}
          </Button>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={replaceImages}
              onChange={(event) => {
                setReplaceImages(event.target.checked);
              }}
            />
            {t('admin.identifyDialog.replaceImages')}
          </label>
        </div>
      </form>

      {results !== null && (
        <section className={styles.section} aria-label={t('admin.identifyDialog.results')}>
          <h3 className={styles.sectionTitle}>{t('admin.identifyDialog.results')}</h3>
          {results.length === 0 ? (
            <p className={styles.muted} role="status">
              {t('admin.identifyDialog.noResults')}
            </p>
          ) : (
            <ul className={styles.results}>
              {results.map((result) => (
                <li key={result.id} className={styles.result}>
                  <span className={styles.resultImage}>
                    {result.imageUrl && (
                      <img src={result.imageUrl} alt="" loading="lazy" decoding="async" />
                    )}
                  </span>
                  <span className={styles.resultText}>
                    <span className={styles.resultName}>{result.name}</span>
                    <span className={styles.resultMeta}>
                      {[result.year, result.provider].filter(Boolean).join(' · ')}
                    </span>
                    {result.overview && (
                      <span className={styles.resultOverview}>{result.overview}</span>
                    )}
                  </span>
                  <Button
                    variant="secondary"
                    busy={applying === result.id}
                    disabled={applying !== null && applying !== result.id}
                    aria-label={t('admin.identifyDialog.applyNamed', { name: result.name })}
                    onClick={() => {
                      apply(result);
                    }}
                  >
                    {t('admin.identifyDialog.apply')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AdminDialog>
  );
}
