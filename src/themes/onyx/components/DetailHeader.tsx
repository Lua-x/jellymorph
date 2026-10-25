import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DetailActionId, FactId } from '@/domain/layout';
import type { ItemDetail, MediaItem } from '@/domain/types';
import type { DetailLayout } from '@/hooks/useLayout';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { paths } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import { formatClock } from '@/ui/time';
import { ItemAdmin } from '../../default/components/admin/ItemAdmin';
import { ExpandableText } from '../../default/components/Expandable';
import { Icon } from '../../default/components/icons';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';
import { OnyxButton } from './OnyxButton';
import styles from './DetailHeader.module.css';

/** "Play" or "Resume from …", plus "Start over" for a started video. */
function PlayButtons({
  item,
}: {
  item: Pick<MediaItem, 'id' | 'kind' | 'userData' | 'available'>;
}) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  if (!isPlayable(item) || item.kind === 'series') return null;
  const position = item.userData.positionTicks / 10_000_000;
  const resumable = position >= 1 && !item.userData.played;
  const prepare = { onFocus: actions.preparePlayback, onPointerEnter: actions.preparePlayback };
  return (
    <>
      <OnyxButton
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
      </OnyxButton>
      {resumable && (
        <OnyxButton
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
 * The top of a details page: a stage over the full width, the picture fading into black on the
 * left and at the bottom, where title logo, facts, overview and buttons stand. `actions`
 * replaces the play buttons, e.g. with the next episode of a series. Buttons and facts follow
 * `layout`.
 */
export function DetailHeader({
  item,
  headingId,
  layout,
  actions: mainActions,
}: {
  item: ItemDetail;
  headingId: string;
  layout: DetailLayout;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation('content');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop ?? item.images.thumb;
  const rating = ratingText(i18n.language, item.communityRating);
  const code = item.kind === 'episode' ? episodeCode(t, item) : null;
  const year = yearText(t, item);
  const runtime =
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes);
  const line: Partial<Record<FactId, ReactNode>> = {
    year: year && <span>{year}</span>,
    runtime: runtime && <span>{runtime}</span>,
    officialRating: item.officialRating && (
      <span className={styles.badge}>{item.officialRating}</span>
    ),
    communityRating: rating && (
      <span className={styles.score}>
        <Icon name="star" filled />
        <span className="visually-hidden">{t('meta.rating')}</span>
        {rating}
      </span>
    ),
    videoQuality: item.videoLabel && <span className={styles.badge}>{item.videoLabel}</span>,
  };
  const buttons: Record<DetailActionId, ReactNode> = {
    play: mainActions ?? <PlayButtons item={item} />,
    trailer: item.localTrailerCount > 0 && (
      <OnyxButton
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
    ),
    favorite: (
      <OnyxButton
        variant="round"
        size="lg"
        aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
        aria-pressed={item.userData.favorite}
        icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
        onClick={() => {
          actions.toggleFavorite(item);
        }}
      />
    ),
    played: (
      <OnyxButton
        variant="round"
        size="lg"
        aria-label={item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')}
        aria-pressed={item.userData.played}
        icon={<Icon name="eye" />}
        onClick={() => {
          actions.togglePlayed(item);
        }}
      />
    ),
    edit: (
      <ItemAdmin
        item={item}
        renderTrigger={({ label, buttonProps }) => (
          <OnyxButton
            variant="round"
            size="lg"
            aria-label={label}
            icon={<Icon name="edit" />}
            {...buttonProps}
          />
        )}
      />
    ),
  };

  return (
    <section className={styles.header}>
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
              sizes="(min-width: 64rem) 28vw, 70vw"
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
          {code && <span>{code}</span>}
          {layout.facts.map((id) => (
            <Fragment key={id}>{line[id]}</Fragment>
          ))}
        </p>
        {layout.facts.includes('genres') && item.genres.length > 0 && (
          <p className={styles.genres}>{item.genres.slice(0, 4).join(' · ')}</p>
        )}
        {layout.facts.includes('tagline') && item.tagline && (
          <p className={styles.tagline}>{item.tagline}</p>
        )}
        {item.overview && (
          <ExpandableText text={item.overview} classes={{ text: styles.overview }} />
        )}
        <div className={styles.actions}>
          {layout.actions.map((id) => (
            <Fragment key={id}>{buttons[id]}</Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
