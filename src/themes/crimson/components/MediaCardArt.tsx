import type { MediaItem } from '@/domain/types';
import { JellyImage } from '@/ui/JellyImage';
import type { CardVariant } from '../../contract';
import { Icon } from '../../default/components/icons';
import { cardTitle } from '../../default/components/meta';
import styles from './MediaCardArt.module.css';

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

/**
 * The 16:9 picture of a card. Thumbs usually carry the title already; on a plain backdrop or
 * episode still the title logo (or the title) is laid over it. A red bar shows the progress.
 * Purely visual: the card names title and progress for screen readers.
 */
export function CardArt({
  item,
  variant,
  sizes,
}: {
  item: MediaItem;
  variant: CardVariant;
  sizes: string;
}) {
  const { thumb, backdrop, primary, logo } = item.images;
  const image =
    variant === 'episode' || item.kind === 'episode'
      ? (primary ?? thumb ?? backdrop)
      : (thumb ?? backdrop ?? primary);
  const titled = image !== null && image === thumb && item.kind !== 'episode';
  const progress = item.userData.progress;

  return (
    <span className={styles.art}>
      <JellyImage
        image={image}
        sizes={sizes}
        maxWidth={960}
        fallback={
          <span className={styles.fallback}>
            <Icon name={FALLBACK_ICONS[item.kind]} />
          </span>
        }
      />
      {!titled && (
        <span className={styles.title} aria-hidden="true">
          {logo && item.kind !== 'episode' ? (
            <span className={styles.logo}>
              <JellyImage image={logo} sizes="12rem" maxWidth={480} fit="contain" />
            </span>
          ) : (
            <span className={styles.titleText}>{cardTitle(item)}</span>
          )}
        </span>
      )}
      {progress !== null && (
        <span className={styles.progress} aria-hidden="true">
          <span style={{ transform: `scaleX(${String(progress)})` }} />
        </span>
      )}
    </span>
  );
}
