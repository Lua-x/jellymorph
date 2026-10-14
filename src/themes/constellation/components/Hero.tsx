import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { linkTo } from '@/navigation/paths';
import { useTrailerPreview } from '@/player/useTrailerPreview';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { HeroProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { runtimeText, yearText } from '../../default/components/meta';
import styles from './Hero.module.css';

const ROTATE_MS = 8_000;

/**
 * Title logo (or title), facts and the start of the description on the left of a banner. They
 * name the banner link, so the title stays in its text even when the logo shows it.
 */
function BannerText({ item, current }: { item: MediaItem; current: boolean }) {
  const { t } = useTranslation('content');
  const facts = [
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
    item.genres.slice(0, 2).join(', ') || null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <span className={styles.content}>
      {item.images.logo ? (
        <span className={styles.logo}>
          <JellyImage
            image={item.images.logo}
            sizes="(min-width: 64rem) 26vw, 55vw"
            maxWidth={960}
            fit="contain"
            priority={current}
          />
          <span className="visually-hidden">{item.name}</span>
        </span>
      ) : (
        <span className={styles.title}>{item.name}</span>
      )}
      <span className={styles.facts}>
        {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
        {facts.join(' · ')}
      </span>
      {item.overview && <span className={styles.overview}>{item.overview}</span>}
    </span>
  );
}

/**
 * Wide rounded banners in a carousel; the neighbours peek in at both edges. Each banner opens
 * its title. It moves on every eight seconds, except while the pointer or the focus is in it, a
 * trailer plays, motion is reduced or the pause button stopped it (WCAG 2.2.2).
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tTheme } = useTranslation('theme-constellation');
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduced = useReducedMotion();
  const slides = items.status === 'success' ? items.data : [];
  const count = slides.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const shownId = slides[safeIndex]?.id ?? null;
  const page = context === 'page';
  const {
    videoRef: trailerRef,
    playing: trailerPlaying,
    cancel: cancelTrailer,
  } = useTrailerPreview(page ? shownId : null);
  const running = count > 1 && !held && !stopped && !trailerPlaying && !reduced && page;

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
    return (
      <div className={styles.hero} data-context={context} aria-hidden="true">
        <div className={styles.viewport}>
          <div className={`${styles.banner} ${styles.skeleton}`} />
        </div>
        {/* The row of dots keeps its place, so nothing below jumps when the titles arrive. */}
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
        <div className={styles.track} style={{ '--index': safeIndex } as CSSProperties}>
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
                data-current={current || undefined}
              >
                <AppLink
                  to={linkTo(item)}
                  className={styles.banner}
                  tabIndex={page ? undefined : -1}
                  data-autofocus={(page && current) || undefined}
                >
                  <span className={styles.frame} aria-hidden="true">
                    {near && (
                      <JellyImage
                        image={item.images.backdrop ?? item.images.thumb}
                        sizes="(min-width: 48rem) 88vw, 96vw"
                        priority={slideIndex === 0}
                      />
                    )}
                    {current && page && (
                      <video
                        ref={trailerRef}
                        className={styles.trailer}
                        data-playing={trailerPlaying}
                        muted
                        playsInline
                        tabIndex={-1}
                      />
                    )}
                    <span className={styles.shade} />
                  </span>
                  {near && <BannerText item={item} current={current} />}
                </AppLink>
              </div>
            );
          })}
        </div>
        {/* Pointer and Tab only: with the arrow keys, Left from a banner leads to the rail and
            the dots below switch titles. */}
        {count > 1 && page && (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.previous}`}
              data-nav-ignore
              aria-label={tTheme('hero.previous')}
              onClick={() => {
                go(-1);
              }}
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.next}`}
              data-nav-ignore
              aria-label={tTheme('hero.next')}
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
          <div className={styles.dots} role="group" aria-label={tTheme('hero.slides')}>
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                className={styles.dot}
                aria-label={t('home.showItem', { name: item.name })}
                aria-current={slideIndex === safeIndex ? 'true' : undefined}
                tabIndex={page ? undefined : -1}
                onClick={() => {
                  setIndex(slideIndex);
                }}
              >
                <span />
              </button>
            ))}
          </div>
          {page && !reduced && (
            <button
              type="button"
              className={styles.pause}
              aria-label={stopped ? tTheme('hero.resume') : tTheme('hero.pause')}
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
