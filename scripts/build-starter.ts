/**
 * Builds the example plugin theme of theme-starter/ (phase 17) into the test fixtures, where the
 * end-to-end tests and the container test find it as /custom/themes/starter:
 *
 *   node scripts/build-starter.ts [output folder]
 *
 * It uses this repository's Vite, so the template needs no installation of its own here.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.argv[2] ?? 'e2e/fixtures/custom/themes/starter');

const result = spawnSync('npx', ['vite', 'build', '--config', 'theme-starter/vite.config.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, THEME_OUT_DIR: out },
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
