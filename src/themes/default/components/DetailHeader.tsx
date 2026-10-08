import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CastMember, ItemDetail, MediaItem, MediaTrack } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import { Button } from './Button';
import styles from './DetailHeader.module.css';
import { Icon } from './icons';
import { MetaLine } from './MetaLine';

function trackList(tracks: MediaTrack[]): string {
  return tracks.map((track) => track.title).join(' · ');
}

/** "Play", or "Resume from …" plus "Start over" for a started video. */
export function PlayActions({ item }: { item: Pick<MediaItem, 'id' | 'kind' | 'userData'> }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  if (!isPlayable(item) || item.kind === 'series') return null;
  const position = item.userData.positionTicks / 10_000_000;
  const resumable = position >= 1 && !item.userData.played;
  const prepare = {
    onFocus: actions.preparePlayback,
    onPointerEnter: actions.preparePlayback,
  };
  return resumable ? (
    <>
      <Button
        size="lg"
        icon={<Icon name="play" filled />}
        {...prepare}
        onClick={() => {
          actions.play(item, 'resume');
        }}
      >
        {t('actions.resumeFrom', { time: formatClock(position) })}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        icon={<Icon name="refresh" />}
        {...prepare}
        onClick={() => {
          actions.play(item, 'beginning');
        }}
      >
        {t('actions.restart')}
      </Button>
    </>
  ) : (
    <Button
      size="lg"
      icon={<Icon name="play" filled />}
      {...prepare}
      onClick={() => {
        actions.play(item, 'beginning');
      }}
    >
      {t('actions.play')}
    </Button>
  );
}

/** Backdrop, poster, title/logo, metadata, overview, actions and technical details. */
export function DetailHeader({ item, children }: { item: ItemDetail; children?: ReactNode }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop;
  const isEpisode = item.kind === 'episode' && item.episode;
  const directors = item.cast
    .filter((member) => member.kind === 'director')
    .map((member) => member.name);

  return (
    <div className={styles.header}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="100vw" priority />
        <div className={styles.scrim} />
      </div>
      <div className={styles.layout}>
        <div
          className={item.kind === 'episode' ? `${styles.poster} ${styles.wide}` : styles.poster}
        >
          <JellyImage
            image={item.images.primary}
            sizes="(min-width: 64rem) 18rem, 40vw"
            maxWidth={960}
            priority
            fallback={<span className={styles.posterFallback} />}
          />
        </div>
        <div className={styles.info}>
          {isEpisode && item.episode && (
            <AppLink to={paths.item(item.episode.seriesId)} className={styles.parentLink}>
              <Icon name="chevronLeft" />
              {item.episode.seriesName}
            </AppLink>
          )}
          {item.images.logo && item.kind !== 'episode' ? (
            <h1 className={styles.logo}>
              <JellyImage
                image={item.images.logo}
                sizes="(min-width: 64rem) 30rem, 80vw"
                maxWidth={960}
                fit="contain"
                priority
              />
              <span className="visually-hidden">{item.name}</span>
            </h1>
          ) : (
            <h1 className={styles.title}>{item.name}</h1>
          )}
          <MetaLine item={item} extra={item.videoLabel} />
          {item.genres.length > 0 && <p className={styles.genres}>{item.genres.join(' · ')}</p>}
          {item.tagline && <p className={styles.tagline}>{item.tagline}</p>}
          {item.overview && <p className={styles.overview}>{item.overview}</p>}
          <div className={styles.actions}>
            <PlayActions item={item} />
            {children}
            {item.localTrailerCount > 0 && (
              <Button
                variant="secondary"
                size="lg"
                icon={<Icon name="videos" />}
                onFocus={actions.preparePlayback}
                onPointerEnter={actions.preparePlayback}
                onClick={() => {
                  actions.playTrailer(item);
                }}
              >
                {t('actions.trailer')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              icon={<Icon name="heart" filled={item.userData.favorite} />}
              aria-pressed={item.userData.favorite}
              onClick={() => {
                actions.toggleFavorite(item);
              }}
            >
              {item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Icon name="check" />}
              aria-pressed={item.userData.played}
              onClick={() => {
                actions.togglePlayed(item);
              }}
            >
              {item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')}
            </Button>
          </div>
          <dl className={styles.facts}>
            {directors.length > 0 && (
              <div>
                <dt>{t('detail.director', { count: directors.length })}</dt>
                <dd>{directors.join(', ')}</dd>
              </div>
            )}
            {item.audioTracks.length > 0 && (
              <div>
                <dt>{t('detail.audio')}</dt>
                <dd>{trackList(item.audioTracks)}</dd>
              </div>
            )}
            {(item.audioTracks.length > 0 || item.subtitleTracks.length > 0) && (
              <div>
                <dt>{t('detail.subtitles')}</dt>
                <dd>
                  {item.subtitleTracks.length > 0
                    ? trackList(item.subtitleTracks)
                    : t('detail.none')}
                </dd>
              </div>
            )}
            {item.studios.length > 0 && (
              <div>
                <dt>{t('detail.studios')}</dt>
                <dd>{item.studios.join(', ')}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

/** Horizontal list of cast members linking to their filmography. */
export function CastList({ cast }: { cast: CastMember[] }) {
  const { t } = useTranslation('content');
  const headingId = useId();
  const people = cast.filter((member) => member.kind === 'actor').slice(0, 20);
  if (people.length === 0) return null;
  return (
    <section className={styles.cast} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {t('detail.cast')}
      </h2>
      <ul className={styles.castList}>
        {people.map((person) => (
          <li key={`${person.id}-${person.role ?? ''}`}>
            <AppLink to={paths.person(person.id)} className={styles.person}>
              <span className={styles.personImage}>
                <JellyImage
                  image={person.image}
                  sizes="8rem"
                  maxWidth={360}
                  fallback={
                    <span className={styles.personFallback}>
                      <Icon name="user" />
                    </span>
                  }
                />
              </span>
              <span className={styles.personName}>{person.name}</span>
              {person.role && <span className={styles.personRole}>{person.role}</span>}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className={styles.header} aria-busy="true">
      <div className={`${styles.backdrop} ${styles.skeletonBackdrop}`} />
      <div className={styles.layout}>
        <div className={`${styles.poster} ${styles.skeletonBlock}`} />
        <div className={styles.info}>
          <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonLine} />
          <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
        </div>
      </div>
    </div>
  );
}
