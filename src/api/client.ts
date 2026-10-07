import type { Api } from '@jellyfin/sdk/lib/api';
import { Jellyfin } from '@jellyfin/sdk/lib/jellyfin';
import axios, { isAxiosError } from 'axios';
import { APP_VERSION } from '@/config/version';
import { useDeviceSettings } from '@/settings/store';
import { describeDevice, getDeviceId } from './device';

export const APP_NAME = 'Jellymorph';

const REQUEST_TIMEOUT_MS = 20_000;

// The SDK also uses the global axios instance (e.g. for server discovery). The fetch adapter
// supports `keepalive` (needed to report playback stops when a tab closes) and behaves the same
// in browsers and tests.
axios.defaults.adapter = 'fetch';

let jellyfin: Jellyfin | null = null;
let languages: string[] | null = null;

/** The SDK entry point, created lazily so the device id is only generated when needed. */
export function getJellyfin(): Jellyfin {
  languages ??= [useDeviceSettings.getState().language];
  jellyfin ??= new Jellyfin({
    clientInfo: { name: APP_NAME, version: APP_VERSION },
    deviceInfo: { id: getDeviceId(), name: describeDevice(navigator.userAgent), languages },
  });
  return jellyfin;
}

/** Sets the Accept-Language sent to Jellyfin for new API instances. */
export function setApiLanguage(language: string): void {
  languages = [language];
  if (jellyfin) jellyfin.deviceInfo = { ...jellyfin.deviceInfo, languages };
}

type UnauthorizedListener = (api: Api) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Called when a request made with an access token is rejected with 401. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/**
 * Creates an API instance for a server. Each instance gets its own axios instance so the
 * 401 handling knows which session failed.
 */
export function createApi(baseUrl: string, accessToken?: string): Api {
  const http = axios.create({ timeout: REQUEST_TIMEOUT_MS });
  const api = getJellyfin().createApi(baseUrl, accessToken, http);
  http.interceptors.response.use(undefined, (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401 && api.accessToken !== '') {
      for (const listener of unauthorizedListeners) listener(api);
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  });
  return api;
}
