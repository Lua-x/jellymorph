import { useTranslation } from 'react-i18next';
import { useAppConfig } from '@/config/context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLanguage } from '@/hooks/useLanguage';
import { useLayoutEditor } from '@/hooks/useLayoutEditor';
import { useNavModel } from '@/hooks/useNavModel';
import { useLanguageOptions, usePlaybackPreferences } from '@/hooks/usePlaybackPreferences';
import { useActiveSession } from '@/hooks/useSession';
import { retrySettingsSave } from '@/hooks/useSettingsSync';
import { useDeviceKind } from '@/navigation/device';
import { QUALITY_OPTIONS } from '@/player/model';
import { useAppearance } from '@/settings/appearance';
import type { SettingsModel, ThemeChoice } from '@/settings/model';
import { MAX_OVERSCAN, useDeviceSettings } from '@/settings/store';
import { useUserSettings } from '@/settings/user-settings';
import { useThemeOptions } from '@/themes/context';
import { useThemeNames } from '@/themes/names';
import { allThemes, getThemeManifest, usePluginFailures } from '@/themes/registry';
import { ThemeSlot } from '@/themes/ThemeSlot';

export function SettingsRoute() {
  const { t } = useTranslation(['settings', 'themes']);
  useDocumentTitle(t('title'));
  const { defaultTheme } = useAppConfig();
  const appearance = useAppearance(defaultTheme);
  const language = useLanguage();
  const device = useDeviceKind();
  const deviceMode = useDeviceSettings((state) => state.deviceMode);
  const overscan = useDeviceSettings((state) => state.overscan);
  const player = useDeviceSettings((state) => state.player);
  const sync = useUserSettings((state) => state.sync);
  const trailerAutoplay = useUserSettings((state) => state.values?.trailerPreview ?? false);
  const uiSounds = useUserSettings((state) => state.values?.uiSounds ?? false);
  const playback = usePlaybackPreferences();
  const audioLanguages = useLanguageOptions();
  const nav = useNavModel();
  const { server } = useActiveSession();
  const layout = useLayoutEditor(useThemeOptions().layout);

  const update = useUserSettings.getState().update;
  const deviceSettings = useDeviceSettings.getState();

  const themeNames = useThemeNames();
  // Plugins that failed to load leave the list (re-render when that happens).
  usePluginFailures((state) => state.failed);
  const themes: ThemeChoice[] = allThemes().map((manifest) => ({
    id: manifest.id,
    ...themeNames(manifest),
    plugin: manifest.plugin !== undefined,
    preview: manifest.preview,
    colorSchemes: manifest.colorSchemes,
    uiSounds: manifest.features?.uiSounds ?? false,
  }));

  const settings: SettingsModel = {
    themes,
    // A stored theme that is not installed (any more) shows as Classic, as it is rendered.
    theme: getThemeManifest(appearance.theme).id,
    setTheme: (theme) => {
      update({ theme });
    },
    colorScheme: appearance.colorScheme,
    setColorScheme: (colorScheme) => {
      update({ colorScheme });
    },
    motion: appearance.motion,
    setMotion: (motion) => {
      update({ motion });
    },
    trailerAutoplay,
    setTrailerAutoplay: (trailerAutoplay) => {
      update({ trailerPreview: trailerAutoplay });
    },
    uiSounds,
    setUiSounds: (uiSounds) => {
      update({ uiSounds });
    },
    language: language.language,
    languages: language.languages,
    setLanguage: language.setLanguage,
    deviceMode,
    device,
    setDeviceMode: deviceSettings.setDeviceMode,
    overscan,
    maxOverscan: MAX_OVERSCAN,
    setOverscan: deviceSettings.setOverscan,
    maxBitrate: player.maxBitrate,
    qualities: QUALITY_OPTIONS,
    setMaxBitrate: (maxBitrate) => {
      deviceSettings.setPlayer({ maxBitrate });
    },
    burnInStyled: player.burnInStyled,
    setBurnInStyled: (burnInStyled) => {
      deviceSettings.setPlayer({ burnInStyled });
    },
    playback: playback.preferences,
    setPlayback: playback.update,
    audioLanguages,
    layout,
    sync,
    retrySync: retrySettingsSave,
    account: {
      userName: nav.user.name,
      serverName: server.name,
      serverVersion: server.version,
      switchProfile: nav.switchProfile,
      changeServer: nav.changeServer,
      signOut: nav.signOut,
      signingOut: nav.signingOut,
    },
  };

  return <ThemeSlot name="SettingsPage" props={{ settings }} />;
}
