import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Motion for Glass components: only the light DOM animation features (no layout animations),
 * and no movement when the user asked for reduced motion. Components rendered outside the shell
 * (the settings preview, the player) wrap themselves.
 */
export function GlassMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </LazyMotion>
  );
}
