import { useTranslation } from 'react-i18next';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import type { CardVariant, MediaCardProps } from '../../contract';
import { cardSubtitle, cardTitle } from '../../default/components/meta';
import { CardArt } from './CardArt';
import { CardExpand } from './CardExpand';
import styles from './MediaCard.module.css';
import { useCardExpand } from './useCardExpand';

const SIZES = '(min-width: 120rem) 16vw, (min-width: 64rem) 20vw, (min-width: 40rem) 33vw, 70vw';

/**
 * A 16:9 card; the picture carries the title. Resting on it (pointer, keyboard or remote) unfolds
 * it downwards after a quarter of a second, with actions, facts and the description.
 */
export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const { anchor, cardFocused, cardRef, panelRef, cardHandlers, panelHandlers, close } =
    useCardExpand(context === 'page');
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
    <>
      <AppLink
        ref={cardRef}
        to={linkTo(item)}
        className={styles.card}
        data-expanded={anchor ? true : undefined}
        {...cardHandlers}
      >
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
      {anchor && (
        <CardExpand
          item={item}
          anchor={anchor}
          panelRef={panelRef}
          handlers={panelHandlers}
          onDone={close}
          cardFocused={cardFocused}
        />
      )}
    </>
  );
}

/** Placeholder with the exact card size while data loads. */
export function MediaCardSkeleton() {
  return <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true" />;
}
