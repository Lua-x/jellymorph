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
import styles from './Hero.module.css';
import { MoonButton, MoonLink } from './MoonButton';

/** How long a title stays; the hazard bar in its tab runs for exactly this long. */
const ROTATE_MS = 9_000;

/** "01", "02" …: tabs and kicker count like episode numbers. */
const number = (value: number) => String(value).padStart(2, '0');

function Slide({
  item,
  position,
  total,
  context,
  current,
}: {
  item: MediaItem;
  position: number;
  total: number;
  context: HeroProps['context'];
  current: boolean;
}) {
  const { t } = useTranslation('content');
  const { t: tMoon } = useTranslation('theme-moon');
  const actions = useMediaActions();
  const facts = [
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
    ...item.genres.slice(0, 2),
  ].filter((fact): fact is string => Boolean(fact));
  const preview = context === 'preview';

  return (
    <div className={styles.content}>
      <p className={styles.kicker}>
        <span className={styles.kickerTag}>{tMoon('hero.kicker')}</span>
        <span className={styles.kickerCount}>
          {number(position)} / {number(total)}
        </span>
        <span className={styles.kickerKana} aria-hidden="true">
          {tMoon('hero.kana')}
        </span>
      </p>
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
      <ul className={styles.facts}>
        {item.officialRating && <li className={styles.rating}>{item.officialRating}</li>}
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {item.overview && <p className={styles.overview}>{item.overview}</p>}
      <div className={styles.actions}>
        {isPlayable(item) && (
          <MoonButton
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
          </MoonButton>
        )}
        {!preview && (
          <MoonLink to={linkTo(item)} variant="secondary" size="lg" icon={<Icon name="info" />}>
            {t('actions.details')}
          </MoonLink>
        )}
        <MoonButton
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
 * The titles of the day as a title card: a slanted comic panel with the picture on the right
 * and the title large on the left, under it numbered tabs like episode cards. The current tab
 * fills with a hazard stripe, and the next title comes when it is full; a new title arrives with
 * a short color-offset glitch. The bar pauses while the pointer or the focus is on the stage or a
 * trailer plays; the pause button stops it for good (WCAG 2.2.2). Reduced motion: no automatic
 * change and no glitch.
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tMoon } = useTranslation('theme-moon');
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
    // Same height as the loaded stage (with its tabs), so nothing below jumps.
    return (
      <div
        className={`${styles.hero} ${styles.skeleton}`}
        data-context={context}
        aria-hidden="true"
      >
        <div className={styles.panel}>
          <div className={styles.frame} />
        </div>
        <div className={styles.tabsArea} />
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
      <div className={styles.panel}>
        <div className={styles.frame}>
          {/* Layers from back to front: pictures, trailer, dots and shade, text. */}
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
                    sizes="(min-width: 48rem) 70vw, 100vw"
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
                    <Slide
                      item={item}
                      position={slideIndex + 1}
                      total={count}
                      context={context}
                      current={current}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {count > 1 && (
        <div className={styles.tabsArea}>
          <ol className={styles.tabs} aria-label={tMoon('hero.tabs')}>
            {slides.map((item, slideIndex) => {
              const current = slideIndex === safeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.tab}
                    aria-label={t('home.showItem', { name: item.name })}
                    aria-current={current ? 'true' : undefined}
                    tabIndex={context === 'preview' ? -1 : undefined}
                    onClick={() => {
                      setIndex(slideIndex);
                    }}
                  >
                    <span className={styles.tabNumber} aria-hidden="true">
                      {number(slideIndex + 1)}
                    </span>
                    <span className={styles.tabName} aria-hidden="true">
                      {item.name}
                    </span>
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
            <MoonButton
              variant="round"
              className={styles.pause}
              aria-label={stopped ? tMoon('hero.resume') : tMoon('hero.pause')}
              aria-pressed={stopped}
              icon={<Icon name={stopped ? 'play' : 'pause'} filled />}
              onClick={() => {
                setStopped((value) => !value);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
