import { setApiLanguage } from '@/api/client';
import { useSessionStore } from '@/api/session-store';
import { changeLanguage, LANGUAGES, type Language } from '@/i18n';
import { useDeviceSettings } from '@/settings/store';

export interface LanguageModel {
  language: Language;
  languages: readonly Language[];
  setLanguage: (language: Language) => void;
}

export function useLanguage(): LanguageModel {
  const language = useDeviceSettings((state) => state.language);
  const store = useDeviceSettings((state) => state.setLanguage);
  return {
    language,
    languages: LANGUAGES,
    setLanguage: (next) => {
      store(next);
      setApiLanguage(next);
      const api = useSessionStore.getState().api;
      api?.update({ deviceInfo: { ...api.deviceInfo, languages: [next] } });
      void changeLanguage(next);
    },
  };
}
