import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaTrack } from '@/domain/types';
import styles from './Expandable.module.css';

/** Theme classes for the text and the toggle button; every theme styles both. */
export interface ExpandableClasses {
  text?: string;
  toggle?: string;
}

function join(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/**
 * A long text (a description) cut to a few lines with "Show more"; open, it shows the whole text
 * with its paragraphs. The button only appears when the text is really cut off.
 */
export function ExpandableText({
  text,
  lines = 4,
  classes = {},
}: {
  text: string;
  lines?: number;
  classes?: ExpandableClasses;
}) {
  const { t } = useTranslation('content');
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  // Bound to the text: another title starts shortened again.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const expanded = expandedFor === text;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [text, lines, expanded]);

  return (
    <div className={styles.root}>
      <p
        id={id}
        ref={ref}
        className={join(styles.text, !expanded && styles.clamped, classes.text)}
        style={{ '--lines': lines } as CSSProperties}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          className={join(styles.toggle, classes.toggle)}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            setExpandedFor(expanded ? null : text);
          }}
        >
          {expanded ? t('actions.showLess') : t('actions.showMore')}
        </button>
      )}
    </div>
  );
}

/**
 * Entries one per line (tracks, studios); beyond `limit` the rest opens with "+ n more".
 */
export function ShortList({
  entries,
  limit = 3,
  classes = {},
}: {
  entries: readonly string[];
  limit?: number;
  classes?: ExpandableClasses;
}) {
  const { t } = useTranslation('content');
  const id = useId();
  const [open, setOpen] = useState(false);
  const hidden = entries.length - limit;
  // One more line costs less room than the button, so a single extra entry is just shown.
  const collapsible = hidden > 1;
  const shown = collapsible && !open ? entries.slice(0, limit) : entries;

  return (
    <div className={styles.root}>
      <ul id={id} className={join(styles.tracks, classes.text)}>
        {shown.map((entry, index) => (
          <li key={`${String(index)}-${entry}`}>{entry}</li>
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          className={join(styles.toggle, classes.toggle)}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? t('actions.showLess') : t('actions.showMoreCount', { count: hidden })}
        </button>
      )}
    </div>
  );
}

/** Sound or subtitle tracks, three shown, the rest behind "+ n more". */
export function TrackList({
  tracks,
  limit,
  classes,
}: {
  tracks: readonly MediaTrack[];
  limit?: number;
  classes?: ExpandableClasses;
}) {
  return <ShortList entries={tracks.map((track) => track.title)} limit={limit} classes={classes} />;
}
