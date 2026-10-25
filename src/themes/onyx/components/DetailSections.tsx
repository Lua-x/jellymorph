import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FactId } from '@/domain/layout';
import type { ItemDetail, MediaItem, QueryResult, Season } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import { ShortList, TrackList } from '../../default/components/Expandable';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';

/** ←/→ move between the entries of a row; the list itself never takes focus. */
function onTrackKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const slot = (event.target as HTMLElement).closest('li');
  const sibling =
    event.key === 'ArrowRight' ? slot?.nextElementSibling : slot?.previousElementSibling;
  const target = sibling?.querySelector<HTMLElement>('a, button');
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** "More like this" as a row of landscape cards; left out when there is nothing similar. */
export function RelatedRow({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('theme-onyx');
  if (items.status === 'success' && items.data.length === 0) return null;
  return (
    <ThemeSlot
      name="Row"
      props={{
        title: t('detail.related'),
        items,
        variant: 'landscape',
        seeAll: null,
        context: 'page',
      }}
    />
  );
}

/** Local trailers as a picture to play, under "Extras"; left out without any. */
export function ExtrasSection({ item }: { item: ItemDetail }) {
  const { t } = useTranslation('content');
  const { t: tOnyx } = useTranslation('theme-onyx');
  const actions = useMediaActions();
  const headingId = useId();
  if (item.localTrailerCount === 0) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {tOnyx('detail.extras')}
      </h2>
      <ul className={styles.extras}>
        <li>
          <button
            type="button"
            className={styles.extra}
            onFocus={actions.preparePlayback}
            onPointerEnter={actions.preparePlayback}
            onClick={() => {
              actions.playTrailer(item);
            }}
          >
            <span className={styles.extraPicture}>
              <JellyImage
                image={item.backdrops[1] ?? item.images.backdrop ?? item.images.thumb}
                sizes="(min-width: 64rem) 22vw, 70vw"
                maxWidth={960}
              />
              <span className={styles.stillPlay} aria-hidden="true">
                <Icon name="play" filled />
              </span>
            </span>
            <span className={styles.extraLabel}>{t('actions.trailer')}</span>
          </button>
        </li>
      </ul>
    </section>
  );
}

/** Seasons as chips; the chosen one is pressed. */
function SeasonChips({
  seasons,
  selectedSeasonId,
  onSelectSeason,
}: {
  seasons: Season[];
  selectedSeasonId: string | null;
  onSelectSeason: (id: string) => void;
}) {
  const { t } = useTranslation('content');
  return (
    <div className={styles.chips} role="group" aria-label={t('detail.seasons')}>
      {seasons.map((season) => (
        <button
          key={season.id}
          type="button"
          className={styles.chip}
          aria-pressed={season.id === selectedSeasonId}
          onClick={() => {
            onSelectSeason(season.id);
          }}
        >
          {season.name}
        </button>
      ))}
    </div>
  );
}

/** Episodes as a sideways row of large stills; the next one is scrolled into view. */
function EpisodeRow({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const { t: tOnyx } = useTranslation('theme-onyx');
  const actions = useMediaActions();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const next = list?.querySelector<HTMLElement>('[data-next]');
    if (!list || !next) return;
    // Only the row scrolls (never the window), so the page stays where it is.
    list.scrollLeft =
      next.offsetLeft - list.offsetLeft - parseFloat(getComputedStyle(list).paddingLeft);
  }, [episodes, nextUpId]);

  return (
    <div className={styles.episodesViewport}>
      {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- keyboard delegation */}
      <ol ref={listRef} className={styles.episodes} onKeyDown={onTrackKeyDown}>
        {episodes.map((episode) => {
          const number = episode.episode?.episodeNumber;
          const progress = episode.userData.progress;
          const next = episode.id === nextUpId;
          return (
            <li key={episode.id} className={styles.episode} data-next={next || undefined}>
              <button
                type="button"
                className={styles.still}
                aria-label={t('actions.playEpisode', { name: episode.name })}
                onFocus={actions.preparePlayback}
                onPointerEnter={actions.preparePlayback}
                onClick={() => {
                  actions.play(episode, 'ask');
                }}
              >
                <JellyImage
                  image={episode.images.primary ?? episode.images.thumb}
                  sizes="(min-width: 64rem) 26vw, 75vw"
                  maxWidth={960}
                />
                <span className={styles.stillPlay} aria-hidden="true">
                  <Icon name="play" filled />
                </span>
                {progress !== null && (
                  <span className={styles.stillProgress} aria-hidden="true">
                    <span style={{ transform: `scaleX(${String(progress)})` }} />
                  </span>
                )}
              </button>
              <p className={styles.episodeMeta}>
                {number !== null && number !== undefined && (
                  <span className={styles.episodeNumber}>
                    {tOnyx('detail.episode', { number })}
                  </span>
                )}
                {runtimeText(t, episode.runtimeMinutes) && (
                  <span>{runtimeText(t, episode.runtimeMinutes)}</span>
                )}
                {next && <span className={styles.nextBadge}>{t('detail.nextUp')}</span>}
                {progress !== null && (
                  <span className="visually-hidden">
                    {t('meta.progress', { percent: Math.round(progress * 100) })}
                  </span>
                )}
                {episode.userData.played && (
                  <span className={styles.played}>
                    <Icon name="check" />
                    {t('meta.played')}
                  </span>
                )}
              </p>
              <AppLink to={paths.item(episode.id)} className={styles.episodeTitle}>
                {episode.name}
              </AppLink>
              {episode.overview && <p className={styles.episodeOverview}>{episode.overview}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The episodes of a season, with the season chips above them. */
export function EpisodesSection({
  seasons,
  selectedSeasonId,
  onSelectSeason,
  episodes,
  nextUpId,
}: {
  seasons: QueryResult<Season[]>;
  selectedSeasonId: string | null;
  onSelectSeason: (id: string) => void;
  episodes: QueryResult<MediaItem[]>;
  nextUpId: string | null;
}) {
  const { t } = useTranslation('content');
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {t('detail.episodes')}
      </h2>
      {seasons.status === 'success' && seasons.data.length > 1 && (
        <SeasonChips
          seasons={seasons.data}
          selectedSeasonId={selectedSeasonId}
          onSelectSeason={onSelectSeason}
        />
      )}
      {seasons.status === 'pending' && <LoadingState variant="section" />}
      {seasons.status === 'error' && (
        <ErrorState variant="section" error={seasons.error} onRetry={seasons.retry} />
      )}
      {episodes.status === 'pending' && seasons.status !== 'error' && (
        <LoadingState variant="section" />
      )}
      {episodes.status === 'error' && (
        <ErrorState variant="section" error={episodes.error} onRetry={episodes.retry} />
      )}
      {episodes.status === 'success' && episodes.data.length === 0 && (
        <EmptyState title={t('detail.noEpisodes')} />
      )}
      {episodes.status === 'success' && episodes.data.length > 0 && (
        <EpisodeRow episodes={episodes.data} nextUpId={nextUpId} />
      )}
    </section>
  );
}

/** Facts in columns, then the cast with links to their titles, as arranged in `facts`. */
export function DetailsSection({ item, facts }: { item: ItemDetail; facts: readonly FactId[] }) {
  const { t, i18n } = useTranslation('content');
  const { t: tOnyx } = useTranslation('theme-onyx');
  const headingId = useId();
  const directors = item.cast.filter((member) => member.kind === 'director');
  const actors = item.cast.filter((member) => member.kind === 'actor');
  const released = item.premiereDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
        new Date(item.premiereDate),
      )
    : item.year !== null
      ? String(item.year)
      : null;
  const rows: Partial<Record<FactId, [string, ReactNode]>> = {
    genres: [tOnyx('detail.genres'), item.genres.join(', ') || null],
    year: [tOnyx('detail.released'), released],
    runtime: [
      tOnyx('detail.runtime'),
      item.kind === 'series' ? null : runtimeText(t, item.runtimeMinutes),
    ],
    officialRating: [tOnyx('detail.rated'), item.officialRating],
    directors: [
      t('detail.director', { count: directors.length }),
      directors.length > 0 ? <ShortList entries={directors.map((person) => person.name)} /> : null,
    ],
    studios: [
      t('detail.studios'),
      item.studios.length > 0 ? <ShortList entries={item.studios} /> : null,
    ],
    audio: [
      t('detail.audio'),
      item.audioTracks.length > 0 ? <TrackList tracks={item.audioTracks} /> : null,
    ],
    subtitles: [
      t('detail.subtitles'),
      item.subtitleTracks.length > 0 ? <TrackList tracks={item.subtitleTracks} /> : null,
    ],
  };
  const shown = facts
    .map((id) => rows[id])
    .filter((row): row is [string, ReactNode] => !!row && row[1] !== null && row[1] !== '');
  const cast = facts.includes('cast') && actors.length > 0;
  if (shown.length === 0 && !cast) return null;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {tOnyx('detail.details')}
      </h2>
      <div className={styles.details}>
        <dl className={styles.facts}>
          {shown.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {cast && (
          <div className={styles.cast}>
            <h3 className={styles.subheading}>{t('detail.cast')}</h3>
            <ul>
              {actors.slice(0, 20).map((person) => (
                <li key={`${person.id}-${person.role ?? ''}`}>
                  <AppLink to={paths.person(person.id)} className={styles.person}>
                    {person.name}
                  </AppLink>
                  {person.role && <span className={styles.role}>{person.role}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
