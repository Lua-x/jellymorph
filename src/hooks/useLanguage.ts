import { useAppConfig } from '@/config/context';
import { LANGUAGES, type Language } from '@/i18n';
import { useAppearance } from '@/settings/appearance';
import { useDeviceSettings } from '@/settings/store';
import { useUserSettings } from '@/settings/user-settings';

export interface LanguageModel {
  language: Language;
  languages: readonly Language[];
  setLanguage: (language: Language) => void;
}

/**
 * The UI language: a setting of the signed-in user, otherwise of this device. The app applies
 * changes (app/Environment.tsx).
 */
export function useLanguage(): LanguageModel {
  const { defaultTheme } = useAppConfig();
  const { language } = useAppearance(defaultTheme);
  return {
    language,
    languages: LANGUAGES,
    setLanguage: (next) => {
      const user = useUserSettings.getState();
      if (user.owner) user.update({ language: next });
      else useDeviceSettings.getState().setLanguage(next);
    },
  };
}
