import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { linkTo } from '@/navigation/paths';
import { useTrailerPreview } from '@/player/useTrailerPreview';
import { JellyImage } from '@/ui/JellyImage';
import type { HeroProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { runtimeText, yearText } from '../../default/components/meta';
import { CobaltButton, CobaltLink } from './CobaltButton';
import styles from './Hero.module.css';

/** How long a title stays; the progress bar in the filmstrip runs for exactly this long. */
const ROTATE_MS = 9_000;

function Slide({
  item,
  context,
  current,
}: {
  item: MediaItem;
  context: HeroProps['context'];
  current: boolean;
}) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const facts = [
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
    item.genres.slice(0, 2).join(' · ') || null,
  ].filter((fact): fact is string => Boolean(fact));
  const preview = context === 'preview';

  return (
    <div className={styles.content}>
      {item.images.logo ? (
        <h2 className={styles.logo}>
          <JellyImage
            image={item.images.logo}
            sizes="(min-width: 64rem) 30vw, 70vw"
            maxWidth={960}
            fit="contain"
            priority={current}
          />
          <span className="visually-hidden">{item.name}</span>
        </h2>
      ) : (
        <h2 className={styles.title}>{item.name}</h2>
      )}
      <p className={styles.facts}>
        {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </p>
      {item.overview && <p className={styles.overview}>{item.overview}</p>}
      <div className={styles.actions}>
        {isPlayable(item) && (
          <CobaltButton
            variant="primary"
            size="lg"
            icon={<Icon name="play" filled />}
            tabIndex={preview ? -1 : undefined}
            onFocus={actions.preparePlayback}
            onPointerEnter={actions.preparePlayback}
            onClick={() => {
              actions.play(item, 'ask');
            }}
          >
            {t('actions.play')}
          </CobaltButton>
        )}
        {!preview && (
          <CobaltLink to={linkTo(item)} variant="secondary" size="lg" icon={<Icon name="info" />}>
            {t('actions.details')}
          </CobaltLink>
        )}
        <CobaltButton
          variant="round"
          size="lg"
          aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
          aria-pressed={item.userData.favorite}
          icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
          tabIndex={preview ? -1 : undefined}
          onClick={() => {
            actions.toggleFavorite(item);
          }}
        />
      </div>
    </div>
  );
}

/** Whether two positions in a ring of `count` slides are neighbours (or the same). */
function isNear(a: number, b: number, count: number): boolean {
  const distance = Math.abs(a - b);
  return Math.min(distance, count - distance) <= 1;
}

/**
 * A title stage over the full width, under the transparent bar. The titles cross-fade; along
 * the bottom a filmstrip shows all of them as small pictures that can be chosen directly. The
 * current one fills with a progress bar, and the next title comes when the bar is full. The bar
 * pauses while the pointer or the focus is on the stage or a trailer plays; the pause button
 * stops it for good (WCAG 2.2.2). Reduced motion: no automatic change at all.
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tCobalt } = useTranslation('theme-cobalt');
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduced = useReducedMotion();
  const slides = items.status === 'success' ? items.data : [];
  const count = slides.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const shownId = slides[safeIndex]?.id ?? null;
  const {
    videoRef: trailerRef,
    playing: trailerPlaying,
    cancel: cancelTrailer,
  } = useTrailerPreview(context === 'page' ? shownId : null);
  const rotating = count > 1 && !stopped && !reduced && context === 'page';
  const paused = held || trailerPlaying;

  if (items.status === 'pending') {
    // Same height as the loaded stage (with its filmstrip), so nothing below jumps.
    return (
      <div
        className={`${styles.hero} ${styles.skeleton}`}
        data-context={context}
        aria-hidden="true"
      >
        <div className={styles.stripArea}>
          <span className={styles.stripSkeleton} />
        </div>
      </div>
    );
  }
  // The stage is decoration on top of the rows; without featured items it simply disappears.
  if (count === 0) return null;

  return (
    <section
      className={styles.hero}
      data-context={context}
      aria-roledescription="carousel"
      aria-label={t('home.featured')}
      onPointerEnter={() => {
        setHeld(true);
      }}
      onPointerLeave={() => {
        setHeld(false);
      }}
      onFocus={() => {
        setHeld(true);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setHeld(false);
        // Focus moved on to the rows: the trailer would only distract.
        if (event.relatedTarget) cancelTrailer();
      }}
    >
      {/* Layers from back to front: pictures, trailer, shade, text, filmstrip. */}
      <div className={styles.backdrops} aria-hidden="true">
        {slides.map((item, slideIndex) => (
          <div
            key={item.id}
            className={styles.backdrop}
            data-current={slideIndex === safeIndex || undefined}
          >
            {isNear(slideIndex, safeIndex, count) && (
              <JellyImage
                image={item.images.backdrop ?? item.images.thumb}
                sizes="100vw"
                priority={slideIndex === 0}
              />
            )}
          </div>
        ))}
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
      <div className={styles.stage}>
        {slides.map((item, slideIndex) => {
          const current = slideIndex === safeIndex;
          return (
            <div
              key={item.id}
              className={styles.slide}
              data-current={current || undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={t('home.heroPosition', { current: slideIndex + 1, total: count })}
              aria-hidden={!current || undefined}
              inert={!current}
            >
              {isNear(slideIndex, safeIndex, count) && (
                <Slide item={item} context={context} current={current} />
              )}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className={styles.stripArea}>
          <ol className={styles.strip} aria-label={tCobalt('hero.strip')}>
            {slides.map((item, slideIndex) => {
              const current = slideIndex === safeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.thumb}
                    aria-label={t('home.showItem', { name: item.name })}
                    aria-current={current ? 'true' : undefined}
                    tabIndex={context === 'preview' ? -1 : undefined}
                    onClick={() => {
                      setIndex(slideIndex);
                    }}
                  >
                    <JellyImage
                      image={item.images.thumb ?? item.images.backdrop}
                      sizes="(min-width: 64rem) 11rem, 6rem"
                      maxWidth={480}
                    />
                    {current && (
                      <span className={styles.timer} aria-hidden="true">
                        <span
                          className={styles.timerValue}
                          data-running={rotating || undefined}
                          data-paused={(rotating && paused) || undefined}
                          style={{ animationDuration: `${String(ROTATE_MS)}ms` }}
                          onAnimationEnd={() => {
                            setIndex((safeIndex + 1) % count);
                          }}
                        />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {context === 'page' && !reduced && (
            <button
              type="button"
              className={styles.pause}
              aria-label={stopped ? tCobalt('hero.resume') : tCobalt('hero.pause')}
              aria-pressed={stopped}
              onClick={() => {
                setStopped((value) => !value);
              }}
            >
              <Icon name={stopped ? 'play' : 'pause'} filled />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
