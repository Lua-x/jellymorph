import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorScheme, ThemeChoice } from '@/settings/model';
import { useActiveTheme } from '../../context';
import type { SettingsPageProps } from '../../contract';
import { ThemePreview } from '../../ThemePreview';
import { Button } from './Button';
import { Icon } from './icons';
import styles from './SettingsPage.module.css';
import { Spinner } from './Spinner';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  labelId,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  labelId?: string;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldText}>
        <span id={labelId} className={styles.fieldLabel}>
          {label}
        </span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
}

/** Radio group as segmented buttons; arrows move and select (WAI-ARIA radio group). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = options.findIndex((option) => option.value === value);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const next = options[index + step];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    groupRef.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };
  return (
    <div ref={groupRef} className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          data-value={option.value}
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={styles.segment}
          onKeyDown={onKeyDown}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={hint ? hintId : undefined}
      className={styles.toggle}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span className={styles.fieldText}>
        <span className={styles.fieldLabel}>{label}</span>
        {hint && (
          <span id={hintId} className={styles.fieldHint}>
            {hint}
          </span>
        )}
      </span>
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </button>
  );
}

function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <div className={styles.fieldText}>
        <label htmlFor={id} className={styles.fieldLabel}>
          {label}
        </label>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      <div className={`${styles.fieldControl} ${styles.selectWrap}`}>
        <select
          id={id}
          className={styles.select}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value as T);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" className={styles.selectIcon} />
      </div>
    </div>
  );
}

function schemeFor(theme: ThemeChoice, wanted: ColorScheme): ColorScheme {
  return theme.colorSchemes.includes(wanted) ? wanted : (theme.colorSchemes[0] ?? 'dark');
}

function ThemePicker({ settings }: SettingsPageProps) {
  const { t } = useTranslation('settings');
  const active = useActiveTheme();
  const [previewId, setPreviewId] = useState(settings.theme);
  const preview = settings.themes.find((theme) => theme.id === previewId) ?? settings.themes[0];
  const [previewScheme, setPreviewScheme] = useState<ColorScheme>(active.colorScheme);
  const loading = settings.theme !== active.manifest.id;
  if (!preview) return null;
  const scheme = schemeFor(preview, previewScheme);

  return (
    <div className={styles.themes}>
      <div className={styles.themeList} role="radiogroup" aria-label={t('theme.label')}>
        {settings.themes.map((theme) => {
          const image = theme.preview[schemeFor(theme, active.colorScheme)];
          const selected = theme.id === previewId;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={styles.themeCard}
              onClick={() => {
                setPreviewId(theme.id);
              }}
            >
              <span className={styles.themeImage}>
                {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : null}
              </span>
              <span className={styles.themeName}>
                {theme.name}
                {theme.id === settings.theme && (
                  <span className={styles.badge}>{t('theme.active')}</span>
                )}
              </span>
              <span className={styles.themeDescription}>{theme.description}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <span className={styles.fieldLabel}>{t('theme.preview')}</span>
          {preview.colorSchemes.length > 1 && (
            <Segmented
              label={t('theme.previewScheme')}
              value={scheme}
              options={preview.colorSchemes.map((value) => ({
                value,
                label: t(`colorScheme.${value}`),
              }))}
              onChange={setPreviewScheme}
            />
          )}
        </div>
        <ThemePreview themeId={preview.id} colorScheme={scheme} className={styles.preview} />
        <div className={styles.previewActions}>
          {preview.id === settings.theme && !loading ? (
            <span className={styles.activeNote}>
              <Icon name="check" />
              {t('theme.isActive')}
            </span>
          ) : (
            <Button
              icon={loading ? <Spinner /> : <Icon name="check" />}
              aria-busy={loading || undefined}
              onClick={() => {
                settings.setTheme(preview.id);
                if (preview.colorSchemes.length > 1 && settings.colorScheme !== 'auto')
                  settings.setColorScheme(scheme);
              }}
            >
              {loading ? t('theme.loading') : t('theme.applyNamed', { name: preview.name })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SyncStatus({ settings }: SettingsPageProps) {
  const { t } = useTranslation('settings');
  const { sync } = settings;
  return (
    <div className={styles.sync} role="status" aria-live="polite">
      {sync === 'loading' && t('sync.loading')}
      {sync === 'saving' && t('sync.saving')}
      {sync === 'saved' && (
        <>
          <Icon name="check" className={styles.syncOk} />
          {t('sync.saved')}
        </>
      )}
      {sync === 'error' && (
        <>
          <Icon name="alert" className={styles.syncError} />
          {t('sync.error')}
          <button type="button" className={styles.linkButton} onClick={settings.retrySync}>
            {t('sync.retry')}
          </button>
        </>
      )}
    </div>
  );
}

export function SettingsPage({ settings }: SettingsPageProps) {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation();
  const active = useActiveTheme();
  const currentTheme = settings.themes.find((theme) => theme.id === settings.theme);
  const overscanId = useId();
  const playback = settings.playback;
  const languages =
    settings.audioLanguages.status === 'success' ? settings.audioLanguages.data : [];
  const languageOptions = [
    { value: '', label: t('playback.anyLanguage') },
    ...languages.map((language) => ({ value: language.code, label: language.name })),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <SyncStatus settings={settings} />
      </header>

      <Section title={t('sections.appearance')}>
        <p className={styles.intro}>{t('theme.hint')}</p>
        <ThemePicker settings={settings} />
        {currentTheme && currentTheme.colorSchemes.length > 1 ? (
          <Field label={t('colorScheme.label')}>
            <Segmented
              label={t('colorScheme.label')}
              value={settings.colorScheme}
              options={(['auto', 'dark', 'light'] as const).map((value) => ({
                value,
                label: t(`colorScheme.${value}`),
              }))}
              onChange={settings.setColorScheme}
            />
          </Field>
        ) : (
          <Field label={t('colorScheme.label')} hint={t('colorScheme.onlyOne')}>
            <span className={styles.value}>{t(`colorScheme.${active.colorScheme}`)}</span>
          </Field>
        )}
        <Field label={t('motion.label')} hint={t('motion.hint')}>
          <Segmented
            label={t('motion.label')}
            value={settings.motion}
            options={(['system', 'reduced', 'full'] as const).map((value) => ({
              value,
              label: t(`motion.${value}`),
            }))}
            onChange={settings.setMotion}
          />
        </Field>
        <Toggle
          label={t('trailerAutoplay.label')}
          hint={t('trailerAutoplay.hint')}
          checked={settings.trailerAutoplay}
          onChange={settings.setTrailerAutoplay}
        />
      </Section>

      <Section title={t('sections.playback')}>
        {playback.status === 'error' && (
          <p className={styles.error} role="alert">
            {t('playback.loadFailed')}
          </p>
        )}
        <div className={styles.group}>
          <p className={styles.groupHint}>{t('playback.shared')}</p>
          <Toggle
            label={t('playback.nextEpisode')}
            checked={playback.status === 'success' && playback.data.nextEpisodeAutoplay}
            onChange={(nextEpisodeAutoplay) => {
              settings.setPlayback({ nextEpisodeAutoplay });
            }}
          />
          <Select
            label={t('playback.audioLanguage')}
            value={playback.status === 'success' ? (playback.data.audioLanguage ?? '') : ''}
            options={languageOptions}
            disabled={playback.status !== 'success'}
            onChange={(code) => {
              settings.setPlayback({ audioLanguage: code === '' ? null : code });
            }}
          />
          <Select
            label={t('playback.subtitleLanguage')}
            value={playback.status === 'success' ? (playback.data.subtitleLanguage ?? '') : ''}
            options={languageOptions}
            disabled={playback.status !== 'success'}
            onChange={(code) => {
              settings.setPlayback({ subtitleLanguage: code === '' ? null : code });
            }}
          />
          <Select
            label={t('playback.subtitleMode')}
            value={playback.status === 'success' ? playback.data.subtitleMode : 'default'}
            options={(['default', 'always', 'onlyForced', 'smart', 'none'] as const).map(
              (value) => ({ value, label: t(`playback.subtitleModes.${value}`) }),
            )}
            disabled={playback.status !== 'success'}
            onChange={(subtitleMode) => {
              settings.setPlayback({ subtitleMode });
            }}
          />
        </div>
        <div className={styles.group}>
          <p className={styles.groupHint}>{t('playback.deviceOnly')}</p>
          <Select
            label={t('playback.quality')}
            value={String(settings.maxBitrate ?? 'auto')}
            options={settings.qualities.map((quality) => ({
              value: String(quality.maxBitrate ?? 'auto'),
              label:
                quality.maxBitrate === null
                  ? t('playback.qualityAuto')
                  : t('playback.qualityOption', {
                      height: quality.height ?? 0,
                      mbps: String(Math.round((quality.maxBitrate / 1_000_000) * 10) / 10),
                    }),
            }))}
            onChange={(value) => {
              settings.setMaxBitrate(value === 'auto' ? null : Number(value));
            }}
          />
          <Toggle
            label={t('playback.burnIn')}
            checked={settings.burnInStyled}
            onChange={settings.setBurnInStyled}
          />
        </div>
      </Section>

      <Section title={t('sections.general')}>
        <Select
          label={t('language.label')}
          hint={t('language.hint')}
          value={settings.language}
          options={settings.languages.map((value) => ({
            value,
            label: tCommon(`language.${value}`),
          }))}
          onChange={settings.setLanguage}
        />
        <Field
          label={t('deviceMode.label')}
          hint={`${t('deviceMode.hint')} ${t('deviceMode.detected', {
            device: t(`deviceMode.devices.${settings.device}`),
          })}`}
        >
          <Segmented
            label={t('deviceMode.label')}
            value={settings.deviceMode}
            options={(['auto', 'desktop', 'tv'] as const).map((value) => ({
              value,
              label: t(`deviceMode.${value}`),
            }))}
            onChange={settings.setDeviceMode}
          />
        </Field>
        {settings.device === 'tv' && (
          <Field label={t('overscan.label')} hint={t('overscan.hint')} labelId={overscanId}>
            <span className={styles.range}>
              <input
                type="range"
                min={0}
                max={Math.round(settings.maxOverscan * 100)}
                step={1}
                value={Math.round(settings.overscan * 100)}
                aria-labelledby={overscanId}
                aria-valuetext={t('overscan.value', {
                  percent: Math.round(settings.overscan * 100),
                })}
                onChange={(event) => {
                  settings.setOverscan(Number(event.target.value) / 100);
                }}
              />
              <span className={styles.value}>
                {t('overscan.value', { percent: Math.round(settings.overscan * 100) })}
              </span>
            </span>
          </Field>
        )}
      </Section>

      <Section title={t('sections.account')}>
        <dl className={styles.account}>
          <div>
            <dt>{t('account.signedInAs')}</dt>
            <dd>{settings.account.userName}</dd>
          </div>
          <div>
            <dt>{t('account.server')}</dt>
            <dd>
              {settings.account.serverName}
              <span className={styles.version}>
                {t('account.version', { version: settings.account.serverVersion })}
              </span>
            </dd>
          </div>
        </dl>
        <div className={styles.accountActions}>
          <Button
            variant="secondary"
            icon={<Icon name="switch" />}
            onClick={settings.account.switchProfile}
          >
            {tCommon('nav.switchProfile')}
          </Button>
          {settings.account.changeServer && (
            <Button
              variant="secondary"
              icon={<Icon name="server" />}
              onClick={settings.account.changeServer}
            >
              {tCommon('nav.changeServer')}
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<Icon name="logout" />}
            busy={settings.account.signingOut}
            onClick={settings.account.signOut}
          >
            {tCommon('nav.signOut')}
          </Button>
        </div>
      </Section>
    </div>
  );
}
