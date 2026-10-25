import { expect, it } from 'vitest';
import app from '../../package.json';
import starter from '../../theme-starter/package.json';
import manifest from '../../theme-starter/public/theme.json';
import { PLUGIN_API_VERSIONS } from './themes';

it('the starter template builds with the same tool and type versions as the app', () => {
  const versions: Record<string, string> = { ...app.dependencies, ...app.devDependencies };
  for (const [name, version] of Object.entries(starter.devDependencies)) {
    expect(version, name).toBe(versions[name]);
  }
});

it('the starter template targets a plugin interface this app offers', () => {
  expect(PLUGIN_API_VERSIONS).toContain(manifest.api);
  expect(manifest.id).toBe('starter');
});
