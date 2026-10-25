import { parseAppConfig, type AppConfig } from '@/config/app-config';
import { isBuiltInThemeId } from '@/config/theme-ids';
import { initI18n } from '@/i18n';
import { installInputModality } from '@/navigation/input-modality';
import { useDeviceSettings } from '@/settings/store';
import { registerPluginThemes } from '@/themes/registry';
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
  if (config.themePlugins.length > 0) await setUpPluginThemes(config);
  return config;
}

/**
 * Plugin themes (phase 17): the interface they import, and their theme.json files, before the
 * first render, so the settings list them and a stored choice applies at once. Their code loads
 * only when the theme is shown. Loaded as separate chunks: without plugins nothing changes.
 */
async function setUpPluginThemes(config: AppConfig) {
  const [{ installPluginApi }, { loadPluginThemes }] = await Promise.all([
    import('@/plugin-api/install'),
    import('@/plugin-api/themes'),
  ]);
  installPluginApi();
  const { manifests, problems } = await loadPluginThemes(config.themePlugins);
  for (const problem of problems) console.warn(`[plugins] ${problem}`);
  registerPluginThemes(manifests);
  if (
    !isBuiltInThemeId(config.defaultTheme) &&
    !manifests.some(({ id }) => id === config.defaultTheme)
  ) {
    console.warn(`[config] defaultTheme "${config.defaultTheme}" is not available; using Classic.`);
  }
}
