import type { ThemeId } from '@/config/theme-ids';
import type { Language } from '@/i18n';
import type { ColorSchemePreference, MotionPreference } from './schema';
import { useDeviceSettings } from './store';
import { useUserSettings } from './user-settings';

export interface Appearance {
  theme: ThemeId;
  colorScheme: ColorSchemePreference;
  motion: MotionPreference;
  language: Language;
}

/**
 * The look currently asked for: the signed-in user's settings, otherwise the last ones used on
 * this device, otherwise the deployment's default theme.
 */
export function useAppearance(defaultTheme: ThemeId): Appearance {
  const user = useUserSettings((state) => state.values);
  const device = useDeviceSettings((state) => state.appearance);
  const deviceLanguage = useDeviceSettings((state) => state.language);
  if (user) {
    return {
      theme: user.theme,
      colorScheme: user.colorScheme,
      motion: user.motion,
      language: user.language,
    };
  }
  return {
    theme: device.theme ?? defaultTheme,
    colorScheme: device.colorScheme,
    motion: device.motion,
    language: deviceLanguage,
  };
}
