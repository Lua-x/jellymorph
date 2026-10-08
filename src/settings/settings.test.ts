import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultUserSettings,
  fromCustomPrefs,
  parseUserSettings,
  SCHEMA_VERSION,
  toCustomPrefs,
} from './schema';
import { useDeviceSettings } from './store';
import { ownerOf, useUserSettings } from './user-settings';

describe('settings schema', () => {
  const settings = {
    ...defaultUserSettings('default'),
    colorScheme: 'light' as const,
    language: 'en' as const,
    trailerAutoplay: false,
    uiSounds: true,
  };

  it('round-trips through DisplayPreferences custom prefs', () => {
    const prefs = toCustomPrefs(settings);
    expect(prefs['jellymorph.version']).toBe(String(SCHEMA_VERSION));
    expect(prefs['jellymorph.trailerAutoplay']).toBe('false');
    expect(prefs['jellymorph.uiSounds']).toBe('true');
    expect(fromCustomPrefs(prefs)).toEqual(settings);
  });

  it('keeps interface sounds off unless the user turned them on', () => {
    expect(defaultUserSettings('neon-grid').uiSounds).toBe(false);
    // Preferences saved before the switch existed simply have no value for it.
    const older: Record<string, string> = { ...toCustomPrefs(settings) };
    delete older['jellymorph.uiSounds'];
    expect(fromCustomPrefs(older)).not.toHaveProperty('uiSounds');
  });

  it('ignores invalid values instead of applying them', () => {
    expect(
      parseUserSettings({
        theme: 'from-the-future',
        colorScheme: 'sepia',
        motion: 'full',
        language: 'xx',
      }),
    ).toEqual({ motion: 'full' });
    expect(parseUserSettings('nonsense')).toEqual({});
  });

  it('treats missing or newer schema versions as "nothing saved"', () => {
    expect(fromCustomPrefs({})).toBeNull();
    expect(fromCustomPrefs(null)).toBeNull();
    expect(
      fromCustomPrefs({
        ...toCustomPrefs(settings),
        'jellymorph.version': String(SCHEMA_VERSION + 1),
      }),
    ).toBeNull();
  });
});

describe('user settings store', () => {
  const owner = ownerOf({ serverId: 's1', userId: 'u1' });

  beforeEach(() => {
    useUserSettings.getState().deactivate();
  });

  it('starts with the defaults and remembers changes per user and on this device', () => {
    const store = useUserSettings.getState();
    store.activate(owner, defaultUserSettings('default'));
    expect(useUserSettings.getState().values?.colorScheme).toBe('auto');

    useUserSettings.getState().update({ colorScheme: 'light', language: 'en' });
    expect(useUserSettings.getState().revision).toBe(1);
    expect(useDeviceSettings.getState().appearance.colorScheme).toBe('light');
    expect(useDeviceSettings.getState().language).toBe('en');

    // Another visit loads the stored values.
    useUserSettings.getState().deactivate();
    useUserSettings.getState().activate(owner, defaultUserSettings('default'));
    expect(useUserSettings.getState().values).toMatchObject({
      colorScheme: 'light',
      language: 'en',
    });
  });

  it('remembers that a change has not reached the server yet', () => {
    useUserSettings.getState().activate(owner, defaultUserSettings('default'));
    useUserSettings.getState().update({ motion: 'full' });
    expect(useUserSettings.getState().pending).toBe(true);
    useUserSettings.getState().deactivate();
    useUserSettings.getState().activate(owner, defaultUserSettings('default'));
    expect(useUserSettings.getState().pending).toBe(true);
    useUserSettings.getState().markSynced(0);
    expect(useUserSettings.getState().pending).toBe(false);
  });

  it('applies server values without marking them as changes to upload', () => {
    useUserSettings.getState().activate(owner, defaultUserSettings('default'));
    useUserSettings.getState().applyFromServer({ motion: 'reduced' });
    expect(useUserSettings.getState().values?.motion).toBe('reduced');
    expect(useUserSettings.getState().revision).toBe(0);
  });

  it('keeps device settings within their limits', () => {
    useDeviceSettings.getState().setOverscan(0.2);
    expect(useDeviceSettings.getState().overscan).toBe(0.05);
    useDeviceSettings.getState().setOverscan(-1);
    expect(useDeviceSettings.getState().overscan).toBe(0);
  });
});
