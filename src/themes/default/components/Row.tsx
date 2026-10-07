import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppLink } from '@/ui/AppLink';
import { useThemeComponent } from '../../context';
import type { RowProps } from '../../contract';
import { Icon } from './icons';
import { MediaCardSkeleton } from './MediaCard';
import styles from './Row.module.css';
import { ErrorState } from './States';

const SKELETON_COUNT = 8;

/** Moves focus between the cards of a row with ←/→ (spatial navigation arrives in phase 4). */
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

export function Row({ title, items, variant, seeAll, context }: RowProps) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [scroll, setScroll] = useState({ start: true, end: true });
  const reduced = useReducedMotion();
  const count = items.status === 'success' ? items.data.length : 0;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      setScroll({
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

  const slotClass = variant === 'poster' ? styles.slot : `${styles.slot} ${styles.wide}`;

  return (
    <section className={styles.row} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {seeAll && context === 'page' && (
          <AppLink to={seeAll} className={styles.seeAll}>
            {t('actions.seeAll')}
            <Icon name="chevronRight" />
          </AppLink>
        )}
      </header>
      {items.status === 'error' && (
        <ErrorState variant="section" error={items.error} onRetry={items.retry} />
      )}
      {items.status !== 'error' && (
        <div className={styles.viewport}>
          {items.status === 'success' && !scroll.start && (
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
          {/* Arrow keys move focus between the links inside; the list itself never takes focus. */}
          {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- keyboard delegation */}
          <ul ref={trackRef} className={styles.track} onKeyDown={onTrackKeyDown}>
            {items.status === 'pending'
              ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                  <li key={index} className={slotClass}>
                    <MediaCardSkeleton variant={variant} />
                  </li>
                ))
              : items.data.map((item) => (
                  <li key={item.id} className={slotClass}>
                    <MediaCard item={item} variant={variant} context={context} />
                  </li>
                ))}
          </ul>
          {items.status === 'success' && !scroll.end && (
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
