import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
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
import { GlassButton, GlassLink } from './GlassButton';
import styles from './Hero.module.css';
import { GlassMotion } from './motion';
import { SPRING } from './springs';

const ROTATE_MS = 8_000;

function Facts({ item }: { item: MediaItem }) {
  const { t } = useTranslation('content');
  const facts = [
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
    item.genres.slice(0, 2).join(', ') || null,
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <p className={styles.facts}>
      {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
      {facts.join(' · ')}
    </p>
  );
}

function Slide({ item, context }: { item: MediaItem; context: HeroProps['context'] }) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const preview = context === 'preview';
  return (
    <>
      {item.images.logo ? (
        <h2 className={styles.logo}>
          <JellyImage
            image={item.images.logo}
            sizes="(min-width: 64rem) 32vw, 70vw"
            maxWidth={960}
            fit="contain"
          />
          <span className="visually-hidden">{item.name}</span>
        </h2>
      ) : (
        <h2 className={styles.title}>{item.name}</h2>
      )}
      <Facts item={item} />
      {item.overview && <p className={styles.overview}>{item.overview}</p>}
      <div className={styles.actions}>
        {isPlayable(item) && (
          <GlassButton
            variant="solid"
            size="lg"
            onImage
            icon={<Icon name="play" filled />}
            tabIndex={preview ? -1 : undefined}
            onFocus={actions.preparePlayback}
            onPointerEnter={actions.preparePlayback}
            onClick={() => {
              actions.play(item, 'ask');
            }}
          >
            {t('actions.play')}
          </GlassButton>
        )}
        {!preview && (
          <GlassLink
            to={linkTo(item)}
            variant="glass"
            size="lg"
            onImage
            icon={<Icon name="info" />}
          >
            {t('actions.details')}
          </GlassLink>
        )}
        <GlassButton
          variant="round"
          size="lg"
          onImage
          aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
          aria-pressed={item.userData.favorite}
          icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
          tabIndex={preview ? -1 : undefined}
          onClick={() => {
            actions.toggleFavorite(item);
          }}
        />
      </div>
    </>
  );
}

/**
 * Full-screen carousel: one featured title at a time, changing every few seconds with a slow
 * cross-fade. The indicator shows the time left on the current title; rotation stops while the
 * pointer or the focus is in the hero, while a trailer plays, with reduced motion, and with the
 * pause button (WCAG 2.2.2).
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tGlass } = useTranslation('theme-glass');
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
    return <div className={`${styles.hero} ${styles.skeleton}`} aria-hidden="true" />;
  }
  // The hero is decoration on top of the rows; without featured items it simply disappears.
  const current = slides[safeIndex];
  if (!current) return null;

  return (
    <GlassMotion>
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
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === safeIndex;
          const near = visible || slideIndex === (safeIndex + 1) % count;
          return (
            <div
              key={item.id}
              className={styles.backdrop}
              data-visible={visible || undefined}
              data-trailer={(visible && trailerPlaying) || undefined}
              aria-hidden="true"
            >
              {near && (
                <JellyImage
                  image={item.images.backdrop ?? item.images.thumb}
                  sizes="100vw"
                  priority={slideIndex === 0}
                />
              )}
            </div>
          );
        })}
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
        <div className={styles.inner}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={current.id}
              className={styles.content}
              role="group"
              aria-roledescription="slide"
              aria-label={t('home.heroPosition', { current: safeIndex + 1, total: count })}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={SPRING}
            >
              <Slide item={current} context={context} />
            </m.div>
          </AnimatePresence>
          {count > 1 && (
            <div className={styles.controls}>
              {context === 'page' && !reduced && (
                <GlassButton
                  variant="round"
                  onImage
                  className={styles.pause}
                  aria-label={stopped ? tGlass('hero.resume') : tGlass('hero.pause')}
                  aria-pressed={stopped}
                  icon={<Icon name={stopped ? 'play' : 'pause'} filled />}
                  onClick={() => {
                    setStopped((value) => !value);
                  }}
                />
              )}
              <div className={styles.dots} role="group" aria-label={tGlass('hero.slides')}>
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
                    <span className={styles.dotTrack}>
                      {slideIndex === safeIndex && (
                        // Restarts with every slide and every resume of the rotation.
                        <span
                          key={`${String(safeIndex)}-${String(running)}`}
                          className={styles.dotFill}
                          data-running={running || undefined}
                          style={{ '--rotate': `${String(ROTATE_MS)}ms` } as CSSProperties}
                        />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </GlassMotion>
  );
}
