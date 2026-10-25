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
import { Icon } from '../../default/components/icons';
import { episodeCode, ratingText, runtimeText, yearText } from '../../default/components/meta';
import { CrimsonButton } from './CrimsonButton';
import styles from './DetailHeader.module.css';
import { ExpandableText, ShortList, TrackList } from '../../default/components/Expandable';

/** "Play" or "Resume", plus "Start over" for a started video. */
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
      <CrimsonButton
        variant="light"
        size="lg"
        icon={<Icon name="play" filled />}
        data-autofocus
        {...prepare}
        onClick={() => {
          actions.play(item, resumable ? 'resume' : 'beginning');
        }}
      >
        {resumable ? t('actions.resumeFrom', { time: formatClock(position) }) : t('actions.play')}
      </CrimsonButton>
      {resumable && (
        <CrimsonButton
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
 * Top of the details: wide picture with title logo and actions, then the facts in two columns
 * (description left; cast, genres, director and tracks right). `actions` adds e.g. the next
 * episode of a series. Buttons and facts follow `layout` (phase 14).
 */
export function DetailHeader({
  item,
  headingId,
  layout,
  actions: extraActions,
}: {
  item: ItemDetail;
  headingId: string;
  layout: DetailLayout;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation('content');
  const { t: tCrimson } = useTranslation('theme-crimson');
  const actions = useMediaActions();
  const backdrop = item.backdrops[0] ?? item.images.backdrop ?? item.images.primary;
  const rating = ratingText(i18n.language, item.communityRating);
  const actors = item.cast.filter((member) => member.kind === 'actor').slice(0, 6);
  const directors = item.cast.filter((member) => member.kind === 'director');
  const code = item.kind === 'episode' ? episodeCode(t, item) : null;
  const runtime =
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes);
  const year = yearText(t, item);
  // The line under the description.
  const line: Partial<Record<FactId, ReactNode>> = {
    year: year && <span>{year}</span>,
    runtime: runtime && <span>{runtime}</span>,
    officialRating: item.officialRating && (
      <span className={styles.badge}>{item.officialRating}</span>
    ),
    videoQuality: item.videoLabel && <span className={styles.badge}>{item.videoLabel}</span>,
    communityRating: rating && (
      <span className={styles.score}>
        <Icon name="star" filled />
        <span className="visually-hidden">{t('meta.rating')}</span>
        {rating}
      </span>
    ),
  };
  // The column on the right.
  const side: Partial<Record<FactId, ReactNode>> = {
    cast: actors.length > 0 && (
      <div>
        <dt>{tCrimson('detail.cast')}</dt>
        <dd>
          {actors.map((person, index) => (
            <span key={`${person.id}-${person.role ?? ''}`}>
              {index > 0 && ', '}
              <AppLink to={paths.person(person.id)} className={styles.person}>
                {person.name}
              </AppLink>
            </span>
          ))}
        </dd>
      </div>
    ),
    genres: item.genres.length > 0 && (
      <div>
        <dt>{tCrimson('detail.genres')}</dt>
        <dd>{item.genres.join(', ')}</dd>
      </div>
    ),
    directors: directors.length > 0 && (
      <div>
        <dt>{tCrimson('detail.director')}</dt>
        <dd>
          <ShortList entries={directors.map((person) => person.name)} />
        </dd>
      </div>
    ),
    audio: item.audioTracks.length > 0 && (
      <div>
        <dt>{tCrimson('detail.audio')}</dt>
        <dd>
          <TrackList tracks={item.audioTracks} />
        </dd>
      </div>
    ),
    subtitles: item.subtitleTracks.length > 0 && (
      <div>
        <dt>{tCrimson('detail.subtitles')}</dt>
        <dd>
          <TrackList tracks={item.subtitleTracks} />
        </dd>
      </div>
    ),
  };
  const buttons: Record<DetailActionId, ReactNode> = {
    play: (
      <>
        <PlayButtons item={item} />
        {extraActions}
      </>
    ),
    favorite: (
      <CrimsonButton
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
      <CrimsonButton
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
    trailer: item.localTrailerCount > 0 && (
      <CrimsonButton
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
    edit: (
      <ItemAdmin
        item={item}
        renderTrigger={({ label, buttonProps }) => (
          <CrimsonButton
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
  const inOrder = (parts: Partial<Record<FactId, ReactNode>>) =>
    layout.facts.map((id) => <Fragment key={id}>{parts[id]}</Fragment>);

  return (
    <>
      <div className={styles.media}>
        <JellyImage image={backdrop} sizes="(min-width: 64rem) 60rem, 100vw" priority />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.titleBlock}>
          {item.kind === 'episode' && item.episode && (
            <AppLink to={paths.item(item.episode.seriesId)} overlay className={styles.parent}>
              {item.episode.seriesName}
            </AppLink>
          )}
          {item.images.logo && item.kind !== 'episode' ? (
            <h1 id={headingId} className={styles.logo}>
              <JellyImage
                image={item.images.logo}
                sizes="(min-width: 64rem) 24rem, 60vw"
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
          <div className={styles.actions}>
            {layout.actions.map((id) => (
              <Fragment key={id}>{buttons[id]}</Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.facts}>
        <div className={styles.main}>
          <p className={styles.line}>
            {code && <span>{code}</span>}
            {inOrder(line)}
          </p>
          {layout.facts.includes('tagline') && item.tagline && (
            <p className={styles.tagline}>{item.tagline}</p>
          )}
          {item.overview && (
            <ExpandableText text={item.overview} classes={{ text: styles.overview }} />
          )}
        </div>
        <dl className={styles.side}>{inOrder(side)}</dl>
      </div>
    </>
  );
}
