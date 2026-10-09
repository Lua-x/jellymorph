import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { CardVariant, MediaCardProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { cardSubtitle, cardTitle } from '../../default/components/meta';
import styles from './MediaCard.module.css';
import { useLift } from './useLift';

type Shape = 'poster' | 'wide';

const SIZES: Record<Shape, string> = {
  poster: '(min-width: 120rem) 12vw, (min-width: 64rem) 16vw, (min-width: 40rem) 24vw, 40vw',
  wide: '(min-width: 120rem) 18vw, (min-width: 64rem) 24vw, (min-width: 40rem) 36vw, 75vw',
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

function shapeOf(item: MediaItem, variant: CardVariant): Shape {
  return variant === 'poster' && item.kind !== 'episode' ? 'poster' : 'wide';
}

function imageOf(item: MediaItem, variant: CardVariant, shape: Shape) {
  const { primary, thumb, backdrop } = item.images;
  if (shape === 'poster') return primary ?? thumb ?? backdrop;
  if (variant === 'episode' || item.kind === 'episode') return primary ?? thumb ?? backdrop;
  return thumb ?? backdrop ?? primary;
}

/**
 * A rounded card with the Glass focus effect (see useLift); the title sits below.
 */
export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const shape = shapeOf(item, variant);
  const title = cardTitle(item);
  const subtitle = cardSubtitle(t, item);
  const progress = item.userData.progress;

  const { handlers, tileStyle, glareStyle } = useLift();

  const tile = (
    <m.span className={styles.tile} style={tileStyle}>
      <span className={styles.shadow} aria-hidden="true" />
      <span className={styles.frame}>
        <JellyImage
          image={imageOf(item, variant, shape)}
          sizes={SIZES[shape]}
          maxWidth={shape === 'poster' ? 720 : 960}
          fallback={
            <span className={styles.fallback}>
              <Icon name={FALLBACK_ICONS[item.kind]} />
            </span>
          }
        />
        <m.span className={styles.glare} style={glareStyle} aria-hidden="true" />
        {item.userData.played && (
          <span className={styles.played} aria-hidden="true">
            <Icon name="check" />
          </span>
        )}
        {progress !== null && (
          <span className={styles.progress} aria-hidden="true">
            <span style={{ transform: `scaleX(${String(progress)})` }} />
          </span>
        )}
      </span>
    </m.span>
  );
  const text = (
    <span className={styles.text}>
      <span className={styles.title}>{title}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {item.userData.played && <span className="visually-hidden">, {t('meta.played')}</span>}
      {progress !== null && (
        <span className="visually-hidden">
          , {t('meta.progress', { percent: Math.round(progress * 100) })}
        </span>
      )}
    </span>
  );

  if (context === 'preview') {
    return (
      <div className={styles.card} data-shape={shape} aria-hidden="true">
        {tile}
        {text}
      </div>
    );
  }
  return (
    <AppLink to={linkTo(item)} className={styles.card} data-shape={shape} {...handlers}>
      {tile}
      {text}
    </AppLink>
  );
}

/** Placeholder with the exact card size while data loads. */
export function MediaCardSkeleton({ shape }: { shape: Shape }) {
  return (
    <div className={styles.card} data-shape={shape} aria-hidden="true">
      <span className={`${styles.tile} ${styles.skeleton}`} />
      <span className={styles.text}>
        <span className={styles.skeletonLine} />
      </span>
    </div>
  );
}
