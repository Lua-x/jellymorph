import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDetail, MediaItem } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import { Icon } from '../../default/components/icons';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';
import styles from './DetailStage.module.css';
import { GlassButton } from './GlassButton';

/** "Play" or "Resume from …", plus "Start over" for a started video. */
function PlayButtons({ item }: { item: Pick<MediaItem, 'id' | 'kind' | 'userData'> }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  if (!isPlayable(item) || item.kind === 'series') return null;
  const position = item.userData.positionTicks / 10_000_000;
  const resumable = position >= 1 && !item.userData.played;
  const prepare = { onFocus: actions.preparePlayback, onPointerEnter: actions.preparePlayback };
  return (
    <>
      <GlassButton
        variant="solid"
        size="lg"
        onImage
        icon={<Icon name="play" filled />}
        data-autofocus
        {...prepare}
        onClick={() => {
          actions.play(item, resumable ? 'resume' : 'beginning');
        }}
      >
        {resumable ? t('actions.resumeFrom', { time: formatClock(position) }) : t('actions.play')}
      </GlassButton>
      {resumable && (
        <GlassButton
          variant="round"
          size="lg"
          onImage
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
 * The top of every details page: the picture fills the window and fades to dark at the bottom
 * left, the title logo (or the title) stands on it with the facts, the description and glass
 * buttons. `actions` replaces the play buttons, e.g. with the next episode of a series.
 */
export function DetailStage({
  item,
  headingId,
  actions: mainActions,
}: {
  item: ItemDetail;
  headingId: string;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation('content');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop ?? item.images.thumb;
  const rating = ratingText(i18n.language, item.communityRating);
  const facts = [
    item.kind === 'episode' ? episodeCode(t, item) : null,
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
    item.genres.slice(0, 3).join(', ') || null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <section className={styles.stage}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="100vw" priority />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.content}>
        {item.kind === 'episode' && item.episode && (
          <AppLink to={paths.item(item.episode.seriesId)} className={styles.parent}>
            {item.episode.seriesName}
          </AppLink>
        )}
        {item.images.logo && item.kind !== 'episode' ? (
          <h1 id={headingId} className={styles.logo}>
            <JellyImage
              image={item.images.logo}
              sizes="(min-width: 64rem) 32vw, 70vw"
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
        <p className={styles.facts}>
          {facts.join(' · ')}
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
        <div className={styles.actions}>
          {mainActions ?? <PlayButtons item={item} />}
          <GlassButton
            variant="round"
            size="lg"
            onImage
            aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            aria-pressed={item.userData.favorite}
            icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
            onClick={() => {
              actions.toggleFavorite(item);
            }}
          />
          <GlassButton
            variant="round"
            size="lg"
            onImage
            aria-label={item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')}
            aria-pressed={item.userData.played}
            icon={<Icon name="eye" />}
            onClick={() => {
              actions.togglePlayed(item);
            }}
          />
          {item.localTrailerCount > 0 && (
            <GlassButton
              variant="round"
              size="lg"
              onImage
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
    </section>
  );
}
