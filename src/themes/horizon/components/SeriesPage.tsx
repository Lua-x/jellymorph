import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, QueryResult, Season } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { SeriesPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import styles from './Detail.module.css';
import { DetailHeader } from './DetailHeader';
import { DetailTabs, DetailsPanel, RelatedPanel } from './DetailTabs';
import { HorizonButton } from './HorizonButton';

/** One episode per row: the still plays it, the title opens its own page. */
function EpisodeList({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const { t: tHorizon } = useTranslation('theme-horizon');
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
                sizes="(min-width: 64rem) 18rem, 40vw"
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
                  <span>{tHorizon('detail.episode', { number })}</span>
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

function EpisodesPanel({
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
  return (
    <div className={styles.episodesPanel}>
      {seasons.status === 'pending' && <LoadingState variant="section" />}
      {seasons.status === 'error' && (
        <ErrorState variant="section" error={seasons.error} onRetry={seasons.retry} />
      )}
      {seasons.status === 'success' && seasons.data.length > 1 && (
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
    </div>
  );
}

/** A series: the header with "play next", then tabs: episodes, more like this, details. */
export function SeriesPage({
  series,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  episodes,
  nextUp,
  similar,
}: SeriesPageProps) {
  const { t } = useTranslation('content');
  const { t: tHorizon } = useTranslation('theme-horizon');
  const actions = useMediaActions();
  const headingId = useId();
  const next = nextUp.status === 'success' ? nextUp.data : null;

  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailHeader
        item={series}
        headingId={headingId}
        actions={
          nextUp.status === 'success' && (
            <HorizonButton
              variant="primary"
              size="lg"
              icon={<Icon name="play" filled />}
              data-autofocus
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                if (next)
                  actions.play(next, next.userData.progress !== null ? 'resume' : 'beginning');
                else actions.play(series, 'ask');
              }}
            >
              {next && next.userData.progress !== null ? t('detail.resume') : t('actions.play')}
              {next && (
                <span className={styles.nextLabel}>
                  {t('detail.episodeShort', {
                    season: next.episode?.seasonNumber ?? 0,
                    episode: next.episode?.episodeNumber ?? 0,
                    name: next.name,
                  })}
                </span>
              )}
            </HorizonButton>
          )
        }
      />
      <DetailTabs
        tabs={[
          {
            id: 'episodes',
            label: t('detail.episodes'),
            content: (
              <EpisodesPanel
                seasons={seasons}
                selectedSeasonId={selectedSeasonId}
                onSelectSeason={onSelectSeason}
                episodes={episodes}
                nextUpId={next?.id ?? null}
              />
            ),
          },
          {
            id: 'related',
            label: tHorizon('detail.related'),
            content: <RelatedPanel items={similar} />,
          },
          {
            id: 'details',
            label: tHorizon('detail.details'),
            content: <DetailsPanel item={series} />,
          },
        ]}
      />
    </article>
  );
}
