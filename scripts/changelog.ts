/**
 * Prints the release notes for a version tag: the commits since the previous v* tag.
 *
 *   node scripts/changelog.ts v1.2.0 > release-notes.md
 */
import { execFileSync } from 'node:child_process';
import { parseGitLog, releaseNotes } from './lib/changelog.ts';

const IMAGE = 'ghcr.io/lua-x/jellymorph';

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/changelog.ts <tag>');
  process.exit(2);
}

const git = (args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let previous: string | null = null;
try {
  previous = git(['describe', '--tags', '--abbrev=0', '--match', 'v*', `${tag}^`]).trim();
} catch {
  // First release: every commit up to the tag.
}

const range = previous ? `${previous}..${tag}` : tag;
const commits = parseGitLog(git(['log', '--format=%H%x1f%s%x1f%b%x1e', range]));
process.stdout.write(releaseNotes(commits, { image: IMAGE, version: tag.replace(/^v/, '') }));
