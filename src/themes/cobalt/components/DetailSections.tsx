import { useId, type ReactNode } from 'react';
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

/** "More like this" as a poster row; left out when there is nothing similar. */
export function RelatedRow({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('theme-cobalt');
  if (items.status === 'success' && items.data.length === 0) return null;
  return (
    <ThemeSlot
      name="Row"
      props={{
        title: t('detail.related'),
        items,
        variant: 'poster',
        seeAll: null,
        context: 'page',
      }}
    />
  );
}

/** One episode per row: the still plays it, the title opens its own page. */
function EpisodeList({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const { t: tCobalt } = useTranslation('theme-cobalt');
  const actions = useMediaActions();
  return (
    <ol className={styles.episodes}>
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
                sizes="(min-width: 64rem) 20rem, 40vw"
                maxWidth={640}
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
            <div className={styles.episodeText}>
              <p className={styles.episodeMeta}>
                {number !== null && number !== undefined && (
                  <span className={styles.episodeNumber}>
                    {tCobalt('detail.episode', { number })}
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Seasons as a pill-shaped picker above the list of episodes. */
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
  const selectId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.episodesHeader}>
        <h2 id={headingId} className={styles.heading}>
          {t('detail.episodes')}
        </h2>
        {seasons.status === 'success' && seasons.data.length > 1 && (
          <span className={styles.seasonPill}>
            <label htmlFor={selectId} className="visually-hidden">
              {t('detail.seasons')}
            </label>
            <select
              id={selectId}
              value={selectedSeasonId ?? ''}
              onChange={(event) => {
                onSelectSeason(event.target.value);
              }}
            >
              {seasons.data.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" className={styles.selectIcon} />
          </span>
        )}
      </div>
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
        <EpisodeList episodes={episodes.data} nextUpId={nextUpId} />
      )}
    </section>
  );
}

/** Facts in columns, then the cast with links to their titles, as arranged in `facts`. */
export function DetailsSection({ item, facts }: { item: ItemDetail; facts: readonly FactId[] }) {
  const { t, i18n } = useTranslation('content');
  const { t: tCobalt } = useTranslation('theme-cobalt');
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
    genres: [tCobalt('detail.genres'), item.genres.join(', ') || null],
    year: [tCobalt('detail.released'), released],
    runtime: [
      tCobalt('detail.runtime'),
      item.kind === 'series' ? null : runtimeText(t, item.runtimeMinutes),
    ],
    officialRating: [tCobalt('detail.rated'), item.officialRating],
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
        {tCobalt('detail.details')}
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
