// Jellymorph plugin interface v1 (docs/themes.md §12): `react-i18next` for plugin themes.
// A plugin's build points this import here, so it shares the app's own copy. Keep the names
// in step with src/plugin-api (checked by src/plugin-api/plugin-api.test.ts).
const api = globalThis.__jellymorph?.v1;
if (!api) throw new Error('The Jellymorph plugin interface v1 is not available.');

export const { Trans, useTranslation } = api.reactI18next;
