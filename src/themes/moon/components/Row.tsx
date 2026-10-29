import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppLink } from '@/ui/AppLink';
import { useThemeComponent } from '../../context';
import type { RowProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { ErrorState } from '../../default/components/States';
import { MediaCardSkeleton } from './MediaCard';
import styles from './Row.module.css';

const SKELETON_COUNT = 9;

/** ←/→ move between the cards of a row; the list itself never takes focus. */
function onTrackKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const slot = (event.target as HTMLElement).closest('li');
  const sibling =
    event.key === 'ArrowRight' ? slot?.nextElementSibling : slot?.previousElementSibling;
  const target = sibling?.querySelector<HTMLElement>('a, button');
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** A row of posters (or landscape cards): title and "see all" above, slim arrows on the edges. */
export function Row({ title, items, variant, seeAll, context }: RowProps) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const reduced = useReducedMotion();
  const count = items.status === 'success' ? items.data.length : 0;
  const shape = variant === 'poster' ? 'poster' : 'landscape';

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

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  return (
    <section className={styles.row} data-shape={shape} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {seeAll && context === 'page' && (
          <AppLink to={seeAll} className={styles.seeAll}>
            {t('actions.seeAll')}
            <span className="visually-hidden">: {title}</span>
            <Icon name="chevronRight" />
          </AppLink>
        )}
      </header>
      {items.status === 'error' && (
        <ErrorState variant="section" error={items.error} onRetry={items.retry} />
      )}
      {items.status !== 'error' && (
        <div className={styles.viewport}>
          {items.status === 'success' && !edges.start && context === 'page' && (
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
          <ul ref={trackRef} className={styles.track} onKeyDown={onTrackKeyDown}>
            {items.status === 'pending'
              ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                  <li key={index} className={styles.slot}>
                    <MediaCardSkeleton variant={variant} />
                  </li>
                ))
              : items.data.map((item) => (
                  <li key={item.id} className={styles.slot}>
                    <MediaCard item={item} variant={variant} context={context} />
                  </li>
                ))}
          </ul>
          {items.status === 'success' && !edges.end && context === 'page' && (
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
      )}
    </section>
  );
}
