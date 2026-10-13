import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Icon } from '../../default/components/icons';
import styles from './Track.module.css';

const FOCUSABLE = 'a[href], button:not(:disabled)';

/**
 * ←/→ move to the neighbouring item and keep the position inside it (an episode has a play
 * button and a title link); the list itself never takes focus.
 */
function onTrackKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const origin = event.target as HTMLElement;
  const slot = origin.closest('li');
  if (!slot) return;
  const sibling =
    event.key === 'ArrowRight' ? slot.nextElementSibling : slot.previousElementSibling;
  if (!sibling) return;
  const own = [...slot.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const theirs = [...sibling.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const target = theirs[Math.min(Math.max(0, own.indexOf(origin)), theirs.length - 1)];
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** One item of a Track. */
export function TrackSlot({ className, ...rest }: ComponentProps<'li'>) {
  return <li {...rest} className={[styles.slot, className].filter(Boolean).join(' ')} />;
}

/**
 * A horizontally scrolling list that reaches the window edge, with round arrows under the
 * pointer. The parent sets `--per-row` and `--gap`. `startAt` names an item (CSS selector) to
 * scroll to the start once the items are there, e.g. the next episode.
 */
export function Track({
  children,
  count,
  interactive,
  startAt,
  className,
}: {
  children: ReactNode;
  /** Number of items, so the arrows follow changes. */
  count: number;
  /** False in the settings preview: no arrows. */
  interactive: boolean;
  startAt?: string;
  className?: string;
}) {
  const { t } = useTranslation('content');
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const reduced = useReducedMotion();

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      setEdges({
        start: track.scrollLeft <= 4,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
      });
    };
    update();
    track.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !startAt) return;
    const target = track.querySelector<HTMLElement>(startAt);
    if (!target) return;
    // Only the list scrolls; scrollIntoView would also move the page.
    track.scrollLeft = target.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft);
  }, [startAt, count]);

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  return (
    <div className={styles.viewport}>
      {interactive && !edges.start && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.previous}`}
          tabIndex={-1}
          aria-label={t('actions.scrollLeft')}
          onClick={() => {
            page(-1);
          }}
        >
          <Icon name="chevronLeft" />
        </button>
      )}
      {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- keyboard delegation */}
      <ul
        ref={trackRef}
        className={[styles.track, className].filter(Boolean).join(' ')}
        onKeyDown={onTrackKeyDown}
      >
        {children}
      </ul>
      {interactive && !edges.end && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.next}`}
          tabIndex={-1}
          aria-label={t('actions.scrollRight')}
          onClick={() => {
            page(1);
          }}
        >
          <Icon name="chevronRight" />
        </button>
      )}
    </div>
  );
}
