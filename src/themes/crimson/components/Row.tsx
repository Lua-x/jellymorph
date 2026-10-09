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

const SKELETON_COUNT = 6;

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

interface Paging {
  start: boolean;
  end: boolean;
  page: number;
  pages: number;
}

/** A row of wide cards with arrows on both edges and a page indicator on the right. */
export function Row({ title, items, seeAll, context }: RowProps) {
  const { t } = useTranslation('content');
  const { t: tCrimson } = useTranslation('theme-crimson');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [paging, setPaging] = useState<Paging>({ start: true, end: true, page: 0, pages: 1 });
  const reduced = useReducedMotion();
  const count = items.status === 'success' ? items.data.length : 0;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const width = Math.max(1, track.clientWidth);
      setPaging({
        start: track.scrollLeft <= 4,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
        page: Math.round(track.scrollLeft / width),
        pages: Math.max(1, Math.ceil((track.scrollWidth - 4) / width)),
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
    trackRef.current?.scrollBy({
      left: direction * trackRef.current.clientWidth,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  return (
    <section className={styles.row} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {seeAll && context === 'page' ? (
            <AppLink to={seeAll} className={styles.titleLink}>
              {title}
              <span className={styles.explore} aria-hidden="true">
                {t('actions.seeAll')}
                <Icon name="chevronRight" />
              </span>
            </AppLink>
          ) : (
            title
          )}
        </h2>
        {paging.pages > 1 && (
          <span
            className={styles.pages}
            role="img"
            aria-label={tCrimson('rows.page', { current: paging.page + 1, total: paging.pages })}
          >
            {Array.from({ length: paging.pages }, (_, index) => (
              <span key={index} data-current={index === paging.page || undefined} />
            ))}
          </span>
        )}
      </header>
      {items.status === 'error' && (
        <ErrorState variant="section" error={items.error} onRetry={items.retry} />
      )}
      {items.status !== 'error' && (
        <div className={styles.viewport}>
          {items.status === 'success' && !paging.start && (
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
                    <MediaCardSkeleton />
                  </li>
                ))
              : items.data.map((item) => (
                  <li key={item.id} className={styles.slot}>
                    <MediaCard item={item} variant="landscape" context={context} />
                  </li>
                ))}
          </ul>
          {items.status === 'success' && !paging.end && (
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
