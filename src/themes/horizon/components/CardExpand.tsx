import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, Ref } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { linkTo } from '@/navigation/paths';
import { Icon } from '../../default/components/icons';
import { cardTitle, ratingText, runtimeText, yearText } from '../../default/components/meta';
import { CardArt } from './CardArt';
import styles from './CardExpand.module.css';
import { HorizonButton, HorizonLink } from './HorizonButton';
import type { ExpandAnchor } from './useCardExpand';

/** How much wider than the card the unfolded card is. */
const GROW = 1.12;

interface CardExpandProps {
  item: MediaItem;
  anchor: ExpandAnchor;
  panelRef: Ref<HTMLDivElement>;
  handlers: {
    onPointerLeave: (event: PointerEvent) => void;
    onBlur: (event: FocusEvent) => void;
    onKeyDown: (event: KeyboardEvent) => void;
  };
  onDone: () => void;
  /** The card underneath has the keyboard focus. */
  cardFocused: boolean;
}

/** Same top edge as the card, a little wider, centered on it and kept inside the window. */
function placement(anchor: ExpandAnchor): CSSProperties {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const width = anchor.width * GROW;
  const viewportLeft = window.scrollX + rem;
  const viewportRight = window.scrollX + document.documentElement.clientWidth - rem;
  const centered = anchor.left + anchor.width / 2 - width / 2;
  const left = Math.min(Math.max(centered, viewportLeft), viewportRight - width);
  const growth = (width * 9) / 16 - anchor.height;
  return {
    left,
    top: anchor.top - growth / 2,
    width,
    '--from': String(1 / GROW),
    '--origin-x': `${String(anchor.left + anchor.width / 2 - left)}px`,
  } as CSSProperties;
}

/**
 * The card unfolds downwards: the picture stays where it was (slightly larger), and a panel with
 * title, play, favorite, details, the key facts and the description opens below it, over the
 * next row. Rendered into the page body so the sideways scrolling row cannot clip it.
 */
export function CardExpand({
  item,
  anchor,
  panelRef,
  handlers,
  onDone,
  cardFocused,
}: CardExpandProps) {
  const { t, i18n } = useTranslation('content');
  const { t: tHorizon } = useTranslation('theme-horizon');
  const actions = useMediaActions();
  const rating = ratingText(i18n.language, item.communityRating);
  const facts = [
    yearText(t, item),
    item.kind === 'series' && item.childCount
      ? t('meta.seasons', { count: item.childCount })
      : runtimeText(t, item.runtimeMinutes),
  ].filter((fact): fact is string => Boolean(fact));

  return createPortal(
    // The group only watches pointer, focus and Escape for its buttons; it is not a control.
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions
    <div
      ref={panelRef}
      className={styles.expand}
      style={placement(anchor)}
      role="group"
      aria-label={tHorizon('card.panel', { name: cardTitle(item) })}
      data-card-focused={cardFocused || undefined}
      onPointerLeave={handlers.onPointerLeave}
      onBlur={handlers.onBlur}
      onKeyDown={handlers.onKeyDown}
    >
      <div className={styles.art}>
        <CardArt item={item} variant="landscape" sizes="30rem" />
      </div>
      <div className={styles.panel}>
        <p className={styles.title}>{cardTitle(item)}</p>
        <div className={styles.actions}>
          {isPlayable(item) && (
            <HorizonButton
              variant="primary"
              icon={<Icon name="play" filled />}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                onDone();
                actions.play(item, 'ask');
              }}
            >
              {t('actions.play')}
            </HorizonButton>
          )}
          <HorizonButton
            variant="round"
            aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            aria-pressed={item.userData.favorite}
            icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
            onClick={() => {
              actions.toggleFavorite(item);
            }}
          />
          <HorizonLink
            to={linkTo(item)}
            variant="round"
            aria-label={t('actions.details')}
            icon={<Icon name="info" />}
            onClick={onDone}
          />
        </div>
        <p className={styles.facts}>
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
          {rating && (
            <span className={styles.score}>
              <Icon name="star" filled />
              <span className="visually-hidden">{t('meta.rating')}</span>
              {rating}
            </span>
          )}
        </p>
        {item.overview && <p className={styles.overview}>{item.overview}</p>}
      </div>
    </div>,
    document.body,
  );
}
