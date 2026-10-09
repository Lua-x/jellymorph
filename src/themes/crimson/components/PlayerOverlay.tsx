import type { TFunction } from 'i18next';
import { useEffect, useRef, useState, type CSSProperties, type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import type { PlayerModel } from '@/player/model';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import type { PlayerOverlayProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { PlayerMenu, type PlayerMenuKind } from '../../default/components/PlayerMenus';
import { PlayerTimeline } from '../../default/components/PlayerTimeline';
import { Spinner } from '../../default/components/Spinner';
import { CrimsonButton } from './CrimsonButton';
import styles from './PlayerOverlay.module.css';

/** After this long paused without input, the controls give way to "You're watching". */
const PAUSE_INFO_DELAY_MS = 6000;

/**
 * Focuses an offer (skip, next episode) when it appears and again when playback starts. An open
 * menu keeps its focus.
 */
function useOfferFocus(
  ref: RefObject<HTMLButtonElement | null>,
  key: string | undefined,
  playing: boolean,
) {
  useEffect(() => {
    if (key && !document.activeElement?.closest('[role="dialog"]'))
      ref.current?.focus({ preventScroll: true });
  }, [ref, key, playing]);
}

/** True once playback has been paused for a while without any input. */
function usePausedIdle(paused: boolean): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!paused) return;
    let timer = window.setTimeout(() => {
      setIdle(true);
    }, PAUSE_INFO_DELAY_MS);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setIdle(true);
      }, PAUSE_INFO_DELAY_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;
    for (const name of events) document.addEventListener(name, wake, { capture: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) document.removeEventListener(name, wake, { capture: true });
      setIdle(false);
    };
  }, [paused]);
  return paused && idle;
}

function IconButton({
  label,
  icon,
  onClick,
  pressed,
  expanded,
  wide = false,
  buttonRef,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  /** Only shown on wide screens (narrow control bars have no room). */
  wide?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={wide ? `${styles.iconButton} ${styles.wideOnly}` : styles.iconButton}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : 'dialog'}
      onClick={onClick}
    >
      <Icon name={icon} filled={icon === 'play' || icon === 'pause' || icon === 'skipNext'} />
    </button>
  );
}

function episodeLine(t: TFunction<'player'>, item: MediaItem): string | null {
  const episode = item.episode;
  if (!episode) return null;
  const code =
    episode.seasonNumber !== null && episode.episodeNumber !== null
      ? `${t('episodeCode', { season: episode.seasonNumber, episode: episode.episodeNumber })} `
      : '';
  return `${code}${item.name}`;
}

/** Series in bold, then episode code and name; a film is just its name. */
function Title({ item }: { item: MediaItem | null }) {
  const { t } = useTranslation('player');
  if (!item) return null;
  return (
    <p className={styles.title}>
      <span className={styles.titleMain}>{item.episode ? item.episode.seriesName : item.name}</span>
      {item.episode && <span className={styles.titleSub}>{episodeLine(t, item)}</span>}
    </p>
  );
}

/** Shown after a longer pause: what is playing, with the description, over a dimmed picture. */
function PauseInfo({ item }: { item: MediaItem | null }) {
  const { t } = useTranslation('player');
  const { t: tCrimson } = useTranslation('theme-crimson');
  if (!item) return null;
  return (
    <div className={styles.pauseInfo} aria-hidden="true">
      <span className={styles.pauseLabel}>{tCrimson('player.watching')}</span>
      <span className={styles.pauseTitle}>
        {item.episode ? item.episode.seriesName : item.name}
      </span>
      {item.episode && <span className={styles.pauseEpisode}>{episodeLine(t, item)}</span>}
      {item.overview && <span className={styles.pauseOverview}>{item.overview}</span>}
    </div>
  );
}

function SkipButton({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  const ref = useRef<HTMLButtonElement>(null);
  const segment = player.segment;
  // Focused while the segment runs, so Enter on a remote skips it (architecture §9.9).
  useOfferFocus(ref, segment?.kind, player.status === 'playing');
  if (!segment) return null;
  return (
    <button
      ref={ref}
      type="button"
      className={styles.skip}
      onClick={() => {
        player.skipSegment();
      }}
    >
      {t(`skip.${segment.kind}`)}
    </button>
  );
}

function NextUpCard({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  const ref = useRef<HTMLButtonElement>(null);
  const nextUp = player.nextUp;
  useOfferFocus(ref, nextUp?.item.id, player.status === 'playing');
  if (!nextUp) return null;
  const { item, countdown } = nextUp;
  return (
    <section className={styles.nextUp} aria-label={t('nextUp.title')}>
      <div className={styles.nextImage}>
        <JellyImage image={item.images.primary ?? item.images.thumb} sizes="14rem" maxWidth={560} />
      </div>
      <div className={styles.nextText}>
        <span className={styles.nextLabel}>{t('nextUp.title')}</span>
        <span className={styles.nextName}>{episodeLine(t, item) ?? item.name}</span>
        {countdown !== null && (
          <span className={styles.nextCountdown} role="timer" aria-live="off">
            {t('nextUp.startsIn', { count: countdown })}
          </span>
        )}
      </div>
      <div className={styles.nextActions}>
        <button
          ref={ref}
          type="button"
          className={styles.nextPlay}
          onClick={() => {
            player.playNext();
          }}
        >
          {/* The fill runs down with the countdown, like a fuse. */}
          {countdown !== null && (
            <span
              className={styles.nextFill}
              style={{ '--progress': String(countdown / 10) } as CSSProperties}
              aria-hidden="true"
            />
          )}
          <Icon name="play" filled />
          <span>{t('nextUp.playNow')}</span>
        </button>
        <button
          type="button"
          className={styles.nextCancel}
          onClick={() => {
            player.cancelNext();
          }}
        >
          {t('nextUp.cancel')}
        </button>
      </div>
    </section>
  );
}

function ErrorPanel({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  const kind = player.error ?? 'unknown';
  return (
    <div className={styles.errorPanel} role="alert">
      <span className={styles.errorIcon}>
        <Icon name="alert" />
      </span>
      <h2 className={styles.errorTitle}>{t(`errors.${kind}.title`)}</h2>
      <p className={styles.errorMessage}>{t(`errors.${kind}.message`)}</p>
      <div className={styles.errorActions}>
        <CrimsonButton variant="light" icon={<Icon name="refresh" />} onClick={player.retry}>
          {t('errors.retry')}
        </CrimsonButton>
        <CrimsonButton variant="dim" onClick={player.close}>
          {t('close')}
        </CrimsonButton>
      </div>
    </div>
  );
}

function VolumeControl({ player }: { player: PlayerModel }) {
  const { t } = useTranslation('player');
  const silent = player.muted || player.volume === 0;
  const percent = Math.round((player.muted ? 0 : player.volume) * 100);
  return (
    <div className={styles.volume}>
      <IconButton
        label={silent ? t('unmute') : t('mute')}
        icon={silent ? 'volumeMuted' : 'volume'}
        onClick={player.toggleMute}
      />
      <input
        type="range"
        className={styles.volumeSlider}
        min={0}
        max={100}
        step={5}
        value={percent}
        aria-label={t('volume')}
        aria-valuetext={t('volumeValue', { percent })}
        style={{ '--value': `${String(percent)}%` } as CSSProperties}
        onChange={(event) => {
          player.setVolume(Number(event.target.value) / 100);
        }}
      />
    </div>
  );
}

/**
 * Crimson player: a back arrow at the top; at the bottom a red timeline with the remaining time
 * and one bar with the playback controls left, the title in the middle and the menus right.
 */
export function PlayerOverlay({ player }: PlayerOverlayProps) {
  const { t } = useTranslation('player');
  const [menu, setMenu] = useState<PlayerMenuKind | null>(null);
  const triggers = useRef<Partial<Record<PlayerMenuKind, HTMLButtonElement | null>>>({});
  const lastPointer = useRef<string>('mouse');
  const pausedIdle = usePausedIdle(player.status === 'paused' && menu === null);
  const visible = (player.controlsVisible && !pausedIdle) || menu !== null;
  const busy = player.status === 'loading' || player.status === 'buffering' || player.adapting;
  const playing = player.status === 'playing' || player.status === 'buffering';
  const hasTracks = player.audioTracks.length > 1 || player.subtitleTracks.length > 0;
  const remaining = Math.max(0, player.duration - player.currentTime);

  const toggleMenu = (kind: PlayerMenuKind) => {
    if (menu === kind) {
      closeMenu();
      return;
    }
    setMenu(kind);
    player.holdControls(true);
  };
  const closeMenu = () => {
    const trigger = menu ? triggers.current[menu] : null;
    setMenu(null);
    player.holdControls(false);
    trigger?.focus({ preventScroll: true });
  };

  return (
    <div
      className={styles.overlay}
      data-visible={visible}
      data-paused-info={pausedIdle || undefined}
      data-status={player.status}
      aria-label={t('player')}
      role="group"
    >
      <div className={styles.scrimTop} aria-hidden="true" />
      <div className={styles.scrimBottom} aria-hidden="true" />
      <div className={styles.dim} aria-hidden="true" />
      {/* Pointer shortcut only: click plays or pauses, double click toggles full screen. Keyboard
          users have Space, K and F, and the buttons below. */}
      {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-static-element-interactions */}
      <div
        className={styles.surface}
        onPointerDown={(event) => {
          lastPointer.current = event.pointerType;
        }}
        onClick={() => {
          if (menu) {
            closeMenu();
            return;
          }
          // On touch screens a tap only brings the controls back (handled by the stage).
          if (lastPointer.current === 'mouse' && player.status !== 'error') player.togglePlay();
        }}
        onDoubleClick={() => {
          if (lastPointer.current === 'mouse' && player.canFullscreen) player.toggleFullscreen();
        }}
      />

      {pausedIdle && <PauseInfo item={player.item} />}

      <header className={styles.top}>
        <IconButton label={t('close')} icon="arrowLeft" onClick={player.close} />
      </header>

      <div className={styles.center}>
        {busy && player.status !== 'error' && (
          <div className={styles.busy} role="status">
            <Spinner size="lg" className={styles.spinner} />
            <span className={player.adapting ? styles.busyText : 'visually-hidden'}>
              {player.adapting
                ? t('adapting')
                : player.status === 'buffering'
                  ? t('buffering')
                  : t('loading')}
            </span>
          </div>
        )}
        {!busy && player.status === 'ended' && (
          <button type="button" className={styles.replay} onClick={player.togglePlay}>
            <Icon name="refresh" />
            <span>{t('replay')}</span>
          </button>
        )}
      </div>

      <div className={styles.corner}>
        <SkipButton player={player} />
        <NextUpCard player={player} />
      </div>

      <div className={styles.bottom}>
        <div className={styles.timelineRow}>
          <PlayerTimeline player={player} classes={styles} />
          <span className={styles.remaining}>
            <span aria-hidden="true">{formatClock(remaining)}</span>
            <span className="visually-hidden">
              {t('remaining', { time: formatClock(remaining) })}
            </span>
          </span>
        </div>
        <div className={styles.controls}>
          <div className={styles.group}>
            <IconButton
              label={playing ? t('pause') : t('play')}
              icon={playing ? 'pause' : 'play'}
              onClick={player.togglePlay}
            />
            <IconButton
              label={t('seekBack')}
              icon="rewind"
              onClick={() => {
                player.seekBy(-10);
              }}
            />
            <IconButton
              label={t('seekForward')}
              icon="forward"
              onClick={() => {
                player.seekBy(10);
              }}
            />
            <VolumeControl player={player} />
          </div>
          <Title item={player.item} />
          <div className={`${styles.group} ${styles.groupEnd}`}>
            {hasTracks && (
              <IconButton
                label={t('menus.tracks')}
                icon="subtitles"
                expanded={menu === 'tracks'}
                buttonRef={(element) => {
                  triggers.current.tracks = element;
                }}
                onClick={() => {
                  toggleMenu('tracks');
                }}
              />
            )}
            <IconButton
              label={t('menus.settings')}
              icon="sliders"
              expanded={menu === 'settings'}
              buttonRef={(element) => {
                triggers.current.settings = element;
              }}
              onClick={() => {
                toggleMenu('settings');
              }}
            />
            {player.chapters.length > 1 && (
              <IconButton
                label={t('menus.chapters')}
                icon="chapters"
                expanded={menu === 'chapters'}
                buttonRef={(element) => {
                  triggers.current.chapters = element;
                }}
                onClick={() => {
                  toggleMenu('chapters');
                }}
              />
            )}
            {player.canPictureInPicture && (
              <IconButton
                label={player.pictureInPicture ? t('exitPictureInPicture') : t('pictureInPicture')}
                icon="pictureInPicture"
                wide
                pressed={player.pictureInPicture}
                onClick={player.togglePictureInPicture}
              />
            )}
            {player.canFullscreen && (
              <IconButton
                label={player.fullscreen ? t('exitFullscreen') : t('fullscreen')}
                icon={player.fullscreen ? 'fullscreenExit' : 'fullscreen'}
                onClick={player.toggleFullscreen}
              />
            )}
          </div>
        </div>
      </div>

      {menu && <PlayerMenu kind={menu} player={player} onClose={closeMenu} classes={styles} />}
      {player.status === 'error' && <ErrorPanel player={player} />}
    </div>
  );
}
