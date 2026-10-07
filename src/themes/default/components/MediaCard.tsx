import { useTranslation } from 'react-i18next';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { CardVariant, MediaCardProps } from '../../contract';
import { Icon } from './icons';
import styles from './MediaCard.module.css';
import { cardSubtitle, cardTitle } from './meta';

const SIZES: Record<CardVariant, string> = {
  poster: '(min-width: 120rem) 11vw, (min-width: 64rem) 15vw, (min-width: 40rem) 24vw, 45vw',
  landscape: '(min-width: 120rem) 18vw, (min-width: 64rem) 24vw, (min-width: 40rem) 40vw, 80vw',
  episode: '(min-width: 64rem) 20vw, 40vw',
};

const FALLBACK_ICONS = {
  movie: 'movies',
  series: 'shows',
  season: 'shows',
  episode: 'shows',
  collection: 'collections',
  video: 'videos',
  folder: 'folder',
  person: 'user',
  other: 'folder',
} as const;

export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const landscape = variant !== 'poster';
  const image = landscape
    ? ((variant === 'episode' ? item.images.primary : null) ??
      item.images.thumb ??
      item.images.backdrop ??
      item.images.primary)
    : item.images.primary;
  const title = cardTitle(item);
  const subtitle = cardSubtitle(t, item);
  const progress = item.userData.progress;
  const unplayed = item.kind === 'series' ? item.userData.unplayedCount : null;

  const content = (
    <>
      <span className={landscape ? `${styles.media} ${styles.landscape}` : styles.media}>
        <JellyImage
          image={image}
          sizes={SIZES[variant]}
          maxWidth={landscape ? 960 : 720}
          fallback={
            <span className={styles.fallback}>
              <Icon name={FALLBACK_ICONS[item.kind]} />
            </span>
          }
        />
        {item.userData.played && (
          <span className={styles.badge} title={t('meta.played')}>
            <Icon name="check" />
            <span className="visually-hidden">{t('meta.played')}</span>
          </span>
        )}
        {!item.userData.played && unplayed !== null && unplayed > 0 && (
          <span className={`${styles.badge} ${styles.count}`}>
            {unplayed}
            <span className="visually-hidden">{t('meta.unplayed', { count: unplayed })}</span>
          </span>
        )}
        {item.userData.favorite && (
          <span className={styles.favorite}>
            <Icon name="heart" filled />
            <span className="visually-hidden">{t('meta.favorite')}</span>
          </span>
        )}
        {progress !== null && (
          <span className={styles.progress}>
            <span
              className={styles.progressValue}
              style={{ transform: `scaleX(${String(progress)})` }}
            />
            <span className="visually-hidden">
              {t('meta.progress', { percent: Math.round(progress * 100) })}
            </span>
          </span>
        )}
      </span>
      <span className={styles.caption}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </>
  );

  if (context === 'preview') {
    return (
      <div className={styles.card} aria-hidden="true">
        {content}
      </div>
    );
  }
  return (
    <AppLink to={linkTo(item)} className={styles.card}>
      {content}
    </AppLink>
  );
}

/** Placeholder with the exact card size while data loads. */
export function MediaCardSkeleton({ variant }: { variant: CardVariant }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <span
        className={`${styles.media} ${variant === 'poster' ? '' : styles.landscape} ${styles.skeleton}`}
      />
      <span className={styles.caption}>
        <span className={`${styles.skeletonLine} ${styles.skeleton}`} />
        <span className={`${styles.skeletonLine} ${styles.short} ${styles.skeleton}`} />
      </span>
    </div>
  );
}
