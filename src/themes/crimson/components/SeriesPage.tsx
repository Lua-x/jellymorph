import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { JellyImage } from '@/ui/JellyImage';
import type { SeriesPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import { CrimsonButton } from './CrimsonButton';
import styles from './Detail.module.css';
import { DetailHeader } from './DetailHeader';
import { DetailSheet } from './DetailSheet';
import { MoreLikeThis } from './ItemDetailPage';

/** Episodes inside the details: number, still with play icon, title, runtime, progress. */
function EpisodeList({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  return (
    <ol className={styles.episodes}>
      {episodes.map((episode) => {
        const number = episode.episode?.episodeNumber;
        const progress = episode.userData.progress;
        return (
          <li key={episode.id}>
            <button
              type="button"
              className={styles.episode}
              data-next={episode.id === nextUpId || undefined}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(episode, 'ask');
              }}
            >
              <span className={styles.number} aria-hidden="true">
                {number ?? ''}
              </span>
              <span className={styles.still}>
                <JellyImage
                  image={episode.images.primary}
                  sizes="(min-width: 64rem) 10rem, 30vw"
                  maxWidth={480}
                />
                <span className={styles.stillPlay} aria-hidden="true">
                  <Icon name="play" filled />
                </span>
                {progress !== null && (
                  <span className={styles.stillProgress}>
                    <span style={{ transform: `scaleX(${String(progress)})` }} />
                  </span>
                )}
              </span>
              <span className={styles.episodeText}>
                <span className={styles.episodeHead}>
                  <span className={styles.episodeTitle}>
                    <span className="visually-hidden">
                      {t('actions.playEpisode', { name: episode.name })}
                    </span>
                    <span aria-hidden="true">{episode.name}</span>
                  </span>
                  <span className={styles.episodeRuntime}>
                    {runtimeText(t, episode.runtimeMinutes)}
                  </span>
                </span>
                {episode.overview && (
                  <span className={styles.episodeOverview}>{episode.overview}</span>
                )}
                {episode.id === nextUpId && (
                  <span className={styles.nextBadge}>{t('detail.nextUp')}</span>
                )}
                {progress !== null && (
                  <span className="visually-hidden">
                    {t('meta.progress', { percent: Math.round(progress * 100) })}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SeriesPage({
  series,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  episodes,
  nextUp,
  similar,
  presentation,
  onClose,
}: SeriesPageProps) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const headingId = useId();
  const episodesHeadingId = useId();
  const seasonSelectId = useId();
  const next = nextUp.status === 'success' ? nextUp.data : null;

  return (
    <DetailSheet
      presentation={presentation}
      onClose={onClose}
      labelledBy={headingId}
      returnHref={paths.item(series.id)}
      ready={nextUp.status !== 'pending'}
    >
      <DetailHeader
        item={series}
        headingId={headingId}
        actions={
          nextUp.status === 'success' && (
            <CrimsonButton
              variant="light"
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
            </CrimsonButton>
          )
        }
      />
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={episodesHeadingId}>
          <div className={styles.episodesHeader}>
            <h2 id={episodesHeadingId} className={styles.sectionTitle}>
              {t('detail.episodes')}
            </h2>
            {seasons.status === 'success' && seasons.data.length > 1 && (
              <span className={styles.seasonSelect}>
                <label htmlFor={seasonSelectId} className="visually-hidden">
                  {t('detail.seasons')}
                </label>
                <select
                  id={seasonSelectId}
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
            {seasons.status === 'success' && seasons.data.length === 1 && (
              <span className={styles.singleSeason}>{seasons.data[0]?.name}</span>
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
            <EpisodeList episodes={episodes.data} nextUpId={next?.id ?? null} />
          )}
        </section>
        <MoreLikeThis items={similar} />
      </div>
    </DetailSheet>
  );
}
