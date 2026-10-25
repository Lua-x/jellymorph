/**
 * What a theme's SettingsPage receives (docs/architecture.md §7.1, §10): current values and
 * commands. Wording comes from the "settings" translations; values are plain identifiers.
 */
import type { ThemeId } from '@/config/theme-ids';
import type { LayoutListId } from '@/domain/layout';
import type { LanguageOption, PlaybackPreferences, QueryResult } from '@/domain/types';
import type { Language } from '@/i18n';
import type { DeviceKind } from '@/navigation/device';
import type { QualityOption } from '@/player/model';
import type { ColorSchemePreference, DeviceMode, MotionPreference } from './schema';
import type { SyncState } from './user-settings';

export type ColorScheme = 'dark' | 'light';

export interface ThemeChoice {
  id: ThemeId;
  name: string;
  description: string;
  /** Screenshot per color scheme (asset URLs). */
  preview: Partial<Record<ColorScheme, string>>;
  colorSchemes: readonly ColorScheme[];
  /** The theme has interface sounds (offer the switch). */
  uiSounds: boolean;
  /** Installed in the container as a plugin (phase 17), not part of Jellymorph. */
  plugin: boolean;
}

/** Whose arrangement the editor changes: the user's own, or the default for everybody (admins). */
export type LayoutScope = 'own' | 'everybody';

export interface LayoutEditorEntry {
  id: string;
  label: string;
  hidden: boolean;
  /** Keeps its place (the hero). */
  pinned: boolean;
  /** Cannot be hidden ("Play"). */
  required: boolean;
}

export interface LayoutEditorList {
  id: LayoutListId;
  entries: readonly LayoutEditorEntry[];
  /** This list has its own arrangement in the scope (otherwise it follows the next level). */
  customized: boolean;
  move: (from: number, to: number) => void;
  setHidden: (id: string, hidden: boolean) => void;
  reset: () => void;
}

export interface LayoutDistribution {
  state: 'idle' | 'saving' | 'saved' | 'error';
  written: number;
  failed: number;
  total: number;
}

/** Arrangement of home page, navigation, detail buttons and facts (phase 14). */
export interface LayoutEditorModel {
  scope: LayoutScope;
  /** Administrators can also edit the default for everybody. */
  canEditDefault: boolean;
  setScope: (scope: LayoutScope) => void;
  lists: readonly LayoutEditorList[];
  /** The default for everybody is edited as a draft and saved for all users at once. */
  draftChanged: boolean;
  saveDefault: () => void;
  discardDefault: () => void;
  distribution: LayoutDistribution;
}

export interface AccountModel {
  userName: string;
  serverName: string;
  serverVersion: string;
  switchProfile: () => void;
  /** null when the deployment fixes the server. */
  changeServer: (() => void) | null;
  signOut: () => void;
  signingOut: boolean;
}

export interface SettingsModel {
  // Appearance (synced through the user's DisplayPreferences)
  themes: readonly ThemeChoice[];
  /** The chosen theme; it may still be loading (compare with the active theme). */
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  colorScheme: ColorSchemePreference;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  motion: MotionPreference;
  setMotion: (motion: MotionPreference) => void;
  trailerAutoplay: boolean;
  setTrailerAutoplay: (enabled: boolean) => void;
  uiSounds: boolean;
  setUiSounds: (enabled: boolean) => void;
  language: Language;
  languages: readonly Language[];
  setLanguage: (language: Language) => void;

  // This device only
  deviceMode: DeviceMode;
  /** What 'auto' resolved to, or the fixed choice. */
  device: DeviceKind;
  setDeviceMode: (mode: DeviceMode) => void;
  /** 0–0.05 of the screen size. */
  overscan: number;
  maxOverscan: number;
  setOverscan: (overscan: number) => void;
  maxBitrate: number | null;
  qualities: readonly QualityOption[];
  setMaxBitrate: (maxBitrate: number | null) => void;
  burnInStyled: boolean;
  setBurnInStyled: (enabled: boolean) => void;

  // Jellyfin user configuration (shared with other Jellyfin apps)
  playback: QueryResult<PlaybackPreferences>;
  setPlayback: (patch: Partial<PlaybackPreferences>) => void;
  audioLanguages: QueryResult<LanguageOption[]>;

  layout: LayoutEditorModel;

  /** Saving state of the synced values. */
  sync: SyncState;
  retrySync: () => void;

  account: AccountModel;
}
