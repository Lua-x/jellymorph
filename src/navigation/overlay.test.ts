import type { Location } from 'react-router';
import { describe, expect, it } from 'vitest';
import { backgroundOf, opensAsOverlay, overlayState } from './overlay';

function location(pathname: string, state: unknown = null): Location {
  return { pathname, search: '', hash: '', state, key: pathname };
}

describe('overlay navigation', () => {
  const home = location('/');

  it('only opens item details as an overlay', () => {
    expect(opensAsOverlay('/item/abc')).toBe(true);
    expect(opensAsOverlay('/person/abc')).toBe(false);
    expect(opensAsOverlay('/collection/abc')).toBe(false);
    expect(opensAsOverlay('/item/abc/extra')).toBe(false);
  });

  it('reads the page under an overlay from the history state', () => {
    const details = location('/item/abc', overlayState(home));
    expect(backgroundOf(details)).toBe(home);
    expect(backgroundOf(home)).toBeNull();
    expect(backgroundOf(location('/item/abc', { backgroundLocation: 'nonsense' }))).toBeNull();
  });

  it('ignores a background on routes that cannot be overlays', () => {
    expect(backgroundOf(location('/person/abc', overlayState(home)))).toBeNull();
  });

  it('keeps the original page when details open from details', () => {
    const first = location('/item/abc', overlayState(home));
    const second = location('/item/def', overlayState(first));
    expect(backgroundOf(second)).toBe(home);
  });
});
