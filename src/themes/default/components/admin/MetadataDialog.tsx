import { useId, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, MetadataDraft } from '@/domain/types';
import { useMetadataEditor } from '@/hooks/useItemAdmin';
import { useToasts } from '@/ui/toast-store';
import { Button } from '../Button';
import { ErrorState, LoadingState } from '../States';
import styles from './Admin.module.css';
import { AdminDialog, ChipInput, Field } from './AdminDialog';
import { useExternalIdLabel } from './external-ids';

function numberOrNull(value: string, max: number): number | null {
  const parsed = Number(value.replace(',', '.'));
  if (value.trim() === '' || !Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(0, parsed));
}

/**
 * The metadata editor: titles, dates, ratings, description, genres, tags, studios and external
 * IDs, plus the lock that keeps Jellyfin from changing them on its own.
 */
export function MetadataDialog({ item, onClose }: { item: ItemDetail; onClose: () => void }) {
  const { t } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const { editor, save } = useMetadataEditor(item.id, true);
  const [edited, setEdited] = useState<MetadataDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const formId = useId();
  const draft = edited ?? (editor.status === 'success' ? editor.data.draft : null);
  const idLabel = useExternalIdLabel(editor.status === 'success' ? editor.data.externalIds : []);
  const change = (patch: Partial<MetadataDraft>) => {
    if (draft) setEdited({ ...draft, ...patch });
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (draft.name.trim() === '') {
      setNameError(t('admin.metadataDialog.nameRequired'));
      return;
    }
    setNameError(null);
    setSaving(true);
    save(draft)
      .then(() => {
        showToast('success', t('admin.saved', { name: draft.name.trim() }));
        onClose();
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
        setSaving(false);
      });
  };

  const ratings =
    editor.status === 'success' && draft
      ? [
          ...new Set(
            [...editor.data.ratings, draft.officialRating].filter((rating) => rating !== ''),
          ),
        ]
      : [];

  return (
    <AdminDialog
      title={t('admin.metadataDialog.title', { name: item.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button type="submit" form={formId} busy={saving} disabled={!draft}>
            {t('admin.save')}
          </Button>
        </>
      }
    >
      {editor.status === 'pending' && <LoadingState variant="section" />}
      {editor.status === 'error' && (
        <ErrorState variant="section" error={editor.error} onRetry={editor.retry} />
      )}
      {draft && editor.status === 'success' && (
        <form id={formId} className={styles.section} onSubmit={submit} noValidate>
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>{t('admin.metadataDialog.general')}</legend>
            <div className={styles.grid}>
              <Field label={t('admin.metadataDialog.name')} error={nameError}>
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className={styles.input}
                    value={draft.name}
                    required
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                      change({ name: event.target.value });
                    }}
                  />
                )}
              </Field>
              <Field label={t('admin.metadataDialog.originalTitle')}>
                {({ id }) => (
                  <input
                    id={id}
                    className={styles.input}
                    value={draft.originalTitle}
                    onChange={(event) => {
                      change({ originalTitle: event.target.value });
                    }}
                  />
                )}
              </Field>
              <Field
                label={t('admin.metadataDialog.sortName')}
                hint={t('admin.metadataDialog.sortHint')}
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className={styles.input}
                    value={draft.sortName}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                      change({ sortName: event.target.value });
                    }}
                  />
                )}
              </Field>
              <Field label={t('admin.metadataDialog.year')}>
                {({ id }) => (
                  <input
                    id={id}
                    className={styles.input}
                    inputMode="numeric"
                    maxLength={4}
                    value={draft.year === null ? '' : String(draft.year)}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '');
                      change({ year: value === '' ? null : Number(value) });
                    }}
                  />
                )}
              </Field>
              <Field label={t('admin.metadataDialog.premiereDate')}>
                {({ id }) => (
                  <input
                    id={id}
                    type="date"
                    className={styles.input}
                    value={draft.premiereDate ?? ''}
                    onChange={(event) => {
                      change({ premiereDate: event.target.value || null });
                    }}
                  />
                )}
              </Field>
              {item.kind === 'series' && (
                <Field label={t('admin.metadataDialog.endDate')}>
                  {({ id }) => (
                    <input
                      id={id}
                      type="date"
                      className={styles.input}
                      value={draft.endDate ?? ''}
                      onChange={(event) => {
                        change({ endDate: event.target.value || null });
                      }}
                    />
                  )}
                </Field>
              )}
              <Field label={t('admin.metadataDialog.officialRating')}>
                {({ id }) => (
                  <select
                    id={id}
                    className={styles.select}
                    value={draft.officialRating}
                    onChange={(event) => {
                      change({ officialRating: event.target.value });
                    }}
                  >
                    <option value="">{t('admin.metadataDialog.noRating')}</option>
                    {ratings.map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t('admin.metadataDialog.communityRating')}>
                {({ id }) => (
                  <input
                    id={id}
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    className={styles.input}
                    value={draft.communityRating ?? ''}
                    onChange={(event) => {
                      change({ communityRating: numberOrNull(event.target.value, 10) });
                    }}
                  />
                )}
              </Field>
              <Field label={t('admin.metadataDialog.criticRating')}>
                {({ id }) => (
                  <input
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className={styles.input}
                    value={draft.criticRating ?? ''}
                    onChange={(event) => {
                      change({ criticRating: numberOrNull(event.target.value, 100) });
                    }}
                  />
                )}
              </Field>
            </div>
            <Field label={t('admin.metadataDialog.tagline')}>
              {({ id }) => (
                <input
                  id={id}
                  className={styles.input}
                  value={draft.tagline}
                  onChange={(event) => {
                    change({ tagline: event.target.value });
                  }}
                />
              )}
            </Field>
            <Field label={t('admin.metadataDialog.overview')}>
              {({ id }) => (
                <textarea
                  id={id}
                  className={styles.textarea}
                  value={draft.overview}
                  onChange={(event) => {
                    change({ overview: event.target.value });
                  }}
                />
              )}
            </Field>
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>{t('admin.metadataDialog.lists')}</legend>
            <ChipInput
              label={t('admin.metadataDialog.genres')}
              values={draft.genres}
              onChange={(genres) => {
                change({ genres });
              }}
            />
            <ChipInput
              label={t('admin.metadataDialog.tags')}
              values={draft.tags}
              onChange={(tags) => {
                change({ tags });
              }}
            />
            <ChipInput
              label={t('admin.metadataDialog.studios')}
              values={draft.studios}
              onChange={(studios) => {
                change({ studios });
              }}
            />
          </fieldset>

          {editor.data.externalIds.length > 0 && (
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                {t('admin.metadataDialog.externalIds')}
              </legend>
              <div className={styles.grid}>
                {editor.data.externalIds.map((field) => (
                  <Field key={field.key} label={idLabel(field)}>
                    {({ id }) => (
                      <input
                        id={id}
                        className={styles.input}
                        value={draft.providerIds[field.key] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value.trim();
                          const providerIds = Object.fromEntries(
                            Object.entries(draft.providerIds).filter(([key]) => key !== field.key),
                          );
                          if (value !== '') providerIds[field.key] = value;
                          change({ providerIds });
                        }}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          )}

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.locked}
              onChange={(event) => {
                change({ locked: event.target.checked });
              }}
            />
            <span>
              {t('admin.metadataDialog.locked')}
              <span className={styles.hint}> – {t('admin.metadataDialog.lockedHint')}</span>
            </span>
          </label>
        </form>
      )}
    </AdminDialog>
  );
}
