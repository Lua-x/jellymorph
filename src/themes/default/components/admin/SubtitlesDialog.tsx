import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, RemoteSubtitle } from '@/domain/types';
import { useSubtitleAdmin } from '@/hooks/useItemAdmin';
import { useLanguageOptions } from '@/hooks/usePlaybackPreferences';
import { useToasts } from '@/ui/toast-store';
import { Button } from '../Button';
import { Icon } from '../icons';
import styles from './Admin.module.css';
import { AdminDialog, Field } from './AdminDialog';

/** Subtitles of a video: what is there, a search at the server's subtitle providers, upload. */
export function SubtitlesDialog({ item, onClose }: { item: ItemDetail; onClose: () => void }) {
  const { t, i18n } = useTranslation('content');
  const showToast = useToasts((state) => state.show);
  const admin = useSubtitleAdmin(item.id);
  const languages = useLanguageOptions();
  const options = languages.status === 'success' ? languages.data : [];
  // The UI language as the server names it (Jellyfin 12: "deu", older servers: "ger").
  const uiLanguage = i18n.language.slice(0, 2);
  const preferred =
    options.find((option) => option.twoLetterCode === uiLanguage)?.code ??
    (uiLanguage === 'de' ? 'deu' : 'eng');
  const [chosenLanguage, setLanguage] = useState<string | null>(null);
  const language = chosenLanguage ?? preferred;
  const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [chosenUploadLanguage, setUploadLanguage] = useState<string | null>(null);
  const uploadLanguage = chosenUploadLanguage ?? preferred;
  const [forced, setForced] = useState(false);
  const [hearingImpaired, setHearingImpaired] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();

  const run = (key: string, action: () => Promise<void>, done?: string) => {
    setBusy(key);
    action()
      .then(() => {
        if (done) showToast('success', done);
      })
      .catch(() => {
        showToast('error', t('admin.failed'));
      })
      .finally(() => {
        setBusy(null);
      });
  };

  const search = (event: SyntheticEvent) => {
    event.preventDefault();
    run('search', async () => {
      setResults(await admin.search(language));
    });
  };

  const upload = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!file) return;
    run(
      'upload',
      async () => {
        await admin.upload(file, { language: uploadLanguage, forced, hearingImpaired });
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      },
      t('admin.subtitlesDialog.uploaded'),
    );
  };

  const languageSelect =
    (value: string, onChange: (value: string) => void) =>
    ({ id }: { id: string }) => (
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.length === 0 && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    );

  return (
    <AdminDialog
      wide
      title={t('admin.subtitlesDialog.title', { name: item.name })}
      onClose={onClose}
    >
      <section className={styles.section} aria-label={t('admin.subtitlesDialog.current')}>
        <h3 className={styles.sectionTitle}>{t('admin.subtitlesDialog.current')}</h3>
        {item.subtitleTracks.length === 0 ? (
          <p className={styles.muted}>{t('admin.subtitlesDialog.none')}</p>
        ) : (
          <ul className={styles.results}>
            {item.subtitleTracks.map((track) => (
              <li key={track.index} className={`${styles.result} ${styles.textResult}`}>
                <span className={styles.resultText}>
                  <span className={styles.resultName}>{track.title}</span>
                  {!track.isExternal && (
                    <span className={styles.resultMeta}>{t('admin.subtitlesDialog.embedded')}</span>
                  )}
                </span>
                {track.isExternal && (
                  <Button
                    variant="ghost"
                    icon={<Icon name="trash" />}
                    busy={busy === `delete-${String(track.index)}`}
                    aria-label={t('admin.subtitlesDialog.deleteTrack', { name: track.title })}
                    onClick={() => {
                      run(
                        `delete-${String(track.index)}`,
                        () => admin.remove(track.index),
                        t('admin.subtitlesDialog.deleted'),
                      );
                    }}
                  >
                    {t('admin.delete')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className={styles.section} onSubmit={search}>
        <h3 className={styles.sectionTitle}>{t('admin.subtitlesDialog.search')}</h3>
        <div className={styles.toolbar}>
          <Field label={t('admin.subtitlesDialog.language')}>
            {languageSelect(language, setLanguage)}
          </Field>
          <Button type="submit" icon={<Icon name="search" />} busy={busy === 'search'}>
            {t('admin.subtitlesDialog.searchButton')}
          </Button>
        </div>
        {results !== null && results.length === 0 && (
          <p className={styles.muted} role="status">
            {t('admin.subtitlesDialog.noResults')}
          </p>
        )}
        {results !== null && results.length > 0 && (
          <ul className={styles.results}>
            {results.map((subtitle) => (
              <li key={subtitle.id} className={`${styles.result} ${styles.textResult}`}>
                <span className={styles.resultText}>
                  <span className={styles.resultName}>
                    {subtitle.name}
                    {subtitle.hashMatch && (
                      <span className={styles.badge}>{t('admin.subtitlesDialog.hashMatch')}</span>
                    )}
                  </span>
                  <span className={styles.resultMeta}>
                    {[
                      subtitle.provider,
                      subtitle.format,
                      subtitle.downloads !== null
                        ? t('admin.subtitlesDialog.downloads', { count: subtitle.downloads })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  busy={busy === subtitle.id}
                  disabled={busy !== null && busy !== subtitle.id}
                  aria-label={t('admin.subtitlesDialog.downloadNamed', { name: subtitle.name })}
                  onClick={() => {
                    run(
                      subtitle.id,
                      () => admin.download(subtitle.id),
                      t('admin.subtitlesDialog.downloaded'),
                    );
                  }}
                >
                  {t('admin.subtitlesDialog.download')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <form className={styles.section} onSubmit={upload}>
        <h3 className={styles.sectionTitle}>{t('admin.subtitlesDialog.upload')}</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={fileId}>
              {t('admin.subtitlesDialog.file')}
            </label>
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept=".srt,.vtt,.ass,.ssa"
              className={styles.input}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>
          <Field label={t('admin.subtitlesDialog.language')}>
            {languageSelect(uploadLanguage, setUploadLanguage)}
          </Field>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={forced}
              onChange={(event) => {
                setForced(event.target.checked);
              }}
            />
            {t('admin.subtitlesDialog.forced')}
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={hearingImpaired}
              onChange={(event) => {
                setHearingImpaired(event.target.checked);
              }}
            />
            {t('admin.subtitlesDialog.hearingImpaired')}
          </label>
          <Button
            type="submit"
            variant="secondary"
            icon={<Icon name="upload" />}
            busy={busy === 'upload'}
            disabled={!file}
          >
            {t('admin.subtitlesDialog.uploadButton')}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
