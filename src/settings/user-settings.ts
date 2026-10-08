/**
 * Settings of the signed-in user (docs/architecture.md §10). Local storage per server and user
 * is written at once; the sync (hooks/useSettingsSync) mirrors changes to the server. The last
 * values are also kept as device appearance for the screens before the next sign-in.
 */
import { create } from 'zustand';
import { readJson, writeJson } from '@/lib/storage';
import { parseUserSettings, type UserSettings } from './schema';
import { useDeviceSettings } from './store';

export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

interface UserSettingsState {
  /** `serverId:userId` the values belong to; null while nobody is signed in. */
  owner: string | null;
  values: UserSettings | null;
  /**
   * A local change has not reached the server yet (offline, failed save, page closed during
   * the save delay). Then the local values win over the server's on the next start.
   */
  pending: boolean;
  sync: SyncState;
  /** Increases with every local change that still has to reach the server. */
  revision: number;
  /** Loads the stored values of a user (or `defaults` on the first visit). */
  activate: (owner: string, defaults: UserSettings) => void;
  deactivate: () => void;
  /** Values from the server; they win over local ones and are not sent back. */
  applyFromServer: (values: Partial<UserSettings>) => void;
  update: (patch: Partial<UserSettings>) => void;
  /** The server confirmed the values of `revision`. */
  markSynced: (revision: number) => void;
  setSync: (sync: SyncState) => void;
}

const storageKey = (owner: string) => `jellymorph.user.${owner}`;

export function ownerOf(key: { serverId: string; userId: string }): string {
  return `${key.serverId}:${key.userId}`;
}

function readStored(owner: string): { values: Partial<UserSettings>; pending: boolean } {
  const raw = readJson('local', storageKey(owner));
  if (typeof raw === 'object' && raw !== null && 'values' in raw) {
    const record = raw as { values: unknown; pending?: unknown };
    return { values: parseUserSettings(record.values), pending: record.pending === true };
  }
  return { values: parseUserSettings(raw), pending: false };
}

function remember(owner: string, values: UserSettings, pending: boolean): void {
  writeJson('local', storageKey(owner), { values, pending });
  const device = useDeviceSettings.getState();
  device.setAppearance({
    theme: values.theme,
    colorScheme: values.colorScheme,
    motion: values.motion,
  });
  if (device.language !== values.language) device.setLanguage(values.language);
}

export const useUserSettings = create<UserSettingsState>()((set, get) => ({
  owner: null,
  values: null,
  pending: false,
  sync: 'idle',
  revision: 0,

  activate: (owner, defaults) => {
    if (get().owner === owner && get().values) return;
    const stored = readStored(owner);
    const values = { ...defaults, ...stored.values };
    set({ owner, values, pending: stored.pending, sync: 'idle', revision: 0 });
    remember(owner, values, stored.pending);
  },

  deactivate: () => {
    set({ owner: null, values: null, pending: false, sync: 'idle', revision: 0 });
  },

  applyFromServer: (patch) => {
    const { owner, values } = get();
    if (!owner || !values) return;
    const next = { ...values, ...parseUserSettings(patch) };
    set({ values: next, pending: false });
    remember(owner, next, false);
  },

  update: (patch) => {
    const { owner, values, revision } = get();
    if (!owner || !values) return;
    const next = { ...values, ...parseUserSettings(patch) };
    set({ values: next, pending: true, revision: revision + 1 });
    remember(owner, next, true);
  },

  markSynced: (revision) => {
    const { owner, values } = get();
    if (!owner || !values || get().revision !== revision) return;
    set({ pending: false });
    remember(owner, values, false);
  },

  setSync: (sync) => {
    set({ sync });
  },
}));
