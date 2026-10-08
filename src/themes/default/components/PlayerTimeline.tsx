import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Chapter, PlayerModel } from '@/player/model';
import { formatClock } from '@/ui/time';
import { useScrubber } from '@/ui/useScrubber';
import defaultStyles from './PlayerOverlay.module.css';

function chapterAt(chapters: Chapter[], seconds: number): Chapter | null {
  let current: Chapter | null = null;
  for (const chapter of chapters) {
    if (chapter.start <= seconds) current = chapter;
    else break;
  }
  return current;
}

const ratio = (value: number, duration: number) =>
  duration > 0 ? Math.min(1, Math.max(0, value / duration)) : 0;

/** Class names the timeline uses; other themes pass their own CSS module with the same names. */
export type PlayerClasses = Readonly<Record<string, string>>;

/**
 * Seek bar with buffered range, chapter marks and a trickplay preview while hovering.
 * `classes` lets other themes reuse the behaviour with their own look.
 */
export function PlayerTimeline({
  player,
  classes: styles = defaultStyles,
}: {
  player: PlayerModel;
  classes?: PlayerClasses;
}) {
  const { t } = useTranslation('player');
  const { duration, currentTime, bufferedEnd, chapters, trickplay } = player;
  const [focused, setFocused] = useState(false);
  const scrubber = useScrubber({
    duration,
    value: currentTime,
    onSeek: player.seek,
    onActiveChange: player.holdControls,
  });
  const shown = scrubber.dragging
    ? scrubber.previewTime
    : (scrubber.previewTime ?? (focused ? currentTime : null));
  const played =
    scrubber.dragging && scrubber.previewTime !== null ? scrubber.previewTime : currentTime;
  const frame = shown !== null ? (trickplay?.frameAt(shown) ?? null) : null;
  const chapter = shown !== null && chapters.length > 1 ? chapterAt(chapters, shown) : null;

  return (
    <div className={styles.timeline}>
      {shown !== null && duration > 0 && (
        <div
          className={styles.preview}
          style={{ '--x': `${String(ratio(shown, duration) * 100)}%` } as CSSProperties}
          aria-hidden="true"
        >
          {frame && (
            <span
              className={styles.previewFrame}
              style={
                {
                  backgroundImage: `url("${frame.url}")`,
                  '--fw': frame.width,
                  '--fh': frame.height,
                  '--sx': frame.x,
                  '--sy': frame.y,
                  '--sw': frame.sheetWidth,
                  '--sh': frame.sheetHeight,
                } as CSSProperties
              }
            />
          )}
          {chapter?.name && <span className={styles.previewChapter}>{chapter.name}</span>}
          <span className={styles.previewTime}>{formatClock(shown)}</span>
        </div>
      )}
      <div
        {...scrubber.trackProps}
        className={styles.track}
        role="slider"
        tabIndex={0}
        aria-label={t('timeline')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={t('timePosition', {
          current: formatClock(currentTime),
          total: formatClock(duration),
        })}
        onFocus={() => {
          setFocused(true);
          trickplay?.preload();
          player.revealControls();
        }}
        onBlur={() => {
          setFocused(false);
        }}
        onPointerEnter={() => {
          trickplay?.preload();
        }}
      >
        <span className={styles.rail}>
          <span
            className={styles.buffered}
            style={{ transform: `scaleX(${String(ratio(bufferedEnd, duration))})` }}
          />
          <span
            className={styles.played}
            style={{ transform: `scaleX(${String(ratio(played, duration))})` }}
          />
          {chapters.length > 1 &&
            chapters
              .slice(1)
              .map((mark) => (
                <span
                  key={mark.start}
                  className={styles.chapterMark}
                  style={
                    { '--x': `${String(ratio(mark.start, duration) * 100)}%` } as CSSProperties
                  }
                />
              ))}
        </span>
        <span
          className={styles.knobTrack}
          style={{ transform: `translateX(${String(ratio(played, duration) * 100)}%)` }}
        >
          <span className={styles.knob} />
        </span>
      </div>
    </div>
  );
}
