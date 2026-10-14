import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, RefreshMode } from '@/domain/types';
import { useItemMaintenance } from '@/hooks/useItemAdmin';
import { useToasts } from '@/ui/toast-store';
import { Button } from '../Button';
import styles from './Admin.module.css';
import { AdminDialog } from './AdminDialog';

const MODES: readonly RefreshMode[] = ['scan', 'missing', 'all'];

/** Look up the metadata again, with jellyfin-web's three modes (pictures optional). */
export function RefreshDialog({ item, onClose }: { item: ItemDetail; onClose: () => void }) {
  const { t } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const { refresh } = useItemMaintenance(item.id);
  const [mode, setMode] = useState<RefreshMode>('missing');
  const [replaceImages, setReplaceImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = () => {
    setBusy(true);
    refresh({ mode, replaceImages })
      .then(() => {
        showToast('info', t('admin.refreshDialog.started', { name: item.name }));
        onClose();
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
        setBusy(false);
      });
  };
  return (
    <AdminDialog
      title={t('admin.refreshDialog.title', { name: item.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button busy={busy} onClick={start}>
            {t('admin.refreshDialog.start')}
          </Button>
        </>
      }
    >
      <fieldset className={styles.section}>
        <legend className="visually-hidden">{t('admin.refresh')}</legend>
        <div className={styles.radios}>
          {MODES.map((value) => (
            <label key={value} className={styles.check}>
              <input
                type="radio"
                name="refresh-mode"
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                }}
              />
              {t(`admin.refreshDialog.${value}`)}
            </label>
          ))}
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={mode !== 'scan' && replaceImages}
            disabled={mode === 'scan'}
            onChange={(event) => {
              setReplaceImages(event.target.checked);
            }}
          />
          {t('admin.refreshDialog.replaceImages')}
        </label>
      </fieldset>
    </AdminDialog>
  );
}

/** Deletes the item and its files on the server, after a clear warning, then leaves the page. */
export function DeleteDialog({ item, onClose }: { item: ItemDetail; onClose: () => void }) {
  const { t } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const { remove } = useItemMaintenance(item.id);
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    remove()
      .then(() => {
        showToast('success', t('admin.deleteDialog.deleted', { name: item.name }));
        onClose();
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
        setBusy(false);
      });
  };
  return (
    <AdminDialog
      title={t('admin.deleteDialog.title', { name: item.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button variant="danger" busy={busy} onClick={confirm}>
            {t('admin.deleteDialog.confirm')}
          </Button>
        </>
      }
    >
      <p className={styles.muted}>{t('admin.deleteDialog.body')}</p>
    </AdminDialog>
  );
}
