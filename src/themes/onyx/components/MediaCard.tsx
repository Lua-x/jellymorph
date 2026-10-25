import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { CardVariant, MediaCardProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { cardSubtitle, cardTitle, episodeCode } from '../../default/components/meta';
import styles from './MediaCard.module.css';

const SIZES: Record<CardVariant, string> = {
  poster: '(min-width: 120rem) 9vw, (min-width: 64rem) 12vw, (min-width: 40rem) 22vw, 40vw',
  landscape: '(min-width: 120rem) 16vw, (min-width: 64rem) 21vw, (min-width: 40rem) 40vw, 75vw',
  episode: '(min-width: 64rem) 24vw, 60vw',
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

/** "Airs Wed, Oct 29 · S2 · E11" for episodes that have no file yet. */
function upcomingText(
  t: TFunction<'content'>,
  tOnyx: TFunction<'theme-onyx'>,
  language: string,
  item: MediaItem,
): string | null {
  if (item.available || !item.premiereDate) return null;
  const date = new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(item.premiereDate));
  return [tOnyx('card.airs', { date }), episodeCode(t, item)].filter(Boolean).join(' · ');
}

/**
 * Landscape cards with the title below, the way the rows read like an editorial page. Posters
 * appear in the ranked row. Hover and focus: a white frame and a slight enlargement.
 */
export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const { t: tOnyx, i18n } = useTranslation('theme-onyx');
  const poster = variant === 'poster';
  const image = poster
    ? (item.images.primary ?? item.images.thumb)
    : ((variant === 'episode' ? item.images.primary : null) ??
      item.images.thumb ??
      item.images.backdrop ??
      item.images.primary);
  const title = cardTitle(item);
  const subtitle = upcomingText(t, tOnyx, i18n.language, item) ?? cardSubtitle(t, item);
  const progress = item.userData.progress;
  const unplayed = item.kind === 'series' ? item.userData.unplayedCount : null;

  const content = (
    <>
      <span className={styles.media} data-shape={poster ? 'poster' : 'landscape'}>
        <JellyImage
          image={image}
          sizes={SIZES[variant]}
          maxWidth={poster ? 720 : 960}
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
        {!item.available && <span className={styles.soon}>{tOnyx('card.soon')}</span>}
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
        <span className={styles.title}>
          {item.userData.favorite && (
            <span className={styles.favorite}>
              <Icon name="heart" filled />
              <span className="visually-hidden">{t('meta.favorite')}</span>
            </span>
          )}
          {title}
        </span>
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
        className={`${styles.media} ${styles.skeleton}`}
        data-shape={variant === 'poster' ? 'poster' : 'landscape'}
      />
      <span className={styles.caption}>
        <span className={`${styles.skeletonLine} ${styles.skeleton}`} />
        <span className={`${styles.skeletonLine} ${styles.short} ${styles.skeleton}`} />
      </span>
    </div>
  );
}
