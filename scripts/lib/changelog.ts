/**
 * Release notes from Conventional Commits (used by scripts/changelog.ts in release.yml).
 * Only changes users notice are listed: features, fixes, performance and breaking changes.
 */

export interface Commit {
  hash: string;
  subject: string;
  body: string;
}

interface Entry {
  text: string;
  hash: string;
}

const SECTIONS = [
  { type: 'feat', title: 'Neu' },
  { type: 'fix', title: 'Behoben' },
  { type: 'perf', title: 'Schneller' },
] as const;

const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?: (?<text>.+)$/;

export function releaseNotes(
  commits: readonly Commit[],
  options: { image: string; version: string },
) {
  const breaking: Entry[] = [];
  const sections = new Map<string, Entry[]>(SECTIONS.map((section) => [section.type, []]));

  for (const commit of commits) {
    const match = CONVENTIONAL.exec(commit.subject.trim());
    if (!match?.groups) continue;
    const { type = '', scope, text = '' } = match.groups;
    const entry = {
      text: scope ? `**${scope}:** ${text}` : text,
      hash: commit.hash.slice(0, 7),
    };
    const breakingNote = /^BREAKING[ -]CHANGE: (.+)$/m.exec(commit.body)?.[1];
    if (match.groups.breaking || breakingNote) {
      // Listed once, in the most prominent section.
      breaking.push(breakingNote ? { ...entry, text: `${entry.text} – ${breakingNote}` } : entry);
    } else {
      sections.get(type)?.push(entry);
    }
  }

  const list = (entries: readonly Entry[]) =>
    entries.map((entry) => `- ${entry.text} (${entry.hash})`).join('\n');

  const parts = [
    `## Docker\n\n\`\`\`bash\ndocker pull ${options.image}:${options.version}\n\`\`\``,
  ];
  if (breaking.length > 0) parts.push(`## Achtung: inkompatible Änderungen\n\n${list(breaking)}`);
  for (const section of SECTIONS) {
    const entries = sections.get(section.type) ?? [];
    if (entries.length > 0) parts.push(`## ${section.title}\n\n${list(entries)}`);
  }
  return `${parts.join('\n\n')}\n`;
}

/** Parses `git log --format=%H%x1f%s%x1f%b%x1e` output. */
export function parseGitLog(output: string): Commit[] {
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', subject = '', body = ''] = record.split('\x1f');
      return { hash, subject, body };
    });
}
