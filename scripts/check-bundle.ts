/**
 * Bundle budget check (docs/architecture.md §13.1).
 * Base bundle = everything index.html loads statically: entry chunk, its static imports and CSS.
 * Themes, routes, the player and the demo server are lazy and budgeted separately.
 *
 * Run after `npm run build`: node scripts/check-bundle.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
}

const BASE_BUDGET_KB = 250;
const THEME_JS_BUDGET_KB = 80;
const dist = join(import.meta.dirname, '..', 'dist');
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;

const gzipKb = (file: string) => gzipSync(readFileSync(join(dist, file))).length / 1024;

/** Files of a chunk plus everything it imports statically. */
function closure(key: string, seen = new Set<string>()): Set<string> {
  const chunk = manifest[key];
  if (!chunk || seen.has(chunk.file)) return seen;
  seen.add(chunk.file);
  for (const css of chunk.css ?? []) seen.add(css);
  for (const imported of chunk.imports ?? []) closure(imported, seen);
  return seen;
}

const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry);
if (!entryKey) throw new Error('No entry chunk in the Vite manifest');
const base = closure(entryKey);
const baseKb = [...base].reduce((sum, file) => sum + gzipKb(file), 0);

console.log(`Base bundle: ${baseKb.toFixed(1)} KB gzip (budget ${BASE_BUDGET_KB} KB)`);
for (const file of [...base].sort())
  console.log(`  ${gzipKb(file).toFixed(1).padStart(7)} KB  ${file}`);

for (const [key, chunk] of Object.entries(manifest)) {
  const theme = /^src\/themes\/([\w-]+)\/index\.ts$/.exec(chunk.src ?? key)?.[1];
  if (!theme || !chunk.isDynamicEntry) continue;
  const files = [...closure(key)].filter((file) => !base.has(file));
  const jsKb = files
    .filter((file) => file.endsWith('.js'))
    .reduce((sum, file) => sum + gzipKb(file), 0);
  const cssKb = files
    .filter((file) => file.endsWith('.css'))
    .reduce((sum, file) => sum + gzipKb(file), 0);
  const note = jsKb > THEME_JS_BUDGET_KB ? `  ⚠ over the ${THEME_JS_BUDGET_KB} KB soft budget` : '';
  console.log(`Theme ${theme}: ${jsKb.toFixed(1)} KB JS + ${cssKb.toFixed(1)} KB CSS gzip${note}`);
}

if (baseKb > BASE_BUDGET_KB) {
  console.error(`\n✖ Base bundle exceeds ${BASE_BUDGET_KB} KB gzip.`);
  process.exitCode = 1;
}
