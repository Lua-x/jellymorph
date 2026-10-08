import { describe, expect, it } from 'vitest';
import { parseGitLog, releaseNotes } from './changelog';

const options = { image: 'ghcr.io/lua-x/jellymorph', version: '1.2.0' };

describe('release notes', () => {
  it('groups user-facing commits and skips the rest', () => {
    const notes = releaseNotes(
      [
        { hash: 'aaaaaaa111', subject: 'feat: add the player (phase 3)', body: '' },
        { hash: 'bbbbbbb222', subject: 'fix(player): keep the subtitle choice', body: '' },
        { hash: 'ccccccc333', subject: 'docs: update the README', body: '' },
        { hash: 'ddddddd444', subject: 'perf: smaller base bundle', body: '' },
        { hash: 'eeeeeee555', subject: 'Merge branch main', body: '' },
      ],
      options,
    );
    expect(notes).toBe(
      [
        '## Docker',
        '',
        '```bash',
        'docker pull ghcr.io/lua-x/jellymorph:1.2.0',
        '```',
        '',
        '## Neu',
        '',
        '- add the player (phase 3) (aaaaaaa)',
        '',
        '## Behoben',
        '',
        '- **player:** keep the subtitle choice (bbbbbbb)',
        '',
        '## Schneller',
        '',
        '- smaller base bundle (ddddddd)',
        '',
      ].join('\n'),
    );
  });

  it('lists breaking changes first, from "!" and from the footer', () => {
    const notes = releaseNotes(
      [
        { hash: '1111111aaa', subject: 'feat!: new settings format', body: '' },
        {
          hash: '2222222bbb',
          subject: 'refactor: rename variables',
          body: 'BREAKING CHANGE: APP_NAME is now APP_TITLE',
        },
      ],
      options,
    );
    expect(notes).toContain(
      '## Achtung: inkompatible Änderungen\n\n' +
        '- new settings format (1111111)\n' +
        '- rename variables – APP_NAME is now APP_TITLE (2222222)',
    );
  });

  it('reads the git log format', () => {
    expect(parseGitLog('abc\x1ffeat: a\x1fbody line\n\x1e\ndef\x1ffix: b\x1f\x1e\n')).toEqual([
      { hash: 'abc', subject: 'feat: a', body: 'body line' },
      { hash: 'def', subject: 'fix: b', body: '' },
    ]);
  });
});
