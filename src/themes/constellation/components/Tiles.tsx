import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageRef, Library, MediaItem, QueryResult } from '@/domain/types';
import { linkTo, paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ErrorState } from '../../default/components/States';
import styles from './Tiles.module.css';
import { Track, TrackSlot } from './Track';

interface Tile {
  id: string;
  to: string;
  name: string;
  image: ImageRef | null;
  /** The picture already shows the name (Jellyfin generates library pictures with it). */
  titled: boolean;
}

const SKELETON_COUNT = 5;

/**
 * Large tiles for the libraries and the collections, right under the hero. The name stands in
 * the middle of the picture; focus and hover light a glowing frame and lift the tile slightly.
 */
export function Tiles({
  libraries,
  collections,
}: {
  libraries: QueryResult<Library[]>;
  /** The collections row of the home page, when the server has one. */
  collections: QueryResult<MediaItem[]> | null;
}) {
  const { t } = useTranslation('theme-constellation');
  const headingId = useId();
  if (libraries.status === 'error') {
    return <ErrorState variant="section" error={libraries.error} onRetry={libraries.retry} />;
  }
  const pending = libraries.status === 'pending' || collections?.status === 'pending';
  const tiles: Tile[] = [
    ...(libraries.status === 'success'
      ? libraries.data.map((library) => ({
          id: library.id,
          to: paths.library(library.id),
          name: library.name,
          image: library.image,
          titled: library.image !== null,
        }))
      : []),
    ...(collections?.status === 'success'
      ? collections.data.map((item) => ({
          id: item.id,
          to: linkTo(item),
          name: item.name,
          image: item.images.thumb ?? item.images.backdrop ?? item.images.primary,
          titled: false,
        }))
      : []),
  ];
  if (!pending && tiles.length === 0) return null;

  return (
    <section className={styles.tiles} aria-labelledby={headingId}>
      <h2 id={headingId} className="visually-hidden">
        {t('tiles.title')}
      </h2>
      <Track count={tiles.length} interactive={!pending}>
        {pending
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <TrackSlot key={index}>
                <div className={`${styles.tile} ${styles.skeleton}`} aria-hidden="true" />
              </TrackSlot>
            ))
          : tiles.map((tile) => (
              <TrackSlot key={tile.id}>
                <AppLink
                  to={tile.to}
                  className={styles.tile}
                  data-titled={tile.titled || undefined}
                >
                  <span className={styles.frame} aria-hidden="true">
                    <JellyImage
                      image={tile.image}
                      sizes="(min-width: 64rem) 20vw, (min-width: 40rem) 30vw, 45vw"
                      maxWidth={960}
                      fallback={<span className={styles.fallback} />}
                    />
                    <span className={styles.shade} />
                  </span>
                  <span className={tile.titled ? 'visually-hidden' : styles.name}>{tile.name}</span>
                </AppLink>
              </TrackSlot>
            ))}
      </Track>
    </section>
  );
}
