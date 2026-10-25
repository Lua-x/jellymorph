/**
 * Plugin themes (phase 17, docs/themes.md §12): folders in /custom/themes that the container
 * lists in config.js when THEME_PLUGINS=true. A folder holds theme.json (texts, color schemes,
 * preview pictures, entry module, style sheets) and the built theme. The settings only read
 * theme.json; the code loads when the theme is shown or previewed.
 *
 * Everything here comes from files an administrator put into the container, so it is checked
 * like other untrusted input: an invalid theme.json or module never reaches the app.
 */
import { isBuiltInThemeId, isThemeId } from '@/config/theme-ids';
import { DETAIL_ACTIONS, FACTS, HOME_AREAS, type LayoutDefaults } from '@/domain/layout';
import { LANGUAGES } from '@/i18n';
import {
  THEME_CONTRACT_VERSION,
  THEME_SLOTS,
  type ColorScheme,
  type LocalizedText,
  type PluginThemeManifest,
  type ThemeModule,
  type ThemeOptions,
} from '@/themes/contract';

/** Where the container serves the plugin folders (docker/plugins.conf.template). */
export const PLUGIN_FOLDER = '/custom/themes';

/** Versions of the plugin interface this app offers (public/plugin-api/v<n>/). */
export const PLUGIN_API_VERSIONS: readonly number[] = [1];

/** A file inside the plugin folder: no absolute paths, no `..`, no hidden files. */
const FILE = /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const COLOR_SCHEMES: readonly ColorScheme[] = ['dark', 'light'];

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

const fail = (problem: string): Parsed<never> => ({ ok: false, problem });

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, field: string, maxLength: number): Parsed<LocalizedText> {
  const source = record(value);
  if (!source) return fail(`"${field}" must be an object such as { "en": "…", "de": "…" }`);
  const result: Record<string, string> = {};
  for (const [language, entry] of Object.entries(source)) {
    if (!(LANGUAGES as readonly string[]).includes(language)) continue;
    if (typeof entry !== 'string' || entry.trim() === '' || entry.length > maxLength) {
      return fail(`"${field}.${language}" must be a text of up to ${String(maxLength)} characters`);
    }
    result[language] = entry.trim();
  }
  if (result.en === undefined) return fail(`"${field}" needs at least an English text ("en")`);
  return { ok: true, value: result as LocalizedText };
}

function optionalText(value: unknown, field: string, maxLength: number): Parsed<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string' || value.length > maxLength) {
    return fail(`"${field}" must be a text of up to ${String(maxLength)} characters`);
  }
  return { ok: true, value: value.trim() || null };
}

function file(value: unknown, field: string, extension: RegExp): Parsed<string> {
  if (typeof value !== 'string' || !FILE.test(value) || !extension.test(value)) {
    return fail(
      `"${field}" must be a file inside the plugin folder (got ${JSON.stringify(value)})`,
    );
  }
  return { ok: true, value };
}

/**
 * Checks a plugin's theme.json and turns it into a manifest. `id` is the folder name, which the
 * file must repeat; `load` brings the code (see `pluginLoader`).
 */
export function parsePluginTheme(id: string, raw: unknown): Parsed<PluginThemeManifest> {
  if (!isThemeId(id) || isBuiltInThemeId(id)) {
    return fail(
      'the folder name must be lowercase letters, digits and hyphens, not a built-in theme',
    );
  }
  const source = record(raw);
  if (!source) return fail('theme.json must contain an object');
  if (source.id !== id) return fail(`"id" must be the folder name "${id}"`);
  if (typeof source.api !== 'number' || !PLUGIN_API_VERSIONS.includes(source.api)) {
    return fail(
      `"api" ${JSON.stringify(source.api)} is not offered by this Jellymorph (it offers ${PLUGIN_API_VERSIONS.join(', ')})`,
    );
  }

  const name = text(source.name, 'name', 60);
  if (!name.ok) return name;
  const description = text(source.description, 'description', 300);
  if (!description.ok) return description;
  const version = optionalText(source.version, 'version', 40);
  if (!version.ok) return version;
  const author = optionalText(source.author, 'author', 80);
  if (!author.ok) return author;

  const schemes = source.colorSchemes;
  if (
    !Array.isArray(schemes) ||
    schemes.length === 0 ||
    new Set(schemes).size !== schemes.length ||
    !schemes.every((scheme) => COLOR_SCHEMES.includes(scheme as ColorScheme))
  ) {
    return fail('"colorSchemes" must list "dark", "light" or both');
  }
  const colorSchemes = schemes as [ColorScheme, ...ColorScheme[]];

  const preview: Partial<Record<ColorScheme, string>> = {};
  const previewSource = source.preview === undefined ? {} : record(source.preview);
  if (!previewSource) return fail('"preview" must be an object such as { "dark": "preview.jpg" }');
  for (const scheme of colorSchemes) {
    if (previewSource[scheme] === undefined) continue;
    const picture = file(previewSource[scheme], `preview.${scheme}`, /\.(?:jpe?g|png|webp|avif)$/i);
    if (!picture.ok) return picture;
    preview[scheme] = `${PLUGIN_FOLDER}/${id}/${picture.value}`;
  }

  const entry = file(source.entry ?? 'index.js', 'entry', /\.js$/);
  if (!entry.ok) return entry;
  const styles: string[] = [];
  const styleList = source.styles ?? [];
  if (!Array.isArray(styleList)) return fail('"styles" must be a list of .css files');
  for (const [index, style] of styleList.entries()) {
    const sheet = file(style, `styles[${String(index)}]`, /\.css$/);
    if (!sheet.ok) return sheet;
    styles.push(sheet.value);
  }

  const features = record(source.features) ?? {};
  return {
    ok: true,
    value: {
      id,
      plugin: {
        name: name.value,
        description: description.value,
        version: version.value,
        author: author.value,
      },
      preview,
      colorSchemes,
      features: { uiSounds: features.uiSounds === true },
      load: pluginLoader(id, entry.value, styles),
    },
  };
}

/** Adds a plugin's style sheet once and waits until it applies. */
function attachStyle(id: string, href: string): Promise<void> {
  if (document.head.querySelector(`link[data-plugin-theme="${id}"][href="${href}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.pluginTheme = id;
    link.addEventListener('load', () => {
      resolve();
    });
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error(`style sheet ${href} could not be loaded`));
    });
    // Before the own style sheets of the mounted folder, which always come last (custom-styles.ts).
    const custom = document.head.querySelector('link[data-custom-style]');
    document.head.insertBefore(link, custom);
  });
}

/** Loads a plugin's style sheets and module (a same-origin ES module, allowed by the CSP). */
export function pluginLoader(
  id: string,
  entry: string,
  styles: readonly string[],
): PluginThemeManifest['load'] {
  const base = `${PLUGIN_FOLDER}/${id}/`;
  return async () => {
    await Promise.all(styles.map((style) => attachStyle(id, base + style)));
    const loaded = (await import(/* @vite-ignore */ base + entry)) as { default?: unknown };
    const module = checkPluginModule(loaded.default);
    if (!module.ok) throw new Error(`theme module of "${id}": ${module.problem}`);
    return module.value;
  };
}

function isComponent(value: unknown): boolean {
  // Function components, or objects from memo() and forwardRef().
  return typeof value === 'function' || (record(value) !== null && '$$typeof' in (value as object));
}

function layoutList<T extends string>(
  value: unknown,
  known: readonly T[],
  field: string,
): Parsed<readonly T[]> {
  if (!Array.isArray(value) || !value.every((entry) => known.includes(entry as T))) {
    return fail(`"options.layout.${field}" may only list ${known.join(', ')}`);
  }
  return { ok: true, value: [...new Set(value as T[])] };
}

function checkOptions(value: unknown): Parsed<Partial<ThemeOptions>> {
  if (value === undefined) return { ok: true, value: {} };
  const source = record(value);
  if (!source) return fail('"options" must be an object');
  const options: Partial<ThemeOptions> = {};
  if (source.detailPresentation !== undefined) {
    if (source.detailPresentation !== 'page' && source.detailPresentation !== 'modal') {
      return fail('"options.detailPresentation" must be "page" or "modal"');
    }
    options.detailPresentation = source.detailPresentation;
  }
  if (source.heroItemCount !== undefined) {
    const count = source.heroItemCount;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 12) {
      return fail('"options.heroItemCount" must be a whole number from 1 to 12');
    }
    options.heroItemCount = count;
  }
  if (source.cardShape !== undefined) {
    if (source.cardShape !== 'mixed' && source.cardShape !== 'landscape') {
      return fail('"options.cardShape" must be "mixed" or "landscape"');
    }
    options.cardShape = source.cardShape;
  }
  if (source.layout !== undefined) {
    const layout = record(source.layout);
    if (!layout) return fail('"options.layout" must be an object');
    const home = layoutList(layout.home, HOME_AREAS, 'home');
    if (!home.ok) return home;
    const detailActions = layoutList(layout.detailActions, DETAIL_ACTIONS, 'detailActions');
    if (!detailActions.ok) return detailActions;
    const facts = layoutList(layout.facts, FACTS, 'facts');
    if (!facts.ok) return facts;
    options.layout = {
      home: home.value,
      detailActions: detailActions.value,
      facts: facts.value,
    } satisfies LayoutDefaults;
  }
  return { ok: true, value: options };
}

/** Checks the default export of a plugin's module against the theme contract. */
export function checkPluginModule(value: unknown): Parsed<ThemeModule> {
  const source = record(value);
  if (!source) return fail('the module must export a theme object as default');
  if (source.contractVersion !== THEME_CONTRACT_VERSION) {
    return fail(
      `"contractVersion" must be ${String(THEME_CONTRACT_VERSION)} (got ${JSON.stringify(source.contractVersion)})`,
    );
  }
  const components = record(source.components);
  if (!components) return fail('"components" must be an object');
  for (const [slot, component] of Object.entries(components)) {
    if (!(THEME_SLOTS as readonly string[]).includes(slot)) return fail(`"${slot}" is not a slot`);
    if (!isComponent(component)) return fail(`"components.${slot}" is not a component`);
  }
  const options = checkOptions(source.options);
  if (!options.ok) return options;
  const texts = source.texts === undefined ? {} : record(source.texts);
  if (!texts || !Object.values(texts).every((entry) => record(entry) !== null)) {
    return fail('"texts" must map languages to objects of texts');
  }
  return {
    ok: true,
    value: {
      contractVersion: THEME_CONTRACT_VERSION,
      components,
      options: options.value,
      texts,
    },
  };
}

/**
 * Reads theme.json of every listed plugin. Invalid ones are left out with a reason, so one broken
 * folder does not hide the others.
 */
export async function loadPluginThemes(
  ids: readonly string[],
): Promise<{ manifests: PluginThemeManifest[]; problems: string[] }> {
  const results = await Promise.all(
    ids.map(async (id): Promise<Parsed<PluginThemeManifest>> => {
      try {
        const response = await fetch(`${PLUGIN_FOLDER}/${id}/theme.json`, { cache: 'no-cache' });
        if (!response.ok) return fail(`theme.json answered ${String(response.status)}`);
        return parsePluginTheme(id, await response.json());
      } catch (error) {
        return fail(`theme.json could not be read (${String(error)})`);
      }
    }),
  );
  const manifests: PluginThemeManifest[] = [];
  const problems: string[] = [];
  results.forEach((result, index) => {
    if (result.ok) manifests.push(result.value);
    else problems.push(`Plugin theme "${ids[index] ?? ''}" is left out: ${result.problem}.`);
  });
  return { manifests, problems };
}
