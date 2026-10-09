import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, Ref } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/domain/types';
import { isPlayable, useMediaActions } from '@/hooks/useMediaActions';
import { linkTo } from '@/navigation/paths';
import { Icon } from '../../default/components/icons';
import { ratingText, runtimeText, yearText } from '../../default/components/meta';
import styles from './CardPreview.module.css';
import type { PreviewAnchor } from './useCardPreview';
import { CrimsonButton, CrimsonLink } from './CrimsonButton';
import { CardArt } from './MediaCardArt';

const SCALE = 1.5;
const MIN_WIDTH_REM = 20;

interface CardPreviewProps {
  item: MediaItem;
  anchor: PreviewAnchor;
  previewRef: Ref<HTMLDivElement>;
  handlers: {
    onPointerLeave: (event: PointerEvent) => void;
    onBlur: (event: FocusEvent) => void;
    onKeyDown: (event: KeyboardEvent) => void;
  };
  onDone: () => void;
  /** The card underneath has the keyboard focus. */
  cardFocused: boolean;
}

/** Where the enlarged card goes: centered over the card, kept inside the page gutters. */
function placement(anchor: PreviewAnchor): CSSProperties {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const width = Math.max(anchor.width * SCALE, MIN_WIDTH_REM * rem);
  const imageHeight = (width * 9) / 16;
  const gutter = rem;
  const viewportLeft = window.scrollX + gutter;
  const viewportRight = window.scrollX + document.documentElement.clientWidth - gutter;
  const centered = anchor.left + anchor.width / 2 - width / 2;
  const left = Math.min(Math.max(centered, viewportLeft), viewportRight - width);
  const top = anchor.top + anchor.height / 2 - imageHeight / 2;
  return {
    left,
    top,
    width,
    // It grows out of the card: start at the card's size, around the card's center.
    '--origin-x': `${String(anchor.left + anchor.width / 2 - left)}px`,
    '--origin-y': `${String(anchor.height / 2 + (imageHeight - anchor.height) / 2)}px`,
    '--from': String(anchor.width / width),
  } as CSSProperties;
}

/**
 * The enlarged card with play, favorite, watched and details plus the key facts. Rendered into
 * the page body so rows (which scroll sideways) cannot clip it.
 */
export function CardPreview({
  item,
  anchor,
  previewRef,
  handlers,
  onDone,
  cardFocused,
}: CardPreviewProps) {
  const { t, i18n } = useTranslation('content');
  const { t: tCrimson } = useTranslation('theme-crimson');
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
      ref={previewRef}
      className={styles.preview}
      style={placement(anchor)}
      role="group"
      data-card-focused={cardFocused || undefined}
      aria-label={tCrimson('preview.label', { name: item.name })}
      onPointerLeave={handlers.onPointerLeave}
      onBlur={handlers.onBlur}
      onKeyDown={handlers.onKeyDown}
    >
      <div className={styles.art}>
        <CardArt item={item} variant="landscape" sizes="30rem" />
      </div>
      <div className={styles.info}>
        <div className={styles.actions}>
          {isPlayable(item) && (
            <CrimsonButton
              variant="light"
              className={styles.play}
              aria-label={t('actions.play')}
              icon={<Icon name="play" filled />}
              onFocus={actions.preparePlayback}
              onPointerEnter={actions.preparePlayback}
              onClick={() => {
                onDone();
                actions.play(item, 'ask');
              }}
            />
          )}
          <CrimsonButton
            variant="round"
            aria-label={item.userData.favorite ? t('actions.unfavorite') : t('actions.favorite')}
            aria-pressed={item.userData.favorite}
            icon={<Icon name={item.userData.favorite ? 'check' : 'plus'} />}
            onClick={() => {
              actions.toggleFavorite(item);
            }}
          />
          {item.kind !== 'series' && item.kind !== 'collection' && (
            <CrimsonButton
              variant="round"
              aria-label={
                item.userData.played ? t('actions.markUnplayed') : t('actions.markPlayed')
              }
              aria-pressed={item.userData.played}
              icon={<Icon name="eye" />}
              onClick={() => {
                actions.togglePlayed(item);
              }}
            />
          )}
          <CrimsonLink
            to={linkTo(item)}
            overlay
            variant="round"
            className={styles.more}
            aria-label={tCrimson('preview.more', { name: item.name })}
            icon={<Icon name="chevronDown" />}
            onClick={onDone}
          />
        </div>
        <p className={styles.facts}>
          {item.officialRating && <span className={styles.badge}>{item.officialRating}</span>}
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {rating && (
            <span className={styles.score}>
              <Icon name="star" filled />
              <span className="visually-hidden">{t('meta.rating')}</span>
              {rating}
            </span>
          )}
        </p>
        {item.genres.length > 0 && (
          <p className={styles.genres}>
            {item.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
