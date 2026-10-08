import { useAppConfig } from '@/config/context';
import { useMediaQuery } from '@/lib/use-media-query';
import { useAppearance } from '@/settings/appearance';

/**
 * 'reduced' when the user turned motion down in the settings, or left it on "system" and the
 * operating system asks for less motion (architecture §7.7).
 */
export function useMotionPreference(): 'full' | 'reduced' {
  const { defaultTheme } = useAppConfig();
  const { motion } = useAppearance(defaultTheme);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (motion === 'system') return systemReduced ? 'reduced' : 'full';
  return motion;
}
