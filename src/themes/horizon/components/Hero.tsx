import { useEffect, useState } from 'react';
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
import styles from './Hero.module.css';
import { HorizonButton, HorizonLink } from './HorizonButton';

const ROTATE_MS = 10_000;

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
    item.genres.slice(0, 2).join(', ') || null,
  ].filter((fact): fact is string => Boolean(fact));
  const preview = context === 'preview';

  return (
    <div className={styles.content}>
      {item.images.logo ? (
        <h2 className={styles.logo}>
          <JellyImage
            image={item.images.logo}
            sizes="(min-width: 64rem) 28vw, 60vw"
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
        {facts.join(' · ')}
      </p>
      {item.overview && <p className={styles.overview}>{item.overview}</p>}
      <div className={styles.actions}>
        {isPlayable(item) && (
          <HorizonButton
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
          </HorizonButton>
        )}
        {!preview && (
          <HorizonLink to={linkTo(item)} variant="secondary" size="lg">
            {t('actions.details')}
          </HorizonLink>
        )}
        <HorizonButton
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

/**
 * A wide carousel under the bar: the titles slide sideways, large arrows sit on both edges and
 * dots below. It moves on by itself every ten seconds, except while the pointer or the focus is
 * in it, a trailer plays, motion is reduced or the pause button stopped it (WCAG 2.2.2).
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tHorizon } = useTranslation('theme-horizon');
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
  const running =
    count > 1 && !held && !stopped && !trailerPlaying && !reduced && context === 'page';

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [running, safeIndex, count]);

  if (items.status === 'pending') {
    // Same height as the loaded hero (banner and the row of dots), so nothing below jumps.
    return (
      <div className={styles.hero} data-context={context} aria-hidden="true">
        <div className={`${styles.viewport} ${styles.skeleton}`} />
        <div className={styles.controls} />
      </div>
    );
  }
  // The hero is decoration on top of the rows; without featured items it simply disappears.
  if (count === 0) return null;
  const go = (step: number) => {
    setIndex((safeIndex + step + count) % count);
  };

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
      <div className={styles.viewport}>
        <div
          className={styles.track}
          style={{ transform: `translateX(${String(safeIndex * -100)}%)` }}
        >
          {slides.map((item, slideIndex) => {
            const current = slideIndex === safeIndex;
            const near = Math.abs(slideIndex - safeIndex) <= 1;
            return (
              <div
                key={item.id}
                className={styles.slide}
                role="group"
                aria-roledescription="slide"
                aria-label={t('home.heroPosition', { current: slideIndex + 1, total: count })}
                aria-hidden={!current || undefined}
                inert={!current}
              >
                <div className={styles.backdrop} aria-hidden="true">
                  {near && (
                    <JellyImage
                      image={item.images.backdrop ?? item.images.thumb}
                      sizes="100vw"
                      priority={slideIndex === 0}
                    />
                  )}
                </div>
                <div className={styles.shade} aria-hidden="true" />
                {near && <Slide item={item} context={context} current={current} />}
              </div>
            );
          })}
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
        {count > 1 && context === 'page' && (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.previous}`}
              aria-label={tHorizon('hero.previous')}
              onClick={() => {
                go(-1);
              }}
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.next}`}
              aria-label={tHorizon('hero.next')}
              onClick={() => {
                go(1);
              }}
            >
              <Icon name="chevronRight" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className={styles.controls}>
          <div className={styles.dots} role="group" aria-label={tHorizon('hero.slides')}>
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                className={styles.dot}
                aria-label={t('home.showItem', { name: item.name })}
                aria-current={slideIndex === safeIndex ? 'true' : undefined}
                tabIndex={context === 'preview' ? -1 : undefined}
                onClick={() => {
                  setIndex(slideIndex);
                }}
              >
                <span />
              </button>
            ))}
          </div>
          {context === 'page' && !reduced && (
            <button
              type="button"
              className={styles.pause}
              aria-label={stopped ? tHorizon('hero.resume') : tHorizon('hero.pause')}
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
