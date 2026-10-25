/**
 * Prepares the starter template for the ZIP every release carries (phase 17):
 *
 *   node scripts/pack-starter.ts
 *
 * writes artifacts/theme-starter: the template without node_modules and dist, the types of the
 * plugin interface (declarations of src/plugin-api/jellymorph.ts and everything it uses) in
 * types/, and a tsconfig.json that points there instead of to this repository's sources. Then it
 * typechecks the result, so a template that does not compile never reaches a release. The
 * release workflow zips the folder; CI runs this script as a check.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifacts = join(root, 'artifacts');
const out = join(artifacts, 'theme-starter');

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'theme-starter'), out, {
  recursive: true,
  filter: (source) => {
    const parts = relative(join(root, 'theme-starter'), source).split(sep);
    return !parts.includes('node_modules') && !parts.includes('dist');
  },
});

// Declarations of the public interface. Internal paths keep their "@/" form; the template's
// tsconfig maps them into types/.
const typesProject = join(artifacts, 'tsconfig.plugin-types.json');
writeFileSync(
  typesProject,
  JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: '../src',
      outDir: './theme-starter/types',
    },
    include: [],
    files: [
      '../src/plugin-api/jellymorph.ts',
      '../src/vite-env.d.ts',
      '../src/player/engines/hls-light.d.ts',
    ],
  }),
);
try {
  run('npx', ['tsc', '-p', typesProject]);
} finally {
  rmSync(typesProject);
}

const tsconfigPath = join(out, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as {
  compilerOptions: Record<string, unknown>;
  include: string[];
};
tsconfig.compilerOptions.paths = {
  jellymorph: ['./types/plugin-api/jellymorph.d.ts'],
  '@/*': ['./types/*'],
};
tsconfig.include = ['src', 'vite.config.ts'];
writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

// The package compiles on its own; packages resolve from this repository's node_modules, as
// they will from the template's own after "npm install".
run('npx', ['tsc', '-p', tsconfigPath]);
console.log(`Starter template ready in ${relative(root, out)}`);
