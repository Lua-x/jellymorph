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
import { HorizonButton } from './HorizonButton';
import styles from './PlayerOverlay.module.css';

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

function IconButton({
  label,
  icon,
  onClick,
  pressed,
  expanded,
  wide = false,
  large = false,
  buttonRef,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  /** Only shown on wide screens (narrow control bars have no room). */
  wide?: boolean;
  /** The main play/pause button. */
  large?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={[styles.iconButton, wide && styles.wideOnly, large && styles.large]
        .filter(Boolean)
        .join(' ')}
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

/** The series small above, the episode (or the film) below it. */
function Title({ item }: { item: MediaItem | null }) {
  const { t } = useTranslation('player');
  if (!item) return null;
  return (
    <p className={styles.title}>
      {item.episode && <span className={styles.titleSub}>{item.episode.seriesName}</span>}
      <span className={styles.titleMain}>{item.episode ? episodeLine(t, item) : item.name}</span>
    </p>
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
        <HorizonButton variant="primary" icon={<Icon name="refresh" />} onClick={player.retry}>
          {t('errors.retry')}
        </HorizonButton>
        <HorizonButton variant="secondary" onClick={player.close}>
          {t('close')}
        </HorizonButton>
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
 * Horizon player: title top left with the track, settings and window buttons top right; the
 * playback controls large in the middle of the picture; at the bottom a thin blue timeline
 * between watched and remaining time.
 */
export function PlayerOverlay({ player }: PlayerOverlayProps) {
  const { t } = useTranslation('player');
  const [menu, setMenu] = useState<PlayerMenuKind | null>(null);
  const triggers = useRef<Partial<Record<PlayerMenuKind, HTMLButtonElement | null>>>({});
  const lastPointer = useRef<string>('mouse');
  const visible = player.controlsVisible || menu !== null;
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
  const menuButton = (kind: PlayerMenuKind, icon: Parameters<typeof Icon>[0]['name']) => (
    <IconButton
      label={t(`menus.${kind}`)}
      icon={icon}
      expanded={menu === kind}
      buttonRef={(element) => {
        triggers.current[kind] = element;
      }}
      onClick={() => {
        toggleMenu(kind);
      }}
    />
  );

  return (
    <div
      className={styles.overlay}
      data-visible={visible}
      data-status={player.status}
      aria-label={t('player')}
      role="group"
    >
      <div className={styles.scrim} aria-hidden="true" />
      {/* Pointer shortcut only: click plays or pauses, double click toggles full screen.
          Keyboard users have Space, K and F, and the buttons below. */}
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

      <header className={styles.top}>
        <Title item={player.item} />
        <div className={styles.tools}>
          {hasTracks && menuButton('tracks', 'subtitles')}
          {menuButton('settings', 'sliders')}
          {player.chapters.length > 1 && menuButton('chapters', 'chapters')}
          <VolumeControl player={player} />
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
          <IconButton label={t('close')} icon="close" onClick={player.close} />
        </div>
      </header>

      <div className={styles.center}>
        {busy && player.status !== 'error' ? (
          <div className={styles.busy} role="status">
            <Spinner size="lg" />
            <span className={player.adapting ? styles.busyText : 'visually-hidden'}>
              {player.adapting
                ? t('adapting')
                : player.status === 'buffering'
                  ? t('buffering')
                  : t('loading')}
            </span>
          </div>
        ) : (
          player.status !== 'error' && (
            <div className={styles.transport}>
              <IconButton
                label={t('seekBack')}
                icon="rewind"
                onClick={() => {
                  player.seekBy(-10);
                }}
              />
              <IconButton
                large
                label={player.status === 'ended' ? t('replay') : playing ? t('pause') : t('play')}
                icon={player.status === 'ended' ? 'refresh' : playing ? 'pause' : 'play'}
                onClick={player.togglePlay}
              />
              <IconButton
                label={t('seekForward')}
                icon="forward"
                onClick={() => {
                  player.seekBy(10);
                }}
              />
            </div>
          )
        )}
      </div>

      <div className={styles.corner}>
        <SkipButton player={player} />
        <NextUpCard player={player} />
      </div>

      <div className={styles.bottom}>
        <div className={styles.timelineRow}>
          <span className={styles.time} aria-hidden="true">
            {formatClock(player.currentTime)}
          </span>
          <PlayerTimeline player={player} classes={styles} />
          <span className={styles.time}>
            <span aria-hidden="true">-{formatClock(remaining)}</span>
            <span className="visually-hidden">
              {t('remaining', { time: formatClock(remaining) })}
            </span>
          </span>
        </div>
      </div>

      {menu && <PlayerMenu kind={menu} player={player} onClose={closeMenu} classes={styles} />}
      {player.status === 'error' && <ErrorPanel player={player} />}
    </div>
  );
}
