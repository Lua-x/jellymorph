import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLink } from '@/ui/AppLink';
import { useThemeComponent } from '../../context';
import type { RowProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { ErrorState } from '../../default/components/States';
import { MediaCardSkeleton } from './MediaCard';
import styles from './Row.module.css';
import { Track, TrackSlot } from './Track';

const SKELETON_COUNT = 6;

/** A row of rounded 16:9 cards: title left, "see all" right, arrows under the pointer. */
export function Row({ title, items, variant, seeAll, context }: RowProps) {
  const { t } = useTranslation('content');
  const MediaCard = useThemeComponent('MediaCard');
  const headingId = useId();
  const count = items.status === 'success' ? items.data.length : 0;

  return (
    <section className={styles.row} aria-labelledby={headingId}>
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
      {items.status === 'error' ? (
        <ErrorState variant="section" error={items.error} onRetry={items.retry} />
      ) : (
        <Track count={count} interactive={items.status === 'success' && context === 'page'}>
          {items.status === 'pending'
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <TrackSlot key={index}>
                  <MediaCardSkeleton />
                </TrackSlot>
              ))
            : items.data.map((item) => (
                <TrackSlot key={item.id}>
                  <MediaCard
                    item={item}
                    variant={variant === 'episode' ? 'episode' : 'landscape'}
                    context={context}
                  />
                </TrackSlot>
              ))}
        </Track>
      )}
    </section>
  );
}
