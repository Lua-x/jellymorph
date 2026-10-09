import { m } from 'motion/react';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem, Season } from '@/domain/types';
import { useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { SeriesPageProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { runtimeText } from '../../default/components/meta';
import { EmptyState, ErrorState, LoadingState } from '../../default/components/States';
import { CastShelf, InfoPanel, SimilarShelf } from './DetailSections';
import { DetailStage } from './DetailStage';
import { GlassButton } from './GlassButton';
import styles from './SeriesPage.module.css';
import { useLift } from './useLift';

/** Seasons as a segmented pill control (WAI-ARIA tabs, arrow keys move and select). */
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
          </button>
        );
      })}
    </div>
  );
}

/** One episode: the still plays it (with the Glass focus effect), the info button opens it. */
function EpisodeCard({ episode, next }: { episode: MediaItem; next: boolean }) {
  const { t } = useTranslation('content');
  const { t: tGlass } = useTranslation('theme-glass');
  const actions = useMediaActions();
  const { handlers, tileStyle, glareStyle } = useLift();
  const progress = episode.userData.progress;
  const number = episode.episode?.episodeNumber;

  return (
    <div className={styles.episode} data-next={next || undefined}>
      <button
        type="button"
        className={styles.play}
        {...handlers}
        onFocus={(event) => {
          handlers.onFocus(event);
          actions.preparePlayback();
        }}
        onPointerEnter={(event) => {
          handlers.onPointerEnter(event);
          actions.preparePlayback();
        }}
        onClick={() => {
          actions.play(episode, 'ask');
        }}
      >
        <m.span className={styles.tile} style={tileStyle}>
          <span className={styles.shadow} aria-hidden="true" />
          <span className={styles.frame}>
            <JellyImage
              image={episode.images.primary ?? episode.images.thumb}
              sizes="(min-width: 64rem) 22vw, 70vw"
              maxWidth={720}
            />
            <m.span className={styles.glare} style={glareStyle} aria-hidden="true" />
            <span className={styles.playIcon} aria-hidden="true">
              <Icon name="play" filled />
            </span>
            {progress !== null && (
              <span className={styles.progress} aria-hidden="true">
                <span style={{ transform: `scaleX(${String(progress)})` }} />
              </span>
            )}
          </span>
        </m.span>
        <span className="visually-hidden">
          {t('actions.playEpisode', { name: episode.name })}
          {progress !== null && `, ${t('meta.progress', { percent: Math.round(progress * 100) })}`}
          {episode.userData.played && `, ${t('meta.played')}`}
        </span>
      </button>
      <div className={styles.text}>
        <span className={styles.meta} aria-hidden="true">
          {number !== null && number !== undefined && tGlass('detail.episode', { number })}
          {next && <span className={styles.nextBadge}>{t('detail.nextUp')}</span>}
        </span>
        {next && <span className="visually-hidden">{t('detail.nextUp')}</span>}
        <span className={styles.titleRow}>
          <span className={styles.title}>{episode.name}</span>
          <AppLink
            to={paths.item(episode.id)}
            className={styles.info}
            aria-label={tGlass('detail.episodeDetails', { name: episode.name })}
          >
            <Icon name="info" />
          </AppLink>
        </span>
        <span className={styles.runtime}>{runtimeText(t, episode.runtimeMinutes)}</span>
        {episode.overview && <span className={styles.overview}>{episode.overview}</span>}
      </div>
    </div>
  );
}

function EpisodeShelf({ episodes, nextUpId }: { episodes: MediaItem[]; nextUpId: string | null }) {
  const trackRef = useRef<HTMLOListElement>(null);

  // Open on the episode to watch next, without moving the page.
  useEffect(() => {
    const track = trackRef.current;
    const slot = track?.querySelector<HTMLElement>('[data-next]')?.closest('li');
    if (!track || !slot) return;
    // The track is the offset parent of its slots (position: relative).
    track.scrollLeft = slot.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft);
  }, [episodes, nextUpId]);

  return (
    <ol ref={trackRef} className={styles.shelf}>
      {episodes.map((episode) => (
        <li key={episode.id} className={styles.slot}>
          <EpisodeCard episode={episode} next={episode.id === nextUpId} />
        </li>
      ))}
    </ol>
  );
}

/** A series: the stage with "play next", seasons as pills, episodes as a shelf, then the rest. */
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
  const headingId = useId();
  const episodesHeadingId = useId();
  const panelId = useId();
  const next = nextUp.status === 'success' ? nextUp.data : null;

  return (
    <article className={styles.page} aria-labelledby={headingId}>
      <DetailStage
        item={series}
        headingId={headingId}
        actions={
          nextUp.status === 'success' && (
            <GlassButton
              variant="solid"
              size="lg"
              onImage
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
            </GlassButton>
          )
        }
      />
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={episodesHeadingId}>
          <h2 id={episodesHeadingId} className={styles.heading}>
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
            aria-labelledby={episodesHeadingId}
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
              <EpisodeShelf episodes={episodes.data} nextUpId={next?.id ?? null} />
            )}
          </div>
        </section>
        <CastShelf cast={series.cast} />
        <SimilarShelf items={similar} />
        <InfoPanel item={series} />
      </div>
    </article>
  );
}
