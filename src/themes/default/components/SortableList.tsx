import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutEditorEntry } from '@/settings/model';
import { Icon } from './icons';
import styles from './SortableList.module.css';

interface Drag {
  id: string;
  from: number;
  over: number;
}

function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

/**
 * A list to arrange (phase 14). Pointer and touch users drag the handle; keyboard and remote
 * users take the arrow buttons, which never get disabled (the focus would fall off the page) but
 * do nothing at the ends. Every change is announced. The eye button shows or hides an entry.
 */
export function SortableList({
  labelledBy,
  entries,
  onMove,
  onHiddenChange,
}: {
  labelledBy: string;
  entries: readonly LayoutEditorEntry[];
  onMove: (from: number, to: number) => void;
  onHiddenChange: (id: string, hidden: boolean) => void;
}) {
  const { t } = useTranslation('settings');
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const stopDragRef = useRef<(() => void) | null>(null);
  const firstMovable = entries.filter((entry) => entry.pinned).length;
  const shown = drag ? reorder(entries, drag.from, drag.over) : entries;

  const move = (from: number, to: number) => {
    const entry = entries[from];
    if (!entry || entry.pinned || to < firstMovable || to >= entries.length || from === to) return;
    onMove(from, to);
    setAnnouncement(
      t('layout.moved', { name: entry.label, position: to + 1, total: entries.length }),
    );
  };

  /** Where the dragged row would land: behind every other row whose middle is above the pointer. */
  const targetIndex = (clientY: number, draggedId: string) => {
    const rows = [...(listRef.current?.children ?? [])] as HTMLElement[];
    const before = rows.filter((row) => {
      if (row.dataset.id === draggedId) return false;
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2 < clientY;
    }).length;
    return Math.max(firstMovable, Math.min(entries.length - 1, before));
  };

  useEffect(
    () => () => {
      stopDragRef.current?.();
    },
    [],
  );

  /*
   * The drag follows the pointer on the window, not by pointer capture on the handle: the preview
   * moves the row's DOM node, and moving a node releases its pointer capture.
   */
  const startDrag = (event: ReactPointerEvent<HTMLElement>, index: number) => {
    const entry = entries[index];
    if (!entry || entry.pinned || event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    let current: Drag = { id: entry.id, from: index, over: index };
    setDrag(current);
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const over = targetIndex(moveEvent.clientY, current.id);
      if (over === current.over) return;
      current = { ...current, over };
      setDrag(current);
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      stopDragRef.current = null;
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      stop();
      setDrag(null);
      move(current.from, current.over);
    };
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      stop();
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    stopDragRef.current?.();
    stopDragRef.current = stop;
  };

  return (
    <>
      <ol
        ref={listRef}
        className={styles.list}
        aria-labelledby={labelledBy}
        data-dragging={drag ? true : undefined}
      >
        {shown.map((entry, position) => {
          const index = entries.indexOf(entry);
          const dragging = drag?.id === entry.id;
          return (
            <li
              key={entry.id}
              data-id={entry.id}
              className={[
                styles.row,
                entry.hidden ? styles.hidden : undefined,
                dragging ? styles.dragging : undefined,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={entry.pinned ? `${styles.handle} ${styles.fixed}` : styles.handle}
                aria-hidden="true"
                title={entry.pinned ? undefined : t('layout.drag', { name: entry.label })}
                onPointerDown={(event) => {
                  startDrag(event, index);
                }}
              >
                {!entry.pinned && <Icon name="grip" />}
              </span>
              <span className={styles.label}>
                {entry.label}
                {entry.hidden && (
                  <span className="visually-hidden"> ({t('layout.hiddenState')})</span>
                )}
              </span>
              {(entry.pinned || entry.required) && (
                <span className={styles.note}>
                  {entry.pinned ? t('layout.pinned') : t('layout.required')}
                </span>
              )}
              <span className={styles.tools}>
                {!entry.required && (
                  <button
                    type="button"
                    className={styles.tool}
                    aria-pressed={!entry.hidden}
                    aria-label={t('layout.show', { name: entry.label })}
                    title={t('layout.show', { name: entry.label })}
                    onClick={() => {
                      onHiddenChange(entry.id, !entry.hidden);
                      setAnnouncement(
                        t(entry.hidden ? 'layout.shown' : 'layout.hidden', { name: entry.label }),
                      );
                    }}
                  >
                    <Icon name={entry.hidden ? 'eyeOff' : 'eye'} />
                  </button>
                )}
                {!entry.pinned && (
                  <>
                    <button
                      type="button"
                      className={styles.tool}
                      aria-label={t('layout.moveUp', { name: entry.label })}
                      aria-disabled={position <= firstMovable || undefined}
                      onClick={() => {
                        move(index, index - 1);
                      }}
                    >
                      <Icon name="arrowUp" />
                    </button>
                    <button
                      type="button"
                      className={styles.tool}
                      aria-label={t('layout.moveDown', { name: entry.label })}
                      aria-disabled={position >= entries.length - 1 || undefined}
                      onClick={() => {
                        move(index, index + 1);
                      }}
                    >
                      <Icon name="arrowDown" />
                    </button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
