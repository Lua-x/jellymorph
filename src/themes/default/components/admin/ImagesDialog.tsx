import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditableImageType, ItemDetail } from '@/domain/types';
import { useItemImages, useRemoteImages } from '@/hooks/useItemAdmin';
import { useToasts } from '@/ui/toast-store';
import { Button } from '../Button';
import { Icon } from '../icons';
import { ErrorState, LoadingState } from '../States';
import styles from './Admin.module.css';
import { AdminDialog, Field } from './AdminDialog';

/** How a picture type is framed: posters upright, logos and banners shown whole. */
function shapeOf(type: EditableImageType, item: ItemDetail): 'portrait' | 'landscape' | 'whole' {
  if (type === 'Primary')
    return item.kind === 'episode' || item.kind === 'video' ? 'landscape' : 'portrait';
  return type === 'Backdrop' || type === 'Thumb' ? 'landscape' : 'whole';
}

const TYPES: readonly EditableImageType[] = [
  'Primary',
  'Backdrop',
  'Logo',
  'Thumb',
  'Banner',
  'Art',
];

/**
 * Pictures of an item, one type at a time: what is there (delete it), upload your own, or pick
 * one the metadata providers offer.
 */
export function ImagesDialog({ item, onClose }: { item: ItemDetail; onClose: () => void }) {
  const { t } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const [type, setType] = useState<EditableImageType>('Primary');
  const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const { images, download, upload, remove } = useItemImages(item.id, true);
  const remote = useRemoteImages(item.id, type, provider, true);
  const current = images.status === 'success' ? images.data.filter((i) => i.type === type) : [];
  const typeName = (value: EditableImageType) => t(`admin.imagesDialog.types.${value}`);
  const shape = shapeOf(type, item);

  const run = (key: string, action: () => Promise<void>, done: string) => {
    setBusy(key);
    action()
      .then(() => {
        showToast('success', done);
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
      })
      .finally(() => {
        setBusy(null);
      });
  };

  return (
    <AdminDialog wide title={t('admin.imagesDialog.title', { name: item.name })} onClose={onClose}>
      <div className={styles.toolbar}>
        <Field label={t('admin.imagesDialog.type')}>
          {({ id }) => (
            <select
              id={id}
              className={styles.select}
              value={type}
              onChange={(event) => {
                setType(event.target.value as EditableImageType);
                setProvider(null);
              }}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {typeName(value)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={styles.fileInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) run('upload', () => upload(type, file), t('admin.imagesDialog.uploaded'));
          }}
        />
        <Button
          variant="secondary"
          icon={<Icon name="upload" />}
          busy={busy === 'upload'}
          onClick={() => fileRef.current?.click()}
        >
          {t('admin.imagesDialog.upload')}
        </Button>
      </div>

      <section className={styles.section} aria-label={t('admin.imagesDialog.current')}>
        <h3 className={styles.sectionTitle}>
          {t('admin.imagesDialog.current')}: {typeName(type)}
        </h3>
        {images.status === 'pending' && <LoadingState variant="section" />}
        {images.status === 'error' && (
          <ErrorState variant="section" error={images.error} onRetry={images.retry} />
        )}
        {images.status === 'success' && current.length === 0 && (
          <p className={styles.muted}>{t('admin.imagesDialog.none')}</p>
        )}
        {current.length > 0 && (
          <ul className={styles.imageGrid} data-shape={shape}>
            {current.map((image) => (
              <li key={`${image.type}-${String(image.index)}`} className={styles.imageCard}>
                <span className={styles.imageFrame}>
                  <img src={image.url} alt="" loading="lazy" decoding="async" />
                </span>
                {image.width !== null && image.height !== null && (
                  <span className={styles.imageMeta}>
                    {t('admin.imagesDialog.size', { width: image.width, height: image.height })}
                  </span>
                )}
                <Button
                  variant="ghost"
                  icon={<Icon name="trash" />}
                  busy={busy === `delete-${String(image.index)}`}
                  aria-label={t('admin.imagesDialog.delete')}
                  onClick={() => {
                    run(
                      `delete-${String(image.index)}`,
                      () => remove(image.type, image.index),
                      t('admin.imagesDialog.deleted'),
                    );
                  }}
                >
                  {t('admin.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-label={t('admin.imagesDialog.online')}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{t('admin.imagesDialog.online')}</h3>
          {remote.status === 'success' && remote.data.providers.length > 1 && (
            <Field label={t('admin.imagesDialog.provider')}>
              {({ id }) => (
                <select
                  id={id}
                  className={styles.select}
                  value={provider ?? ''}
                  onChange={(event) => {
                    setProvider(event.target.value || null);
                  }}
                >
                  <option value="">{t('admin.imagesDialog.allProviders')}</option>
                  {remote.data.providers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>
        {remote.status === 'pending' && <LoadingState variant="section" />}
        {remote.status === 'error' && (
          <ErrorState variant="section" error={remote.error} onRetry={remote.retry} />
        )}
        {remote.status === 'success' && remote.data.images.length === 0 && (
          <p className={styles.muted}>{t('admin.imagesDialog.noRemote')}</p>
        )}
        {remote.status === 'success' && remote.data.images.length > 0 && (
          <ul className={styles.imageGrid} data-shape={shape}>
            {remote.data.images.map((image) => (
              <li key={image.url} className={styles.imageCard}>
                <span className={styles.imageFrame}>
                  <img src={image.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                </span>
                <span className={styles.imageMeta}>
                  {[
                    image.provider,
                    image.width !== null && image.height !== null
                      ? t('admin.imagesDialog.size', { width: image.width, height: image.height })
                      : null,
                    image.language,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <Button
                  variant="secondary"
                  busy={busy === image.url}
                  disabled={busy !== null && busy !== image.url}
                  onClick={() => {
                    run(image.url, () => download(type, image.url), t('admin.imagesDialog.chosen'));
                  }}
                >
                  {t('admin.imagesDialog.choose')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminDialog>
  );
}
