import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import { JellyImage } from '@/ui/JellyImage';
import type { HeroProps } from '../../contract';
import { Button } from './Button';
import styles from './Hero.module.css';
import { Icon } from './icons';
import { MetaLine } from './MetaLine';

const ROTATE_MS = 9_000;

export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const actions = useMediaActions();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = items.status === 'success' ? items.data : [];
  const count = slides.length;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (count < 2 || paused || reduced || context === 'preview') return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [count, paused, reduced, context]);

  if (items.status === 'pending') {
    return <div className={`${styles.hero} ${styles.skeleton}`} aria-hidden="true" />;
  }
  // The hero is decoration on top of the rows; without featured items it simply disappears.
  if (count === 0) return null;
  const current = slides[Math.min(index, count - 1)];
  if (!current) return null;

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
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
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
      <div className={styles.scrim} aria-hidden="true" />
      <div
        key={current.id}
        className={styles.content}
        role="group"
        aria-roledescription="slide"
        aria-label={t('home.heroPosition', { current: index + 1, total: count })}
      >
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
          <h2 className={styles.title}>{current.name}</h2>
        )}
        <MetaLine item={current} />
        {current.overview && <p className={styles.overview}>{current.overview}</p>}
        <div className={styles.actions}>
          {isPlayable(current) && (
            <Button
              size="lg"
              icon={<Icon name="play" filled />}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(current, 'ask');
              }}
              tabIndex={context === 'preview' ? -1 : undefined}
            >
              {t('actions.play')}
            </Button>
          )}
          {context === 'page' ? (
            <AppLink to={linkTo(current)} className={styles.detailsLink}>
              <Icon name="info" />
              {t('actions.details')}
            </AppLink>
          ) : null}
          <Button
            variant="secondary"
            size="lg"
            icon={<Icon name="heart" filled={current.userData.favorite} />}
            aria-pressed={current.userData.favorite}
            onClick={() => {
              actions.toggleFavorite(current);
            }}
            tabIndex={context === 'preview' ? -1 : undefined}
          >
            {current.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
          </Button>
        </div>
      </div>
      {count > 1 && (
        <div className={styles.dots}>
          {slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              className={styles.dot}
              aria-label={t('home.showItem', { name: item.name })}
              aria-current={slideIndex === index ? 'true' : undefined}
              tabIndex={context === 'preview' ? -1 : undefined}
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
