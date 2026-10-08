import { useMotionPreference } from './useMotionPreference';

/** Whether animations should be reduced (setting or system preference, see useMotionPreference). */
export function useReducedMotion(): boolean {
  return useMotionPreference() === 'reduced';
}
