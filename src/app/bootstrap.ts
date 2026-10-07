import { parseAppConfig, type AppConfig } from '@/config/app-config';
import { initI18n } from '@/i18n';
import { installInputModality } from '@/navigation/input-modality';
import { useDeviceSettings } from '@/settings/store';
import { DemoUnavailableError } from './boot-error';

/** Everything that has to happen before the first render. */
export async function bootstrap(): Promise<AppConfig> {
  const { config, warnings } = parseAppConfig(window.__APP_CONFIG__);
  for (const warning of warnings) console.warn(`[config] ${warning}`);
  document.title = config.appTitle;
  installInputModality();

  if (config.demoMode) {
    try {
      const { startDemoServer } = await import('@/mocks/browser');
      await startDemoServer();
    } catch (error) {
      throw new DemoUnavailableError(error);
    }
  }

  await initI18n(useDeviceSettings.getState().language);
  return config;
}
