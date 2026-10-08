import { useEffect, useLayoutEffect } from 'react';
import { setApiLanguage } from '@/api/client';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import i18next from 'i18next';
import { changeLanguage } from '@/i18n';
import { useDeviceKind } from '@/navigation/device';
import { installSpatialNavigation } from '@/navigation/spatial';
import { useAppearance } from '@/settings/appearance';
import { useDeviceSettings } from '@/settings/store';

/**
 * Document-wide state outside the themes: device kind and TV overscan on <html> (§8), the UI
 * language of the current user, and the arrow-key navigation.
 */
export function Environment() {
  const { defaultTheme } = useAppConfig();
  const device = useDeviceKind();
  const overscan = useDeviceSettings((state) => state.overscan);
  const { language } = useAppearance(defaultTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.device = device;
    root.style.setProperty('--overscan', String(device === 'tv' ? overscan : 0));
  }, [device, overscan]);

  useEffect(() => {
    if (i18next.language === language) return;
    setApiLanguage(language);
    const api = useSessionStore.getState().api;
    api?.update({ deviceInfo: { ...api.deviceInfo, languages: [language] } });
    void changeLanguage(language);
  }, [language]);

  useEffect(() => installSpatialNavigation(), []);

  return null;
}
