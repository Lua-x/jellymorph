import { useEffect, useRef, useState, type CSSProperties, type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import type { PlayerModel } from '@/player/model';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import type { PlayerOverlayProps } from '../../contract';
import { Button } from './Button';
import { Icon } from './icons';
import { PlayerMenu, type PlayerMenuKind } from './PlayerMenus';
import styles from './PlayerOverlay.module.css';
import { PlayerTimeline } from './PlayerTimeline';
import { Spinner } from './Spinner';

/**
 * Focuses an offer (skip, next episode) when it appears and again when playback starts, e.g.
 * after the big play button took the focus and disappeared. An open menu keeps its focus.
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
  large = false,
  wide = false,
  buttonRef,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  large?: boolean;
  /** Only shown on wide screens (narrow control bars have no room). */
  wide?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={[styles.iconButton, large && styles.large, wide && styles.wideOnly]
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

function Title({ item }: { item: MediaItem | null }) {
  const { t } = useTranslation('player');
  if (!item) return null;
  const episode = item.episode;
  return (
    <div className={styles.title}>
      {episode ? (
        <>
          <span className={styles.titleMain}>{episode.seriesName}</span>
          <span className={styles.titleSub}>
            {episode.seasonNumber !== null && episode.episodeNumber !== null
              ? `${t('episodeCode', { season: episode.seasonNumber, episode: episode.episodeNumber })} · `
              : ''}
            {item.name}
          </span>
        </>
      ) : (
        <span className={styles.titleMain}>{item.name}</span>
      )}
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
      <Icon name="skipNext" filled />
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
  const episode = item.episode;
  return (
    <section className={styles.nextUp} aria-label={t('nextUp.title')}>
      <div className={styles.nextImage}>
        <JellyImage image={item.images.primary ?? item.images.thumb} sizes="16rem" maxWidth={640} />
        {countdown !== null && (
          <span
            className={styles.countdownBar}
            style={{ '--progress': String(countdown / 10) } as CSSProperties}
          />
        )}
      </div>
      <div className={styles.nextText}>
        <span className={styles.nextLabel}>{t('nextUp.title')}</span>
        <span className={styles.nextName}>
          {episode?.seasonNumber !== null &&
          episode?.seasonNumber !== undefined &&
          episode.episodeNumber !== null
            ? `${t('episodeCode', { season: episode.seasonNumber, episode: episode.episodeNumber })} · `
            : ''}
          {item.name}
        </span>
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
          <Icon name="play" filled />
          {t('nextUp.playNow')}
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
        <Button icon={<Icon name="refresh" />} onClick={player.retry}>
          {t('errors.retry')}
        </Button>
        <Button variant="secondary" onClick={player.close}>
          {t('close')}
        </Button>
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

/** Classic player overlay: top bar, centered state, timeline and control bar. */
export function PlayerOverlay({ player }: PlayerOverlayProps) {
  const { t } = useTranslation('player');
  const [menu, setMenu] = useState<PlayerMenuKind | null>(null);
  const triggers = useRef<Partial<Record<PlayerMenuKind, HTMLButtonElement | null>>>({});
  const lastPointer = useRef<string>('mouse');
  const visible = player.controlsVisible || menu !== null;
  const busy = player.status === 'loading' || player.status === 'buffering' || player.adapting;
  const playing = player.status === 'playing' || player.status === 'buffering';
  const hasTracks = player.audioTracks.length > 1 || player.subtitleTracks.length > 0;

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
      data-status={player.status}
      aria-label={t('player')}
      role="group"
    >
      <div className={styles.scrimTop} aria-hidden="true" />
      <div className={styles.scrimBottom} aria-hidden="true" />
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

      <header className={styles.top}>
        <IconButton label={t('close')} icon="arrowLeft" onClick={player.close} />
        <Title item={player.item} />
      </header>

      <div className={styles.center}>
        {busy && player.status !== 'error' && (
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
        )}
        {!busy && (player.status === 'paused' || player.status === 'ended') && (
          <IconButton
            large
            label={player.status === 'ended' ? t('replay') : t('play')}
            icon="play"
            onClick={player.togglePlay}
          />
        )}
      </div>

      <div className={styles.corner}>
        <SkipButton player={player} />
        <NextUpCard player={player} />
      </div>

      <div className={styles.bottom}>
        <PlayerTimeline player={player} />
        <div className={styles.controls}>
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
          <span className={styles.time}>
            <span>{formatClock(player.currentTime)}</span>
            <span className={styles.timeTotal}> / {formatClock(player.duration)}</span>
          </span>
          <span className={styles.spacer} />
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

      {menu && <PlayerMenu kind={menu} player={player} onClose={closeMenu} />}
      {player.status === 'error' && <ErrorPanel player={player} />}
    </div>
  );
}
