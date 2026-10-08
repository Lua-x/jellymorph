import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CastMember, ItemDetail, MediaItem, MediaTrack } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import { Icon } from '../../default/components/icons';
import { DataFields, FieldGrid } from './DataFields';
import styles from './Dossier.module.css';
import type { DataField } from './itemFields';
import { NeonButton } from './NeonButton';
import { ScrambleText } from './ScrambleText';

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
  const prepare = { onFocus: actions.preparePlayback, onPointerEnter: actions.preparePlayback };
  return resumable ? (
    <>
      <NeonButton
        size="lg"
        icon={<Icon name="play" filled />}
        {...prepare}
        onClick={() => {
          actions.play(item, 'resume');
        }}
      >
        {t('actions.resumeFrom', { time: formatClock(position) })}
      </NeonButton>
      <NeonButton
        variant="secondary"
        size="lg"
        icon={<Icon name="refresh" />}
        {...prepare}
        onClick={() => {
          actions.play(item, 'beginning');
        }}
      >
        {t('actions.restart')}
      </NeonButton>
    </>
  ) : (
    <NeonButton
      size="lg"
      icon={<Icon name="play" filled />}
      {...prepare}
      onClick={() => {
        actions.play(item, 'beginning');
      }}
    >
      {t('actions.play')}
    </NeonButton>
  );
}

/** Technical and credit fields shown below the summary. */
function useDetailFields(item: ItemDetail): DataField[] {
  const { t } = useTranslation('content');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const directors = item.cast.filter((member) => member.kind === 'director').map((m) => m.name);
  const fields: (DataField | null)[] = [
    item.genres.length > 0
      ? { key: 'genres', label: tNeon('data.genres'), value: item.genres.join(' · ') }
      : null,
    item.videoLabel ? { key: 'video', label: tNeon('data.video'), value: item.videoLabel } : null,
    item.seriesStatus
      ? {
          key: 'status',
          label: tNeon('data.status'),
          value:
            item.seriesStatus === 'continuing' ? tNeon('data.continuing') : tNeon('data.ended'),
        }
      : null,
    directors.length > 0
      ? {
          key: 'director',
          label: t('detail.director', { count: directors.length }),
          value: directors.join(', '),
        }
      : null,
    item.audioTracks.length > 0
      ? { key: 'audio', label: t('detail.audio'), value: trackList(item.audioTracks) }
      : null,
    item.audioTracks.length > 0 || item.subtitleTracks.length > 0
      ? {
          key: 'subtitles',
          label: t('detail.subtitles'),
          value: item.subtitleTracks.length > 0 ? trackList(item.subtitleTracks) : t('detail.none'),
        }
      : null,
    item.studios.length > 0
      ? { key: 'studios', label: t('detail.studios'), value: item.studios.join(', ') }
      : null,
  ];
  return fields.filter((field): field is DataField => field !== null);
}

/**
 * Detail header as a dossier: backdrop with scanlines, the poster in a HUD frame, the title,
 * data fields, summary and actions. `children` adds actions (e.g. the next episode).
 */
export function DossierHeader({ item, children }: { item: ItemDetail; children?: ReactNode }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop;
  const extra = useDetailFields(item);

  return (
    <div className={styles.header}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="100vw" priority />
        <span className={styles.scanlines} />
        <div className={styles.scrim} />
      </div>
      <div className={styles.layout}>
        <div
          className={item.kind === 'episode' ? `${styles.poster} ${styles.wide}` : styles.poster}
        >
          <span className={styles.posterImage}>
            <JellyImage
              image={item.images.primary}
              sizes="(min-width: 64rem) 18rem, 40vw"
              maxWidth={960}
              priority
              fallback={<span className={styles.posterFallback} />}
            />
          </span>
        </div>
        <div className={styles.info}>
          {item.kind === 'episode' && item.episode && (
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
            <h1 className={styles.title}>
              <ScrambleText text={item.name} />
            </h1>
          )}
          <DataFields item={item} compact />
          {item.tagline && <p className={styles.tagline}>{item.tagline}</p>}
          {item.overview && <p className={styles.overview}>{item.overview}</p>}
          <div className={styles.actions}>
            <PlayActions item={item} />
            {children}
            {item.localTrailerCount > 0 && (
              <NeonButton
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
              </NeonButton>
            )}
            <NeonButton
              variant="ghost"
              size="lg"
              icon={<Icon name="heart" filled={item.userData.favorite} />}
              aria-pressed={item.userData.favorite}
              onClick={() => {
                actions.toggleFavorite(item);
              }}
            >
              {item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            </NeonButton>
            <NeonButton
              variant="ghost"
              size="lg"
              icon={<Icon name="check" />}
              aria-pressed={item.userData.played}
              onClick={() => {
                actions.togglePlayed(item);
              }}
            >
              {item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')}
            </NeonButton>
          </div>
        </div>
      </div>
      {extra.length > 0 && (
        <div className={styles.facts}>
          <FieldGrid fields={extra} />
        </div>
      )}
    </div>
  );
}

/** Cast as a row of operator cards linking to their filmography. */
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

export function DossierSkeleton() {
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
