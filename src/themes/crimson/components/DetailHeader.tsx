import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, MediaItem, MediaTrack } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import { Icon } from '../../default/components/icons';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';
import { CrimsonButton } from './CrimsonButton';
import styles from './DetailHeader.module.css';

function trackList(tracks: MediaTrack[]): string {
  return tracks.map((track) => track.title).join(', ');
}

/** "Play" or "Resume", plus "Start over" for a started video. */
function PlayButtons({ item }: { item: Pick<MediaItem, 'id' | 'kind' | 'userData'> }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  if (!isPlayable(item) || item.kind === 'series') return null;
  const position = item.userData.positionTicks / 10_000_000;
  const resumable = position >= 1 && !item.userData.played;
  const prepare = { onFocus: actions.preparePlayback, onPointerEnter: actions.preparePlayback };
  return (
    <>
      <CrimsonButton
        variant="light"
        size="lg"
        icon={<Icon name="play" filled />}
        data-autofocus
        {...prepare}
        onClick={() => {
          actions.play(item, resumable ? 'resume' : 'beginning');
        }}
      >
        {resumable ? t('actions.resumeFrom', { time: formatClock(position) }) : t('actions.play')}
      </CrimsonButton>
      {resumable && (
        <CrimsonButton
          variant="round"
          size="lg"
          aria-label={t('actions.restart')}
          icon={<Icon name="refresh" />}
          {...prepare}
          onClick={() => {
            actions.play(item, 'beginning');
          }}
        />
      )}
    </>
  );
}

/**
 * Top of the details: wide picture with title logo and actions, then the facts in two columns
 * (description left; cast, genres, director and tracks right). `actions` adds e.g. the next
 * episode of a series.
 */
export function DetailHeader({
  item,
  headingId,
  actions: extraActions,
}: {
  item: ItemDetail;
  headingId: string;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation('content');
  const { t: tCrimson } = useTranslation('theme-crimson');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop ?? item.images.primary;
  const rating = ratingText(i18n.language, item.communityRating);
  const actors = item.cast.filter((member) => member.kind === 'actor').slice(0, 6);
  const directors = item.cast.filter((member) => member.kind === 'director');
  const facts = [
    item.kind === 'episode' ? episodeCode(t, item) : null,
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <>
      <div className={styles.media}>
        <JellyImage image={backdrop} sizes="(min-width: 64rem) 60rem, 100vw" priority />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.titleBlock}>
          {item.kind === 'episode' && item.episode && (
            <AppLink to={paths.item(item.episode.seriesId)} overlay className={styles.parent}>
              {item.episode.seriesName}
            </AppLink>
          )}
          {item.images.logo && item.kind !== 'episode' ? (
            <h1 id={headingId} className={styles.logo}>
              <JellyImage
                image={item.images.logo}
                sizes="(min-width: 64rem) 24rem, 60vw"
                maxWidth={960}
                fit="contain"
                priority
              />
              <span className="visually-hidden">{item.name}</span>
            </h1>
          ) : (
            <h1 id={headingId} className={styles.title}>
              {item.name}
            </h1>
          )}
          <div className={styles.actions}>
            <PlayButtons item={item} />
            {extraActions}
            <CrimsonButton
              variant="round"
              size="lg"
              aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
              aria-pressed={item.userData.favorite}
              icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
              onClick={() => {
                actions.toggleFavorite(item);
              }}
            />
            <CrimsonButton
              variant="round"
              size="lg"
              aria-label={
                item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')
              }
              aria-pressed={item.userData.played}
              icon={<Icon name="eye" />}
              onClick={() => {
                actions.togglePlayed(item);
              }}
            />
            {item.localTrailerCount > 0 && (
              <CrimsonButton
                variant="round"
                size="lg"
                aria-label={t('actions.trailer')}
                icon={<Icon name="videos" />}
                onFocus={actions.preparePlayback}
                onPointerEnter={actions.preparePlayback}
                onClick={() => {
                  actions.playTrailer(item);
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className={styles.facts}>
        <div className={styles.main}>
          <p className={styles.line}>
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
            {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
            {item.videoLabel && <span className={styles.badge}>{item.videoLabel}</span>}
            {rating && (
              <span className={styles.score}>
                <Icon name="star" filled />
                <span className="visually-hidden">{t('meta.rating')}</span>
                {rating}
              </span>
            )}
          </p>
          {item.tagline && <p className={styles.tagline}>{item.tagline}</p>}
          {item.overview && <p className={styles.overview}>{item.overview}</p>}
        </div>
        <dl className={styles.side}>
          {actors.length > 0 && (
            <div>
              <dt>{tCrimson('detail.cast')}</dt>
              <dd>
                {actors.map((person, index) => (
                  <span key={`${person.id}-${person.role ?? ''}`}>
                    {index > 0 && ', '}
                    <AppLink to={paths.person(person.id)} className={styles.person}>
                      {person.name}
                    </AppLink>
                  </span>
                ))}
              </dd>
            </div>
          )}
          {item.genres.length > 0 && (
            <div>
              <dt>{tCrimson('detail.genres')}</dt>
              <dd>{item.genres.join(', ')}</dd>
            </div>
          )}
          {directors.length > 0 && (
            <div>
              <dt>{tCrimson('detail.director')}</dt>
              <dd>{directors.map((person) => person.name).join(', ')}</dd>
            </div>
          )}
          {item.audioTracks.length > 0 && (
            <div>
              <dt>{tCrimson('detail.audio')}</dt>
              <dd>{trackList(item.audioTracks)}</dd>
            </div>
          )}
          {item.subtitleTracks.length > 0 && (
            <div>
              <dt>{tCrimson('detail.subtitles')}</dt>
              <dd>{trackList(item.subtitleTracks)}</dd>
            </div>
          )}
        </dl>
      </div>
    </>
  );
}
