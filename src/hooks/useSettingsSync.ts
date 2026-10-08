import i18next from 'i18next';
import { useEffect } from 'react';
import { fetchDisplayPreferences, saveDisplayPreferences } from '@/api/preferences';
import type { DisplayPreferencesDto } from '@jellyfin/sdk/lib/generated-client/models/display-preferences-dto';
import { getActiveSession, useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import { defaultUserSettings, fromCustomPrefs, toCustomPrefs } from '@/settings/schema';
import { useDeviceSettings } from '@/settings/store';
import { ownerOf, useUserSettings } from '@/settings/user-settings';
import { useToasts } from '@/ui/toast-store';

const SAVE_DELAY_MS = 1000;

let saveNow: (() => void) | null = null;

/** Saves the current settings at once (the "try again" after a failed save). */
export function retrySettingsSave(): void {
  saveNow?.();
}

/**
 * Keeps the signed-in user's settings in sync with the server (architecture §10): local values
 * apply at once, the server's values win after sign-in, and changes are written back bundled
 * after one second.
 */
export function useSettingsSync(): void {
  const { defaultTheme } = useAppConfig();
  const api = useSessionStore((state) => state.api);
  const session = useSessionStore(getActiveSession);
  const serverId = session?.serverId;
  const userId = session?.userId;

  useEffect(() => {
    const store = useUserSettings.getState();
    if (!api || !serverId || !userId) {
      store.deactivate();
      return;
    }
    const owner = ownerOf({ serverId, userId });
    const device = useDeviceSettings.getState();
    store.activate(owner, {
      ...defaultUserSettings(device.appearance.theme ?? defaultTheme),
      colorScheme: device.appearance.colorScheme,
      motion: device.appearance.motion,
      language: device.language,
    });

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    // Last known server state; values of other app versions in it are kept when saving.
    let base: DisplayPreferencesDto = {};

    const save = (keepalive = false) => {
      clearTimeout(timer);
      const state = useUserSettings.getState();
      if (state.owner !== owner || !state.values) return;
      dirty = false;
      const revision = state.revision;
      state.setSync('saving');
      saveDisplayPreferences(api, userId, base, toCustomPrefs(state.values), { keepalive }).then(
        (saved) => {
          base = saved;
          if (useUserSettings.getState().owner !== owner) return;
          state.markSynced(revision);
          state.setSync('saved');
        },
        (error: unknown) => {
          console.warn('Settings could not be saved on the server', error);
          if (useUserSettings.getState().owner !== owner) return;
          state.setSync('error');
          useToasts.getState().show('error', i18next.t('sync.failed', { ns: 'settings' }), {
            label: i18next.t('sync.retry', { ns: 'settings' }),
            onAction: () => {
              save();
            },
          });
        },
      );
    };
    const schedule = () => {
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    saveNow = save;
    // Closing or reloading the page within the delay must not lose the change.
    const onPageHide = () => {
      if (dirty) save(true);
    };
    window.addEventListener('pagehide', onPageHide);

    store.setSync('loading');
    const revisionAtStart = useUserSettings.getState().revision;
    fetchDisplayPreferences(api, userId, controller.signal).then(
      (stored) => {
        base = stored;
        const server = fromCustomPrefs(stored.CustomPrefs);
        const current = useUserSettings.getState();
        const changedMeanwhile = current.revision !== revisionAtStart;
        // The server wins after a sign-in. Local values are uploaded instead when the server has
        // none yet or a local change never reached it; a change made while loading is newest.
        if (server && !changedMeanwhile && !current.pending) current.applyFromServer(server);
        else if (!changedMeanwhile) schedule();
        if (useUserSettings.getState().sync === 'loading')
          useUserSettings.getState().setSync('idle');
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        // Offline or an old server: the local values stay in use.
        console.warn('Settings could not be loaded from the server', error);
        useUserSettings.getState().setSync('idle');
      },
    );

    const unsubscribe = useUserSettings.subscribe((state, previous) => {
      if (state.owner === owner && state.revision !== previous.revision) schedule();
    });

    return () => {
      controller.abort();
      unsubscribe();
      window.removeEventListener('pagehide', onPageHide);
      // Changes made just before leaving are not lost.
      if (dirty) save();
      clearTimeout(timer);
      if (saveNow === save) saveNow = null;
    };
  }, [api, serverId, userId, defaultTheme]);
}
