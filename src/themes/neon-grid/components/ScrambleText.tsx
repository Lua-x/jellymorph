import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import styles from './ScrambleText.module.css';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>?';
const DURATION_MS = 650;
const FRAME_MS = 40;

/**
 * Text that decodes itself from random glyphs when it appears (titles only, never body text).
 * The real text keeps its place in the layout and in the accessibility tree; the scrambled
 * copy is a decorative layer on top. With reduced motion the text just appears.
 */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const layer = layerRef.current;
    if (reduced || !root || !layer || document.documentElement.dataset.device === 'tv') return;
    // Graphemes, so umlauts with combining marks and emoji stay whole.
    const characters = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (part) => part.segment,
    );
    const start = performance.now();
    let last = 0;
    let frame = 0;
    root.dataset.active = 'true';
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      if (now - last >= FRAME_MS || progress === 1) {
        last = now;
        // Characters resolve from left to right; spaces stay spaces so words keep their shape.
        const resolved = Math.floor(progress * characters.length);
        layer.textContent = characters
          .map((char, index) =>
            index < resolved || char.trim() === ''
              ? char
              : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? char),
          )
          .join('');
      }
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        delete root.dataset.active;
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      delete root.dataset.active;
    };
  }, [text, reduced]);

  return (
    <span ref={rootRef} className={className ? `${styles.root} ${className}` : styles.root}>
      <span className={styles.text}>{text}</span>
      <span ref={layerRef} className={styles.layer} aria-hidden="true" />
    </span>
  );
}
