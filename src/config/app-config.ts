import { isThemeId, type ThemeId } from './theme-ids';

export interface AppConfig {
  /** Server address to pre-fill (JELLYFIN_URL). */
  jellyfinUrl: string | null;
  /** The server address is fixed and cannot be changed in the UI (LOCK_SERVER). */
  lockServer: boolean;
  /** Same-origin path the container proxies to Jellyfin, e.g. '/jellyfin' (JELLYFIN_PROXY_TARGET). */
  proxyPath: string | null;
  /** Theme for users without a saved choice (DEFAULT_THEME). */
  defaultTheme: ThemeId;
  /** Browser title (APP_TITLE). */
  appTitle: string;
  /** Run against the built-in mock server instead of a real Jellyfin server (DEMO_MODE). */
  demoMode: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  jellyfinUrl: null,
  lockServer: false,
  proxyPath: null,
  defaultTheme: 'default',
  appTitle: 'Jellymorph',
  demoMode: false,
};

export interface ParsedAppConfig {
  config: AppConfig;
  warnings: string[];
}

const MAX_TITLE_LENGTH = 100;

function readBoolean(value: unknown, name: string, warnings: string[]): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  warnings.push(`${name} must be true or false; using the default.`);
  return undefined;
}

function readUrl(value: unknown, name: string, warnings: string[]): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    warnings.push(`${name} must be a string; ignoring it.`);
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('protocol');
    return url.toString().replace(/\/+$/, '');
  } catch {
    warnings.push(`${name} is not a valid http(s) URL; ignoring it.`);
    return null;
  }
}

function readPath(value: unknown, name: string, warnings: string[]): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\/[\w\-./]*$/.test(value.trim())) {
    warnings.push(`${name} must be an absolute path such as /jellyfin; ignoring it.`);
    return null;
  }
  const path = value.trim().replace(/\/+$/, '');
  return path === '' ? null : path;
}

/** Validates the untrusted runtime configuration. Never throws; invalid values fall back to defaults. */
export function parseAppConfig(raw: unknown): ParsedAppConfig {
  const warnings: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    warnings.push('window.__APP_CONFIG__ is missing; using defaults.');
    return { config: { ...DEFAULT_APP_CONFIG }, warnings };
  }
  const source = raw as Record<string, unknown>;

  const jellyfinUrl = readUrl(source.jellyfinUrl, 'jellyfinUrl', warnings);
  const proxyPath = readPath(source.proxyPath, 'proxyPath', warnings);
  let lockServer = readBoolean(source.lockServer, 'lockServer', warnings) ?? false;
  if (lockServer && !jellyfinUrl && !proxyPath) {
    warnings.push('lockServer requires jellyfinUrl; the server address stays editable.');
    lockServer = false;
  }

  let defaultTheme: ThemeId = DEFAULT_APP_CONFIG.defaultTheme;
  if (isThemeId(source.defaultTheme)) {
    defaultTheme = source.defaultTheme;
  } else if (source.defaultTheme !== undefined && source.defaultTheme !== '') {
    warnings.push('defaultTheme is not a known theme id; using "default".');
  }

  let appTitle = DEFAULT_APP_CONFIG.appTitle;
  if (typeof source.appTitle === 'string' && source.appTitle.trim() !== '') {
    appTitle = source.appTitle.trim().slice(0, MAX_TITLE_LENGTH);
  }

  return {
    config: {
      jellyfinUrl,
      lockServer,
      proxyPath,
      defaultTheme,
      appTitle,
      demoMode: readBoolean(source.demoMode, 'demoMode', warnings) ?? false,
    },
    warnings,
  };
}

/** Path under which the demo mode serves its mock Jellyfin server. */
export const DEMO_SERVER_PATH = '/demo-server';

/**
 * The server address the deployment pins, if any. When set, the server selection is hidden.
 * Order: demo mode, same-origin proxy, locked JELLYFIN_URL.
 */
export function getFixedServerUrl(config: AppConfig, origin: string): string | null {
  if (config.demoMode) return `${origin}${DEMO_SERVER_PATH}`;
  if (config.proxyPath) return `${origin}${config.proxyPath}`;
  if (config.lockServer) return config.jellyfinUrl;
  return null;
}
