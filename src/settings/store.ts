import { create } from 'zustand';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@/i18n';
import { readJson, writeJson } from '@/lib/storage';

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

/**
 * Device-level settings. Phase 4 adds the per-user settings synced through DisplayPreferences;
 * until then the language is stored on this device only.
 */
interface DeviceSettings {
  language: Language;
  player: PlayerPreferences;
  setLanguage: (language: Language) => void;
  setPlayer: (patch: Partial<PlayerPreferences>) => void;
}

const STORAGE_KEY = 'jellymorph.settings';

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  maxBitrate: null,
  volume: 1,
  muted: false,
  burnInStyled: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

function load(): Pick<DeviceSettings, 'language' | 'player'> {
  const raw = readJson('local', STORAGE_KEY);
  const record = isRecord(raw) ? raw : {};
  return {
    language: isLanguage(record.language) ? record.language : DEFAULT_LANGUAGE,
    player: readPlayer(record.player),
  };
}

export const useDeviceSettings = create<DeviceSettings>()((set, get) => ({
  ...load(),
  setLanguage: (language) => {
    set({ language });
  },
  setPlayer: (patch) => {
    set({ player: { ...get().player, ...patch } });
  },
}));

useDeviceSettings.subscribe((state) => {
  writeJson('local', STORAGE_KEY, { language: state.language, player: state.player });
});
