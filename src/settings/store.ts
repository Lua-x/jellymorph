import { create } from 'zustand';
import { isThemeId, type ThemeId } from '@/config/theme-ids';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@/i18n';
import { readJson, writeJson } from '@/lib/storage';
import {
  COLOR_SCHEME_PREFERENCES,
  DEVICE_MODES,
  MOTION_PREFERENCES,
  type ColorSchemePreference,
  type DeviceMode,
  type MotionPreference,
} from './schema';

/** Player settings that depend on this device and its network, so they stay local (§10). */
export interface PlayerPreferences {
  /** Upper limit for streaming, null = measured automatically. */
  maxBitrate: number | null;
  /** 0..1 */
  volume: number;
  muted: boolean;
  /** Burn styled (ASS/SSA) subtitles into the picture instead of showing plain text. */
  burnInStyled: boolean;
}

/** Look of the app before anyone signs in: the last one used on this device. */
export interface DeviceAppearance {
  /** null = the deployment's DEFAULT_THEME. */
  theme: ThemeId | null;
  colorScheme: ColorSchemePreference;
  motion: MotionPreference;
}

/**
 * Settings of this device. User settings that follow the user to other devices live in
 * user-settings.ts; the last values used here are mirrored for the sign-in screens.
 */
interface DeviceSettings {
  language: Language;
  appearance: DeviceAppearance;
  deviceMode: DeviceMode;
  /** Overscan margin for TVs as a share of the screen size, 0–0.05. */
  overscan: number;
  player: PlayerPreferences;
  setLanguage: (language: Language) => void;
  setAppearance: (patch: Partial<DeviceAppearance>) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setOverscan: (overscan: number) => void;
  setPlayer: (patch: Partial<PlayerPreferences>) => void;
}

const STORAGE_KEY = 'jellymorph.settings';

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  maxBitrate: null,
  volume: 1,
  muted: false,
  burnInStyled: false,
};

export const DEFAULT_OVERSCAN = 0.03;
export const MAX_OVERSCAN = 0.05;

const DEFAULT_APPEARANCE: DeviceAppearance = { theme: null, colorScheme: 'auto', motion: 'system' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

function readPlayer(value: unknown): PlayerPreferences {
  if (!isRecord(value)) return DEFAULT_PLAYER_PREFERENCES;
  const { maxBitrate, volume, muted, burnInStyled } = value;
  return {
    maxBitrate:
      typeof maxBitrate === 'number' && Number.isFinite(maxBitrate) && maxBitrate > 0
        ? maxBitrate
        : null,
    volume:
      typeof volume === 'number' && volume >= 0 && volume <= 1
        ? volume
        : DEFAULT_PLAYER_PREFERENCES.volume,
    muted: typeof muted === 'boolean' ? muted : DEFAULT_PLAYER_PREFERENCES.muted,
    burnInStyled:
      typeof burnInStyled === 'boolean' ? burnInStyled : DEFAULT_PLAYER_PREFERENCES.burnInStyled,
  };
}

function readAppearance(value: unknown): DeviceAppearance {
  if (!isRecord(value)) return DEFAULT_APPEARANCE;
  return {
    theme: isThemeId(value.theme) ? value.theme : null,
    colorScheme: includes(COLOR_SCHEME_PREFERENCES, value.colorScheme)
      ? value.colorScheme
      : DEFAULT_APPEARANCE.colorScheme,
    motion: includes(MOTION_PREFERENCES, value.motion) ? value.motion : DEFAULT_APPEARANCE.motion,
  };
}

export function clampOverscan(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_OVERSCAN, Math.max(0, value)) : DEFAULT_OVERSCAN;
}

function load(): Pick<
  DeviceSettings,
  'language' | 'appearance' | 'deviceMode' | 'overscan' | 'player'
> {
  const raw = readJson('local', STORAGE_KEY);
  const record = isRecord(raw) ? raw : {};
  return {
    language: isLanguage(record.language) ? record.language : DEFAULT_LANGUAGE,
    appearance: readAppearance(record.appearance),
    deviceMode: includes(DEVICE_MODES, record.deviceMode) ? record.deviceMode : 'auto',
    overscan:
      typeof record.overscan === 'number' ? clampOverscan(record.overscan) : DEFAULT_OVERSCAN,
    player: readPlayer(record.player),
  };
}

export const useDeviceSettings = create<DeviceSettings>()((set, get) => ({
  ...load(),
  setLanguage: (language) => {
    set({ language });
  },
  setAppearance: (patch) => {
    set({ appearance: { ...get().appearance, ...patch } });
  },
  setDeviceMode: (deviceMode) => {
    set({ deviceMode });
  },
  setOverscan: (overscan) => {
    set({ overscan: clampOverscan(overscan) });
  },
  setPlayer: (patch) => {
    set({ player: { ...get().player, ...patch } });
  },
}));

useDeviceSettings.subscribe((state) => {
  writeJson('local', STORAGE_KEY, {
    language: state.language,
    appearance: state.appearance,
    deviceMode: state.deviceMode,
    overscan: state.overscan,
    player: state.player,
  });
});
