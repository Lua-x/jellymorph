// Jellymorph plugin interface v1 (docs/themes.md §12): `react-dom` for plugin themes.
// A plugin's build points this import here, so it shares the app's own copy. Keep the names
// in step with src/plugin-api (checked by src/plugin-api/plugin-api.test.ts).
const api = globalThis.__jellymorph?.v1;
if (!api) throw new Error('The Jellymorph plugin interface v1 is not available.');

export default api.reactDom;
export const {
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  requestFormReset,
  useFormStatus,
  version,
} = api.reactDom;
