import { useMediaQuery } from '@/lib/use-media-query';

/**
 * Whether animations should be reduced. Phase 4 adds the in-app setting; until then the system
 * preference decides (the same source ThemeProvider uses for `data-motion`).
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
