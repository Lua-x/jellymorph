import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

export interface ScrubberOptions {
  duration: number;
  value: number;
  onSeek: (seconds: number) => void;
  /** Called when scrubbing starts or ends (e.g. to keep the player controls visible). */
  onActiveChange?: (active: boolean) => void;
  /** Seconds per arrow key press. */
  step?: number;
}

export interface Scrubber {
  /** Position under the pointer, while dragging or hovering; null otherwise. */
  previewTime: number | null;
  dragging: boolean;
  /** Spread onto the track element (role="slider" with keyboard and pointer support). */
  trackProps: {
    ref: RefObject<HTMLDivElement | null>;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerLeave: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  };
}

/**
 * Theme-neutral timeline behavior: click or drag to seek, hover for a preview position, ← and →
 * (±step), Page Up/Down (±60 s), Home and End on the keyboard. ↑ and ↓ are left to the focus
 * navigation between the player controls.
 */
export function useScrubber({
  duration,
  value,
  onSeek,
  onActiveChange,
  step = 10,
}: ScrubberOptions): Scrubber {
  const ref = useRef<HTMLDivElement>(null);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const timeAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || duration <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  return {
    previewTime,
    dragging,
    trackProps: {
      ref,
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        setPreviewTime(timeAt(event.clientX));
        onActiveChange?.(true);
      },
      onPointerMove: (event) => {
        setPreviewTime(timeAt(event.clientX));
      },
      onPointerUp: (event) => {
        if (!dragging) return;
        setDragging(false);
        onSeek(timeAt(event.clientX));
        onActiveChange?.(false);
        if (event.pointerType !== 'mouse') setPreviewTime(null);
      },
      onPointerCancel: () => {
        setDragging(false);
        setPreviewTime(null);
        onActiveChange?.(false);
      },
      onPointerLeave: () => {
        if (!dragging) setPreviewTime(null);
      },
      onKeyDown: (event) => {
        const deltas: Record<string, number> = {
          ArrowLeft: -step,
          ArrowRight: step,
          PageDown: -60,
          PageUp: 60,
        };
        let target: number | null = null;
        if (event.key in deltas) target = value + (deltas[event.key] ?? 0);
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = duration;
        if (target === null) return;
        event.preventDefault();
        onSeek(Math.min(duration, Math.max(0, target)));
      },
    },
  };
}
