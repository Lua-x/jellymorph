import { useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, Season } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { ThemeSlot } from '../../ThemeSlot';
import type { SeriesPageProps } from '../../contract';
import { CastList, DetailHeader } from './DetailHeader';
import { Icon } from './icons';
import { runtimeText } from './meta';
import styles from './SeriesPage.module.css';
import { EmptyState, ErrorState, LoadingState } from './States';

function SeasonTabs({
  seasons,
  selectedId,
  onSelect,
  panelId,
}: {
  seasons: Season[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  panelId: string;
}) {
  const { t } = useTranslation('content');
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern with automatic activation).
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = seasons.findIndex((season) => season.id === selectedId);
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let next: number | null = null;
    if (event.key in offsets)
      next = (index + (offsets[event.key] ?? 0) + seasons.length) % seasons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = seasons.length - 1;
    const season = next === null ? undefined : seasons[next];
    if (!season) return;
    event.preventDefault();
    onSelect(season.id);
    listRef.current?.querySelector<HTMLElement>(`[data-season="${season.id}"]`)?.focus();
  };

  return (
    <div ref={listRef} className={styles.tabs} role="tablist" aria-label={t('detail.seasons')}>
      {seasons.map((season) => {
        const selected = season.id === selectedId;
        return (
          <button
            key={season.id}
            type="button"
            role="tab"
            data-season={season.id}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onKeyDown={onKeyDown}
            onClick={() => {
              onSelect(season.id);
            }}
          >
            {season.name}
            {season.played && <Icon name="check" className={styles.tabCheck} />}
          </button>
        );
      })}
    </div>
  );
}

function EpisodeList({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  return (
    <ol className={styles.episodes}>
      {episodes.map((episode) => {
        const isNext = episode.id === nextUpId;
        const number = episode.episode?.episodeNumber;
        const progress = episode.userData.progress;
        return (
          <li
            key={episode.id}
            className={isNext ? `${styles.episode} ${styles.next}` : styles.episode}
          >
            <AppLink to={paths.item(episode.id)} className={styles.episodeLink}>
              <span className={styles.still}>
                <JellyImage
                  image={episode.images.primary}
                  sizes="(min-width: 64rem) 16rem, 40vw"
                  maxWidth={640}
                />
                {progress !== null && (
                  <span className={styles.progress}>
                    <span style={{ transform: `scaleX(${String(progress)})` }} />
                  </span>
                )}
              </span>
              <span className={styles.episodeText}>
                <span className={styles.episodeTitle}>
                  {number !== null && number !== undefined ? `${String(number)}. ` : ''}
                  {episode.name}
                </span>
                <span className={styles.episodeMeta}>
                  {[runtimeText(t, episode.runtimeMinutes), episode.year]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {episode.overview && (
                  <span className={styles.episodeOverview}>{episode.overview}</span>
                )}
                {isNext && <span className={styles.nextBadge}>{t('detail.nextUp')}</span>}
              </span>
            </AppLink>
            <button
              type="button"
              className={styles.episodePlay}
              aria-label={t('actions.playEpisode', { name: episode.name })}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(episode, 'ask');
              }}
            >
              <span className={styles.episodePlayIcon}>
                <Icon name="play" filled />
              </span>
            </button>
            <button
              type="button"
              className={styles.played}
              aria-pressed={episode.userData.played}
              aria-label={
                episode.userData.played
                  ? t('detail.markEpisodeUnplayed', { name: episode.name })
                  : t('detail.markEpisodePlayed', { name: episode.name })
              }
              onClick={() => {
                actions.togglePlayed(episode);
              }}
            >
              <Icon name="check" />
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
}: SeriesPageProps) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const panelId = useId();
  const headingId = useId();
  const next = nextUp.status === 'success' ? nextUp.data : null;

  return (
    <article className={styles.page}>
      <DetailHeader item={series}>
        {nextUp.status === 'success' && (
          <button
            type="button"
            className={styles.nextLink}
            onFocus={actions.preparePlayback}
            onPointerEnter={actions.preparePlayback}
            onClick={() => {
              if (next)
                actions.play(next, next.userData.progress !== null ? 'resume' : 'beginning');
              else actions.play(series, 'ask');
            }}
          >
            <Icon name="play" filled />
            <span>
              <span className={styles.nextLabel}>
                {next && next.userData.progress !== null ? t('detail.resume') : t('actions.play')}
              </span>{' '}
              <span className={styles.nextName}>
                {next
                  ? t('detail.episodeShort', {
                      season: next.episode?.seasonNumber ?? 0,
                      episode: next.episode?.episodeNumber ?? 0,
                      name: next.name,
                    })
                  : t('detail.startSeries')}
              </span>
            </span>
          </button>
        )}
      </DetailHeader>

      <section className={styles.seasons} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.sectionTitle}>
          {t('detail.episodes')}
        </h2>
        {seasons.status === 'pending' && <LoadingState variant="section" />}
        {seasons.status === 'error' && (
          <ErrorState variant="section" error={seasons.error} onRetry={seasons.retry} />
        )}
        {seasons.status === 'success' && seasons.data.length > 1 && (
          <SeasonTabs
            seasons={seasons.data}
            selectedId={selectedSeasonId}
            onSelect={onSelectSeason}
            panelId={panelId}
          />
        )}
        <div
          id={panelId}
          role={seasons.status === 'success' && seasons.data.length > 1 ? 'tabpanel' : undefined}
        >
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
        </div>
      </section>

      <CastList cast={series.cast} />
      {!(similar.status === 'success' && similar.data.length === 0) && (
        <ThemeSlot
          name="Row"
          props={{
            title: t('detail.similar'),
            items: similar,
            variant: 'poster',
            seeAll: null,
            context: 'page',
          }}
        />
      )}
    </article>
  );
}
