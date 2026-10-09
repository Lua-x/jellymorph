import { useTranslation } from 'react-i18next';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { linkTo } from '@/navigation/paths';
import { useTrailerPreview } from '@/player/useTrailerPreview';
import { JellyImage } from '@/ui/JellyImage';
import type { HeroProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { CrimsonButton, CrimsonLink } from './CrimsonButton';
import styles from './Hero.module.css';

/**
 * One big featured title under the transparent bar: backdrop that slowly drifts (Ken Burns), the
 * muted local trailer after about three calm seconds, title logo, short description, "Play" and
 * "More info", and the age rating on the right edge.
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tCrimson } = useTranslation('theme-crimson');
  const actions = useMediaActions();
  const item = items.status === 'success' ? items.data[0] : undefined;
  const {
    videoRef: trailerRef,
    playing: trailerPlaying,
    cancel: cancelTrailer,
  } = useTrailerPreview(context === 'page' ? (item?.id ?? null) : null);

  if (items.status === 'pending') {
    return <div className={`${styles.hero} ${styles.skeleton}`} aria-hidden="true" />;
  }
  if (!item) return null;
  const inPreview = context === 'preview' ? -1 : undefined;

  return (
    <section
      className={styles.hero}
      aria-label={t('home.featured')}
      data-context={context}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget)
          cancelTrailer();
      }}
    >
      <div
        className={styles.backdrop}
        data-trailer={trailerPlaying || undefined}
        aria-hidden="true"
      >
        <JellyImage image={item.images.backdrop} sizes="100vw" priority />
      </div>
      {context === 'page' && (
        <video
          ref={trailerRef}
          className={styles.trailer}
          data-playing={trailerPlaying}
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.content}>
        {item.images.logo ? (
          <h2 className={styles.logo} data-small={trailerPlaying || undefined}>
            <JellyImage
              image={item.images.logo}
              sizes="(min-width: 64rem) 35vw, 70vw"
              maxWidth={960}
              fit="contain"
            />
            <span className="visually-hidden">{item.name}</span>
          </h2>
        ) : (
          <h2 className={styles.title}>{item.name}</h2>
        )}
        {item.overview && (
          <p className={styles.overview} data-hidden={trailerPlaying || undefined}>
            {item.overview}
          </p>
        )}
        <div className={styles.actions}>
          {isPlayable(item) && (
            <CrimsonButton
              variant="light"
              size="lg"
              icon={<Icon name="play" filled />}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(item, 'ask');
              }}
              tabIndex={inPreview}
            >
              {t('actions.play')}
            </CrimsonButton>
          )}
          {context === 'page' ? (
            <CrimsonLink
              to={linkTo(item)}
              overlay
              variant="dim"
              size="lg"
              icon={<Icon name="info" />}
            >
              {tCrimson('hero.moreInfo')}
            </CrimsonLink>
          ) : (
            <CrimsonButton variant="dim" size="lg" icon={<Icon name="info" />} tabIndex={-1}>
              {tCrimson('hero.moreInfo')}
            </CrimsonButton>
          )}
        </div>
      </div>
      {item.officialRating && (
        <p className={styles.rating}>
          <span className="visually-hidden">
            {tCrimson('hero.rating', { rating: item.officialRating })}
          </span>
          <span aria-hidden="true">{item.officialRating}</span>
        </p>
      )}
    </section>
  );
}
