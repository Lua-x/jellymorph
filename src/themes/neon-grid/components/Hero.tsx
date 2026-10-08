import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { linkTo } from '@/navigation/paths';
import { useTrailerPreview } from '@/player/useTrailerPreview';
import { JellyImage } from '@/ui/JellyImage';
import type { HeroProps } from '../../contract';
import { Icon } from '../../default/components/icons';
import { DataFields } from './DataFields';
import styles from './Hero.module.css';
import { NeonButton, NeonLink } from './NeonButton';
import { ScrambleText } from './ScrambleText';

const ROTATE_MS = 9_000;

/** Featured titles as a "signal": backdrop with scanlines, HUD data fields and the title logo. */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: tNeon } = useTranslation('theme-neon-grid');
  const actions = useMediaActions();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = items.status === 'success' ? items.data : [];
  const count = slides.length;
  const reduced = useReducedMotion();
  const shownId = slides[Math.min(index, Math.max(0, count - 1))]?.id ?? null;
  const {
    videoRef: trailerRef,
    playing: trailerPlaying,
    cancel: cancelTrailer,
  } = useTrailerPreview(context === 'page' ? shownId : null);

  useEffect(() => {
    if (count < 2 || paused || trailerPlaying || reduced || context === 'preview') return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [count, paused, trailerPlaying, reduced, context]);

  if (items.status === 'pending') {
    return <div className={`${styles.hero} ${styles.skeleton}`} aria-hidden="true" />;
  }
  if (count === 0) return null;
  const current = slides[Math.min(index, count - 1)];
  if (!current) return null;
  const inPreview = context === 'preview' ? -1 : undefined;

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label={t('home.featured')}
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setPaused(false);
        if (event.relatedTarget) cancelTrailer();
      }}
    >
      {slides.map((item, slideIndex) => {
        const visible = slideIndex === index;
        const near = visible || slideIndex === (index + 1) % count;
        return (
          <div
            key={item.id}
            className={visible ? `${styles.backdrop} ${styles.visible}` : styles.backdrop}
            aria-hidden="true"
          >
            {near && (
              <JellyImage image={item.images.backdrop} sizes="100vw" priority={slideIndex === 0} />
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
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      <div
        key={current.id}
        className={styles.content}
        role="group"
        aria-roledescription="slide"
        aria-label={t('home.heroPosition', { current: index + 1, total: count })}
      >
        <p className={styles.signal} aria-hidden="true">
          {tNeon('home.channel', { number: String(index + 1).padStart(2, '0') })}
          <span className={styles.signalTotal}>/{String(count).padStart(2, '0')}</span>
        </p>
        {current.images.logo ? (
          <h2 className={styles.logo}>
            <JellyImage
              image={current.images.logo}
              sizes="(min-width: 64rem) 30vw, 70vw"
              maxWidth={960}
              fit="contain"
            />
            <span className="visually-hidden">{current.name}</span>
          </h2>
        ) : (
          <h2 className={styles.title}>
            <ScrambleText text={current.name} />
          </h2>
        )}
        <DataFields item={current} compact />
        {current.overview && <p className={styles.overview}>{current.overview}</p>}
        <div className={styles.actions}>
          {isPlayable(current) && (
            <NeonButton
              size="lg"
              icon={<Icon name="play" filled />}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(current, 'ask');
              }}
              tabIndex={inPreview}
            >
              {t('actions.play')}
            </NeonButton>
          )}
          {context === 'page' && (
            <NeonLink
              to={linkTo(current)}
              variant="secondary"
              size="lg"
              icon={<Icon name="info" />}
            >
              {t('actions.details')}
            </NeonLink>
          )}
          <NeonButton
            variant="ghost"
            size="lg"
            icon={<Icon name="heart" filled={current.userData.favorite} />}
            aria-pressed={current.userData.favorite}
            onClick={() => {
              actions.toggleFavorite(current);
            }}
            tabIndex={inPreview}
          >
            {current.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
          </NeonButton>
        </div>
      </div>
      {count > 1 && (
        <div className={styles.indicator}>
          {slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              className={styles.segment}
              aria-label={t('home.showItem', { name: item.name })}
              aria-current={slideIndex === index ? 'true' : undefined}
              tabIndex={inPreview}
              onClick={() => {
                setIndex(slideIndex);
              }}
            >
              <span />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
