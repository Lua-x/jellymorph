import { useTranslation } from 'react-i18next';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import type { CardVariant, MediaCardProps } from '../../contract';
import { cardSubtitle, cardTitle } from '../../default/components/meta';
import { CardArt } from './CardArt';
import styles from './MediaCard.module.css';

const SIZES = '(min-width: 90rem) 18vw, (min-width: 64rem) 22vw, (min-width: 40rem) 30vw, 62vw';

/**
 * A rounded 16:9 card with a soft shadow; the picture carries the title. Pointer, keyboard and
 * remote focus scale it up slightly and light a white frame with a glow around it.
 */
export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const shape: CardVariant = variant === 'episode' ? 'episode' : 'landscape';
  const subtitle = cardSubtitle(t, item);
  const progress = item.userData.progress;
  const art = <CardArt item={item} variant={shape} sizes={SIZES} />;

  if (context === 'preview') {
    return (
      <div className={styles.card} aria-hidden="true">
        {art}
      </div>
    );
  }
  return (
    <AppLink to={linkTo(item)} className={styles.card}>
      {art}
      <span className="visually-hidden">
        {[
          cardTitle(item),
          subtitle,
          progress !== null && t('meta.progress', { percent: Math.round(progress * 100) }),
        ]
          .filter(Boolean)
          .join(', ')}
      </span>
    </AppLink>
  );
}

/** Placeholder with the exact card size while data loads. */
export function MediaCardSkeleton() {
  return <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true" />;
}
