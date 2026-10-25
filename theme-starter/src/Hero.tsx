import {
  AppLink,
  ErrorState,
  isPlayable,
  JellyImage,
  linkTo,
  runtimeText,
  useMediaActions,
  yearText,
  type HeroProps,
} from 'jellymorph';
import { useTranslation } from 'react-i18next';
import styles from './Hero.module.css';

/**
 * The featured title of the day as a wide card: backdrop, name, facts, overview, and buttons to
 * play it or open its details. Texts come from the app ("content") and from this theme's own
 * namespace ("theme-<id>", see texts in index.tsx).
 */
export function Hero({ items, context }: HeroProps) {
  const { t } = useTranslation('content');
  const { t: own } = useTranslation('theme-starter');
  const actions = useMediaActions();

  if (items.status === 'error') {
    return <ErrorState variant="section" error={items.error} onRetry={items.retry} />;
  }
  // The placeholder has the size of the loaded stage, so nothing below it moves.
  if (items.status === 'pending') {
    return <section className={`${styles.hero} ${styles.pending}`} aria-busy="true" />;
  }
  const item = items.data[0];
  if (!item) return null;
  const facts = [yearText(t, item), runtimeText(t, item.runtimeMinutes)].filter(Boolean);

  return (
    <section className={styles.hero} aria-label={own('hero.label')}>
      <span className={styles.picture}>
        <JellyImage
          image={item.images.backdrop ?? item.images.primary}
          sizes="(min-width: 64rem) 70vw, 100vw"
          maxWidth={1920}
          priority={context === 'page'}
        />
      </span>
      <div className={styles.content}>
        <p className={styles.kicker}>{own('hero.label')}</p>
        <h2 className={styles.title}>{item.name}</h2>
        {facts.length > 0 && <p className={styles.facts}>{facts.join(' · ')}</p>}
        {item.overview && <p className={styles.overview}>{item.overview}</p>}
        <div className={styles.actions}>
          {isPlayable(item) && (
            <button
              type="button"
              className={styles.play}
              // The first arrow key press lands here (spatial navigation, docs/themes.md §6).
              data-autofocus
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                actions.play(item, 'ask');
              }}
            >
              {t('actions.play')}
            </button>
          )}
          <AppLink to={linkTo(item)} className={styles.details}>
            {t('actions.details')}
          </AppLink>
        </div>
      </div>
    </section>
  );
}
