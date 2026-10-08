import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlayerModel, PlayerTrack } from '@/player/model';
import { formatClock } from '@/ui/time';
import { Icon } from './icons';
import styles from './PlayerOverlay.module.css';

export type PlayerMenuKind = 'tracks' | 'settings' | 'chapters';

interface Option {
  key: string;
  label: string;
  detail?: string;
  checked: boolean;
  onSelect: () => void;
}

function OptionGroup({ title, options }: { title: string; options: Option[] }) {
  const headingId = useId();
  return (
    <section className={styles.menuGroup} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.menuHeading}>
        {title}
      </h3>
      <div role="radiogroup" aria-labelledby={headingId} className={styles.menuOptions}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={option.checked}
            className={styles.menuOption}
            data-menu-autofocus={option.checked || undefined}
            onClick={option.onSelect}
          >
            <span className={styles.menuCheck} aria-hidden="true">
              {option.checked && <Icon name="check" />}
            </span>
            <span className={styles.menuLabel}>{option.label}</span>
            {option.detail && <span className={styles.menuDetail}>{option.detail}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function trackDetail(
  t: (key: 'forced' | 'burnedIn') => string,
  track: PlayerTrack,
): string | undefined {
  const notes: string[] = [];
  if (track.isForced) notes.push(t('forced'));
  if (track.burnIn) notes.push(t('burnedIn'));
  return notes.length > 0 ? notes.join(' · ') : undefined;
}

function TracksMenu({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  const hasStyled = player.subtitleTracks.some((track) => track.styled);
  return (
    <>
      {player.audioTracks.length > 0 && (
        <OptionGroup
          title={t('audio')}
          options={player.audioTracks.map((track) => ({
            key: String(track.index),
            label: track.label,
            checked: track.index === player.audioIndex,
            onSelect: () => {
              player.selectAudio(track.index);
            },
          }))}
        />
      )}
      <OptionGroup
        title={t('subtitles')}
        options={[
          {
            key: 'off',
            label: t('subtitlesOff'),
            checked: player.subtitleIndex === null,
            onSelect: () => {
              player.selectSubtitle(null);
            },
          },
          ...player.subtitleTracks.map((track) => ({
            key: String(track.index),
            label: track.label,
            detail: trackDetail(t, track),
            checked: track.index === player.subtitleIndex,
            onSelect: () => {
              player.selectSubtitle(track.index);
            },
          })),
        ]}
      />
      {hasStyled && (
        <div className={styles.menuSwitchRow}>
          <button
            type="button"
            role="switch"
            aria-checked={player.burnInStyled}
            className={styles.menuSwitch}
            onClick={() => {
              player.setBurnInStyled(!player.burnInStyled);
            }}
          >
            <span className={styles.switchTrack} aria-hidden="true">
              <span className={styles.switchThumb} />
            </span>
            <span className={styles.menuLabel}>{t('burnInStyled')}</span>
          </button>
          <p className={styles.menuHint}>{t('burnInStyledHint')}</p>
        </div>
      )}
    </>
  );
}

function SettingsMenu({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  return (
    <>
      <OptionGroup
        title={t('quality')}
        options={player.qualities.map((quality) => ({
          key: String(quality.maxBitrate ?? 'auto'),
          label:
            quality.maxBitrate === null
              ? t('qualityAuto')
              : t('qualityOption', {
                  height: quality.height ?? 0,
                  mbps: String(Math.round((quality.maxBitrate / 1_000_000) * 10) / 10),
                }),
          checked: quality.maxBitrate === player.maxBitrate,
          onSelect: () => {
            player.setMaxBitrate(quality.maxBitrate);
          },
        }))}
      />
      <OptionGroup
        title={t('speed')}
        options={player.rates.map((rate) => ({
          key: String(rate),
          label: rate === 1 ? t('speedNormal') : t('speedValue', { rate }),
          checked: rate === player.rate,
          onSelect: () => {
            player.setRate(rate);
          },
        }))}
      />
      {player.playMethod && (
        <p className={styles.menuFooter}>{t(`playMethod.${player.playMethod}`)}</p>
      )}
    </>
  );
}

function ChaptersMenu({ player, onDone }: { player: PlayerModel; onDone: () => void }) {
  const { t } = useTranslation('player');
  const currentIndex = player.chapters.findLastIndex(
    (chapter) => chapter.start <= player.currentTime,
  );
  return (
    <ol className={styles.chapterList} aria-label={t('menus.chapters')}>
      {player.chapters.map((chapter, index) => (
        <li key={chapter.start}>
          <button
            type="button"
            className={styles.menuOption}
            aria-current={index === currentIndex || undefined}
            data-menu-autofocus={index === currentIndex || undefined}
            onClick={() => {
              player.seek(chapter.start);
              onDone();
            }}
          >
            <span className={styles.menuLabel}>{chapter.name}</span>
            <span className={styles.menuDetail}>{formatClock(chapter.start)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

const TITLES: Record<PlayerMenuKind, 'menus.tracks' | 'menus.settings' | 'menus.chapters'> = {
  tracks: 'menus.tracks',
  settings: 'menus.settings',
  chapters: 'menus.chapters',
};

/** Popover panel above the control bar; a bottom sheet on small screens. */
export function PlayerMenu({
  kind,
  player,
  onClose,
}: {
  kind: PlayerMenuKind;
  player: PlayerModel;
  onClose: () => void;
}) {
  const { t } = useTranslation('player');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>('[data-menu-autofocus]') ??
      panel?.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }, [kind]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'Backspace' || event.key === 'GoBack') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  let content: ReactNode;
  if (kind === 'tracks') content = <TracksMenu player={player} />;
  else if (kind === 'settings') content = <SettingsMenu player={player} />;
  else content = <ChaptersMenu player={player} onDone={onClose} />;

  return (
    // Escape closes the dialog (WAI-ARIA dialog pattern) before the player sees the key.
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions
    <div
      ref={panelRef}
      className={styles.menu}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className={styles.menuHeader}>
        <h2 id={titleId} className={styles.menuTitle}>
          {t(TITLES[kind])}
        </h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('menus.closeMenu')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className={styles.menuBody}>{content}</div>
    </div>
  );
}
