import { useUserSettings } from '@/settings/user-settings';

/**
 * Whether the user turned on interface sounds. Themes that declare `features.uiSounds` play
 * their sounds only while this is true; it is off by default and outside a session.
 */
export function useUiSounds(): boolean {
  return useUserSettings((state) => state.values?.uiSounds ?? false);
}
