import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './VirtualGrid.module.css';

export interface VirtualGridHandle {
  /** Scrolls the item into view and moves focus into it. */
  focusIndex: (index: number) => void;
}

interface VirtualGridProps {
  count: number;
  /** Minimum card width in rem; columns fill the available width. */
  minColumnWidth: number;
  /** Card media aspect ratio (width / height). */
  aspectRatio: number;
  /** Height below the media (caption) in rem. */
  extraHeight: number;
  /** Gap between cards in rem. */
  gap: number;
  /** Renders one cell; must contain a focusable element (link or button). */
  renderItem: (index: number) => ReactNode;
  /** Visible index range, so the data layer can load what is needed. */
  onRangeChange: (start: number, end: number) => void;
  label: string;
  /** Scroll back to the top when this changes (new sort or filter). */
  resetKey: string;
  handleRef?: Ref<VirtualGridHandle>;
}

function rootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]';

/**
 * Virtualized, responsive card grid that scrolls with the page. Only visible rows exist in the
 * DOM; arrow keys, Home/End and Page Up/Down move focus across all items, including rows that
 * are not rendered yet.
 */
export function VirtualGrid({
  count,
  minColumnWidth,
  aspectRatio,
  extraHeight,
  gap,
  renderItem,
  onRangeChange,
  label,
  resetKey,
  handleRef,
}: VirtualGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 0, rem: 16, top: 0 });

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setLayout({ width: rect.width, rem: rootFontSize(), top: rect.top + window.scrollY });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const gapPx = gap * layout.rem;
  const columns = Math.max(
    1,
    Math.floor((layout.width + gapPx) / (minColumnWidth * layout.rem + gapPx)),
  );
  const cellWidth = layout.width > 0 ? (layout.width - gapPx * (columns - 1)) / columns : 0;
  const rowHeight = cellWidth / aspectRatio + extraHeight * layout.rem + gapPx;
  const rows = Math.ceil(count / columns);

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowHeight || 300,
    overscan: 3,
    scrollMargin: layout.top,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const firstRow = virtualRows[0]?.index ?? 0;
  const lastRow = virtualRows.at(-1)?.index ?? 0;

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, columns]);

  useEffect(() => {
    if (count > 0)
      onRangeChange(firstRow * columns, Math.min(count - 1, (lastRow + 1) * columns - 1));
  }, [firstRow, lastRow, columns, count, onRangeChange]);

  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    if (window.scrollY > layout.top) window.scrollTo({ top: Math.max(0, layout.top - 200) });
    // Only on a new result set, not when the layout moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const focusIndex = (index: number) => {
    const target = Math.max(0, Math.min(count - 1, index));
    virtualizer.scrollToIndex(Math.floor(target / columns), { align: 'auto' });
    let attempts = 0;
    const tryFocus = () => {
      const cell = containerRef.current?.querySelector<HTMLElement>(
        `[data-item-index="${String(target)}"]`,
      );
      const focusable = cell?.querySelector<HTMLElement>(FOCUSABLE);
      if (focusable) {
        focusable.focus({ preventScroll: true });
        focusable.scrollIntoView({ block: 'nearest' });
      } else if (attempts < 20) {
        attempts += 1;
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
  };

  useImperativeHandle(handleRef, () => ({ focusIndex }));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-item-index]');
    if (!cell || event.altKey || event.metaKey) return;
    const index = Number(cell.dataset.itemIndex);
    const pageRows = Math.max(1, Math.floor(window.innerHeight / (rowHeight || 1)));
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      PageDown: index + columns * pageRows,
      PageUp: index - columns * pageRows,
      Home: event.ctrlKey ? 0 : index - (index % columns),
      End: event.ctrlKey ? count - 1 : Math.min(count - 1, index - (index % columns) + columns - 1),
    };
    const next = moves[event.key];
    if (next === undefined || next < 0 || next >= count || next === index) return;
    event.preventDefault();
    focusIndex(next);
  };

  return (
    // Arrow keys move focus between the links inside; the list itself never takes focus.
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- keyboard delegation
    <div
      ref={containerRef}
      className={styles.grid}
      role="list"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ height: `${String(virtualizer.getTotalSize())}px` }}
    >
      {virtualRows.map((row) => {
        const start = row.index * columns;
        const indices = Array.from(
          { length: Math.min(columns, count - start) },
          (_, offset) => start + offset,
        );
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className={styles.row}
            style={{
              paddingBottom: `${String(gap)}rem`,
              transform: `translateY(${String(row.start - virtualizer.options.scrollMargin)}px)`,
              gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
              gap: `${String(gap)}rem`,
            }}
          >
            {indices.map((index) => (
              <div
                key={index}
                role="listitem"
                aria-posinset={index + 1}
                aria-setsize={count}
                data-item-index={index}
                className={styles.cell}
              >
                {renderItem(index)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
