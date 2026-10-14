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
import styles from './DetailHeader.module.css';
import { HorizonButton } from './HorizonButton';
import { ExpandableText } from '../../default/components/Expandable';

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
      <HorizonButton
        variant="primary"
        size="lg"
        icon={<Icon name="play" filled />}
        data-autofocus
        {...prepare}
        onClick={() => {
          actions.play(item, resumable ? 'resume' : 'beginning');
        }}
      >
        {resumable ? t('actions.resumeFrom', { time: formatClock(position) }) : t('actions.play')}
      </HorizonButton>
      {resumable && (
        <HorizonButton
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
 * The top of a details page: the picture fills the right side and fades into the page on the
 * left, where title (or title logo), facts, description and actions stand. `actions` replaces
 * the play buttons, e.g. with the next episode of a series.
 */
export function DetailHeader({
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
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <section className={styles.header}>
      <div className={styles.backdrop} aria-hidden="true">
        <JellyImage image={backdrop} sizes="(min-width: 64rem) 72vw, 100vw" priority />
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
              sizes="(min-width: 64rem) 26vw, 70vw"
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
          {rating && (
            <span className={styles.score}>
              <Icon name="star" filled />
              <span className="visually-hidden">{t('meta.rating')}</span>
              {rating}
            </span>
          )}
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
          {item.videoLabel && <span className={styles.badge}>{item.videoLabel}</span>}
        </p>
        {item.overview && (
          <ExpandableText text={item.overview} classes={{ text: styles.overview }} />
        )}
        {item.genres.length > 0 && (
          <p className={styles.genres}>{item.genres.slice(0, 4).join(' · ')}</p>
        )}
        <div className={styles.actions}>
          {mainActions ?? <PlayButtons item={item} />}
          {item.localTrailerCount > 0 && (
            <HorizonButton
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
          <HorizonButton
            variant="round"
            size="lg"
            aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            aria-pressed={item.userData.favorite}
            icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
            onClick={() => {
              actions.toggleFavorite(item);
            }}
          />
          <HorizonButton
            variant="round"
            size="lg"
            aria-label={item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')}
            aria-pressed={item.userData.played}
            icon={<Icon name="eye" />}
            onClick={() => {
              actions.togglePlayed(item);
            }}
          />
        </div>
      </div>
    </section>
  );
}
