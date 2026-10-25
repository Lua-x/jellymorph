/**
 * Makes the plugin interface available to plugin themes (phase 17, docs/themes.md §12).
 *
 * A plugin is a plain ES module from the container's folder. Its build maps the imports
 * `react`, `react/jsx-runtime`, `react-dom`, `react-i18next` and `jellymorph` to the files in
 * /plugin-api/v1/ (public/plugin-api/v1), which read the objects below. So plugins share the
 * app's React, i18next and theme building blocks instead of bringing their own copies, and the
 * Content Security Policy needs no exception: everything comes from the own origin.
 *
 * Loaded only when the container lists plugin themes, so the base bundle does not grow.
 */
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import * as reactI18next from 'react-i18next';
import * as jellymorph from './jellymorph';

export const PLUGIN_API_V1 = { react: React, jsxRuntime, reactDom, reactI18next, jellymorph };

declare global {
  var __jellymorph: { v1?: typeof PLUGIN_API_V1 } | undefined;
}

export function installPluginApi() {
  globalThis.__jellymorph = { ...globalThis.__jellymorph, v1: PLUGIN_API_V1 };
}
