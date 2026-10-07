import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_CONFIG, getFixedServerUrl, parseAppConfig } from './app-config';

describe('parseAppConfig', () => {
  it('falls back to defaults when the config is missing', () => {
    const { config, warnings } = parseAppConfig(undefined);
    expect(config).toEqual(DEFAULT_APP_CONFIG);
    expect(warnings).toHaveLength(1);
  });

  it('accepts a complete, valid config', () => {
    const { config, warnings } = parseAppConfig({
      jellyfinUrl: 'https://media.example.com/',
      lockServer: true,
      proxyPath: '/jellyfin/',
      defaultTheme: 'crimson',
      appTitle: '  Kino  ',
      demoMode: false,
    });
    expect(warnings).toEqual([]);
    expect(config).toEqual({
      jellyfinUrl: 'https://media.example.com',
      lockServer: true,
      proxyPath: '/jellyfin',
      defaultTheme: 'crimson',
      appTitle: 'Kino',
      demoMode: false,
    });
  });

  it('accepts string booleans as written by shell scripts', () => {
    const { config } = parseAppConfig({ demoMode: 'true', lockServer: 'false' });
    expect(config.demoMode).toBe(true);
    expect(config.lockServer).toBe(false);
  });

  it('rejects invalid values with warnings instead of throwing', () => {
    const { config, warnings } = parseAppConfig({
      jellyfinUrl: 'javascript:alert(1)',
      proxyPath: 'jellyfin',
      defaultTheme: 'unknown-theme',
      demoMode: 'yes',
    });
    expect(config.jellyfinUrl).toBeNull();
    expect(config.proxyPath).toBeNull();
    expect(config.defaultTheme).toBe('default');
    expect(config.demoMode).toBe(false);
    expect(warnings).toHaveLength(4);
  });

  it('does not lock the server without an address', () => {
    const { config, warnings } = parseAppConfig({ lockServer: true });
    expect(config.lockServer).toBe(false);
    expect(warnings[0]).toMatch(/lockServer/);
  });

  it('limits the title length', () => {
    const { config } = parseAppConfig({ appTitle: 'x'.repeat(500) });
    expect(config.appTitle).toHaveLength(100);
  });
});

describe('getFixedServerUrl', () => {
  const origin = 'https://app.example.com';

  it('is null when the user may choose a server', () => {
    expect(getFixedServerUrl(DEFAULT_APP_CONFIG, origin)).toBeNull();
    expect(
      getFixedServerUrl({ ...DEFAULT_APP_CONFIG, jellyfinUrl: 'https://jf.example.com' }, origin),
    ).toBeNull();
  });

  it('prefers demo mode, then the proxy, then a locked address', () => {
    const locked = {
      ...DEFAULT_APP_CONFIG,
      jellyfinUrl: 'https://jf.example.com',
      lockServer: true,
    };
    expect(getFixedServerUrl(locked, origin)).toBe('https://jf.example.com');
    expect(getFixedServerUrl({ ...locked, proxyPath: '/jellyfin' }, origin)).toBe(
      'https://app.example.com/jellyfin',
    );
    expect(getFixedServerUrl({ ...locked, demoMode: true }, origin)).toBe(
      'https://app.example.com/demo-server',
    );
  });
});
