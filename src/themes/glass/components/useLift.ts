import { useSpring, useTransform } from 'motion/react';
import { useRef, type FocusEvent, type PointerEvent } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SPRING_SOFT } from './springs';

/** Largest tilt towards the pointer, in degrees, at the card's edge. */
const TILT = 7;
/** How much a focused or hovered card grows. */
const LIFT = 1.08;
/** Around the centre the card stays level (no jitter from tiny pointer moves). */
const DEAD_ZONE = 0.04;

const level = (value: number) => (Math.abs(value) < DEAD_ZONE ? 0 : value);

/**
 * The focus effect of Glass cards: the card lifts when focused or hovered; under a mouse it
 * also leans towards the pointer and a soft light follows it, all settling with springs.
 * Keyboard and remote focus lift it straight up. Reduced motion: no tilt, no animation.
 * Spread `handlers` on the focusable element, `tileStyle` on the moving tile (an `m` element)
 * and `glareStyle` on the light.
 */
export function useLift() {
  const reduced = useReducedMotion();
  // Pointer position relative to the centre (-0.5 … 0.5), smoothed by springs.
  const pointerX = useSpring(0, SPRING_SOFT);
  const pointerY = useSpring(0, SPRING_SOFT);
  const scale = useSpring(1, SPRING_SOFT);
  const rotateY = useTransform(pointerX, (value) => value * TILT * 2);
  const rotateX = useTransform(pointerY, (value) => value * -TILT * 2);
  const glareX = useTransform(pointerX, (value) => `${String(value * 70)}%`);
  const glareY = useTransform(pointerY, (value) => `${String(value * 70)}%`);
  const hovered = useRef(false);
  const focused = useRef(false);

  const settle = () => {
    const target = hovered.current || focused.current ? LIFT : 1;
    if (reduced) scale.jump(target);
    else scale.set(target);
  };
  const lean = (x: number, y: number) => {
    if (reduced) return;
    pointerX.set(level(x));
    pointerY.set(level(y));
  };

  const handlers = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return;
      hovered.current = true;
      settle();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return;
      const rect = event.currentTarget.getBoundingClientRect();
      lean(
        (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5,
        (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5,
      );
    },
    onPointerLeave: () => {
      hovered.current = false;
      lean(0, 0);
      settle();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      // Keyboard and remote focus only; a click navigates anyway.
      if (!event.currentTarget.matches(':focus-visible')) return;
      focused.current = true;
      settle();
    },
    onBlur: () => {
      focused.current = false;
      settle();
    },
  };

  return {
    handlers,
    tileStyle: { rotateX, rotateY, scale, transformPerspective: 900 },
    glareStyle: { x: glareX, y: glareY },
  };
}
