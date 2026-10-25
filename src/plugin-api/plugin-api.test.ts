import { describe, expect, it } from 'vitest';
import jellymorph from '../../public/plugin-api/v1/jellymorph.js?raw';
import reactDom from '../../public/plugin-api/v1/react-dom.js?raw';
import reactI18next from '../../public/plugin-api/v1/react-i18next.js?raw';
import jsxRuntime from '../../public/plugin-api/v1/react-jsx-runtime.js?raw';
import react from '../../public/plugin-api/v1/react.js?raw';
import { installPluginApi, PLUGIN_API_V1 } from './install';

/** The names a shim file exports (`export const { a, b } = …`). */
function exported(source: string): string[] {
  return [...source.matchAll(/export const \{([^}]*)\}/g)]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

describe('plugin interface v1 (public/plugin-api/v1)', () => {
  it('serves exactly the public building blocks of the module "jellymorph"', () => {
    expect(exported(jellymorph)).toEqual(Object.keys(PLUGIN_API_V1.jellymorph).sort());
  });

  it.each([
    ['react', react, PLUGIN_API_V1.react],
    ['react/jsx-runtime', jsxRuntime, PLUGIN_API_V1.jsxRuntime],
    ['react-dom', reactDom, PLUGIN_API_V1.reactDom],
    ['react-i18next', reactI18next, PLUGIN_API_V1.reactI18next],
  ])('every name %s offers exists in the app', (_name, source, module) => {
    const names = exported(source);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(module, name).toHaveProperty(name);
  });

  it('places the interface where the shims look for it', () => {
    installPluginApi();
    expect(globalThis.__jellymorph?.v1?.jellymorph).toBe(PLUGIN_API_V1.jellymorph);
    for (const source of [react, jsxRuntime, reactDom, reactI18next, jellymorph]) {
      expect(source).toContain('globalThis.__jellymorph?.v1');
    }
  });
});
