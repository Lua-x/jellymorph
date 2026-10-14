import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, MediaItem, QueryResult, Season } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { useThemeComponent } from '../../context';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';
import { Track, TrackSlot } from './Track';
import { TrackList } from '../../default/components/Expandable';

/** A titled part of a details page; `tools` stand next to the title (the season choice). */
function Section({
  title,
  tools,
  className,
  children,
}: {
  title: string;
  tools?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <header className={styles.sectionHeader}>
        <h2 id={headingId} className={styles.sectionTitle}>
          {title}
        </h2>
        {tools}
      </header>
      {children}
    </section>
  );
}

/** Episodes side by side: the still plays one, the title opens its own page. */
function EpisodeTrack({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const { t: tTheme } = useTranslation('theme-constellation');
  const actions = useMediaActions();
  return (
    <Track
      count={episodes.length}
      interactive
      startAt={nextUpId ? '[data-next]' : undefined}
      className={styles.episodeTrack}
    >
      {episodes.map((episode) => {
        const number = episode.episode?.episodeNumber;
        const progress = episode.userData.progress;
        const next = episode.id === nextUpId;
        const runtime = runtimeText(t, episode.runtimeMinutes);
        return (
          <TrackSlot key={episode.id} className={styles.episode} data-next={next || undefined}>
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
              <span className={styles.stillFrame}>
                <JellyImage
                  image={episode.images.primary ?? episode.images.thumb}
                  sizes="(min-width: 64rem) 22vw, (min-width: 40rem) 40vw, 75vw"
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
              </span>
            </button>
            <p className={styles.episodeMeta}>
              {number !== null && number !== undefined && (
                <span>{tTheme('detail.episode', { number })}</span>
              )}
              {runtime && <span>{runtime}</span>}
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
          </TrackSlot>
        );
      })}
    </Track>
  );
}

/** The season choice (when there are several) and the episodes of the chosen season. */
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
  const selectId = useId();
  const seasonSelect = seasons.status === 'success' && seasons.data.length > 1 && (
    <span className={styles.seasonSelect}>
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
  );
  return (
    <Section title={t('detail.episodes')} tools={seasonSelect}>
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
        <EpisodeTrack episodes={episodes.data} nextUpId={nextUpId} />
      )}
    </Section>
  );
}

/** Suggestions as a row of the rounded cards; left out when there are none. */
export function SuggestionsSection({ items }: { items: QueryResult<MediaItem[]> }) {
  const { t } = useTranslation('theme-constellation');
  const MediaCard = useThemeComponent('MediaCard');
  if (items.status === 'success' && items.data.length === 0) return null;
  return (
    <Section title={t('detail.suggestions')} className={styles.suggestions}>
      {items.status === 'pending' && <LoadingState variant="section" />}
      {items.status === 'error' && (
        <ErrorState variant="section" error={items.error} onRetry={items.retry} />
      )}
      {items.status === 'success' && (
        <Track count={items.data.length} interactive>
          {items.data.slice(0, 18).map((item) => (
            <TrackSlot key={item.id}>
              <MediaCard item={item} variant="landscape" context="page" />
            </TrackSlot>
          ))}
        </Track>
      )}
    </Section>
  );
}

/** The whole description, facts in a list and the cast with links to their titles. */
export function DetailsSection({ item }: { item: ItemDetail }) {
  const { t, i18n } = useTranslation('content');
  const { t: tTheme } = useTranslation('theme-constellation');
  const directors = item.cast.filter((member) => member.kind === 'director');
  const actors = item.cast.filter((member) => member.kind === 'actor');
  const released = item.premiereDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
        new Date(item.premiereDate),
      )
    : item.year !== null
      ? String(item.year)
      : null;
  const rows: [string, ReactNode][] = [
    [tTheme('detail.genres'), item.genres.join(', ') || null],
    [tTheme('detail.released'), released],
    [tTheme('detail.runtime'), item.kind === 'series' ? null : runtimeText(t, item.runtimeMinutes)],
    [tTheme('detail.rated'), item.officialRating],
    [
      t('detail.director', { count: directors.length }),
      directors.map((person) => person.name).join(', ') || null,
    ],
    [t('detail.studios'), item.studios.join(', ') || null],
    [
      t('detail.audio'),
      item.audioTracks.length > 0 ? <TrackList tracks={item.audioTracks} /> : null,
    ],
    [
      t('detail.subtitles'),
      item.subtitleTracks.length > 0 ? <TrackList tracks={item.subtitleTracks} /> : null,
    ],
  ];
  const shown = rows.filter(([, value]) => value !== null && value !== '');
  return (
    <Section title={tTheme('detail.details')}>
      <div className={styles.details}>
        <div className={styles.about}>
          <p className={styles.aboutTitle}>{item.name}</p>
          {item.overview && <p className={styles.aboutText}>{item.overview}</p>}
        </div>
        <dl className={styles.facts}>
          {shown.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {actors.length > 0 && (
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
    </Section>
  );
}
