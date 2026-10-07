import { create } from 'zustand';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@/i18n';
import { readJson, writeJson } from '@/lib/storage';

/**
 * Device-level settings. Phase 4 adds the per-user settings synced through DisplayPreferences;
 * until then the language is stored on this device only.
 */
interface DeviceSettings {
  language: Language;
  setLanguage: (language: Language) => void;
}

const STORAGE_KEY = 'jellymorph.settings';

function load(): Pick<DeviceSettings, 'language'> {
  const raw = readJson('local', STORAGE_KEY);
  const language =
    typeof raw === 'object' && raw !== null && isLanguage((raw as { language?: unknown }).language)
      ? (raw as { language: Language }).language
      : DEFAULT_LANGUAGE;
  return { language };
}

export const useDeviceSettings = create<DeviceSettings>()((set) => ({
  ...load(),
  setLanguage: (language) => {
    set({ language });
  },
}));

useDeviceSettings.subscribe((state) => {
  writeJson('local', STORAGE_KEY, { language: state.language });
});
