import { useTranslation } from 'react-i18next';
import { linkTo } from '@/navigation/paths';
import { AppLink } from '@/ui/AppLink';
import type { CardVariant, MediaCardProps } from '../../contract';
import { cardSubtitle, cardTitle } from '../../default/components/meta';
import { CardPreview } from './CardPreview';
import { useCardPreview } from './useCardPreview';
import styles from './MediaCard.module.css';
import { CardArt } from './MediaCardArt';

const SIZES = '(min-width: 120rem) 16vw, (min-width: 64rem) 20vw, (min-width: 40rem) 33vw, 70vw';

/**
 * Wide card; the picture carries the title. Resting on it (pointer, keyboard or remote) opens the
 * enlarged preview after about 400 ms. Links open the details as an overlay.
 */
export function MediaCard({ item, variant, context }: MediaCardProps) {
  const { t } = useTranslation('content');
  const { anchor, cardFocused, cardRef, previewRef, cardHandlers, previewHandlers, close } =
    useCardPreview(context === 'page');
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
        overlay
        className={styles.card}
        data-previewing={anchor ? true : undefined}
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
        <CardPreview
          item={item}
          anchor={anchor}
          previewRef={previewRef}
          handlers={previewHandlers}
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
