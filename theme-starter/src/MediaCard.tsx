import {
  AppLink,
  cardSubtitle,
  cardTitle,
  JellyImage,
  linkTo,
  type CardVariant,
  type MediaCardProps,
} from 'jellymorph';
import { useTranslation } from 'react-i18next';
import styles from './MediaCard.module.css';

/** How wide the card is on screen, so the browser picks a fitting picture size. */
const SIZES: Record<CardVariant, string> = {
  poster: '(min-width: 64rem) 15vw, (min-width: 40rem) 24vw, 45vw',
  landscape: '(min-width: 64rem) 24vw, (min-width: 40rem) 40vw, 80vw',
  episode: '(min-width: 64rem) 20vw, 40vw',
};

/**
 * A card with a rounded picture that lifts on hover and focus, and the title below. Classic's
 * rows, grids and search use it too, because they draw their cards through the MediaCard slot.
 */
export function MediaCard({ item, variant }: MediaCardProps) {
  const { t } = useTranslation('content');
  const landscape = variant !== 'poster';
  const image = landscape
    ? (item.images.thumb ?? item.images.backdrop ?? item.images.primary)
    : item.images.primary;
  const subtitle = cardSubtitle(t, item);
  const progress = item.userData.progress;

  return (
    <AppLink to={linkTo(item)} className={styles.card} data-shape={landscape ? 'wide' : 'tall'}>
      <span className={styles.picture}>
        <JellyImage image={image} sizes={SIZES[variant]} maxWidth={landscape ? 960 : 480} />
        {progress !== null && (
          <span className={styles.progress}>
            <span style={{ transform: `scaleX(${String(progress)})` }} />
            <span className="visually-hidden">
              {t('meta.progress', { percent: Math.round(progress * 100) })}
            </span>
          </span>
        )}
      </span>
      <span className={styles.title}>{cardTitle(item)}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </AppLink>
  );
}
