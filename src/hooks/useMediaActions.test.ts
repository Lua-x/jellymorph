import { describe, expect, it } from 'vitest';
import { patchUserData } from './useMediaActions';

const userData = {
  played: false,
  favorite: false,
  progress: null,
  positionTicks: 0,
  unplayedCount: null,
};

describe('patchUserData', () => {
  it('patches every copy of the item in nested query data', () => {
    const data = {
      total: 2,
      items: [
        { id: 'a', userData },
        { id: 'b', userData },
      ],
      groups: [{ kind: 'movies', items: [{ id: 'a', userData }] }],
    };
    const patched = patchUserData(data, 'a', { favorite: true }) as typeof data;
    expect(patched.items[0]?.userData.favorite).toBe(true);
    expect(patched.groups[0]?.items[0]?.userData.favorite).toBe(true);
    expect(patched.items[1]).toBe(data.items[1]);
  });

  it('keeps the identity of data without the item', () => {
    const data = { items: [{ id: 'b', userData }] };
    expect(patchUserData(data, 'a', { favorite: true })).toBe(data);
    expect(patchUserData(undefined, 'a', { favorite: true })).toBeUndefined();
  });

  it('patches a detail object itself', () => {
    const detail = { id: 'a', userData, cast: [{ id: 'p', name: 'X' }] };
    const patched = patchUserData(detail, 'a', { played: true }) as typeof detail;
    expect(patched.userData.played).toBe(true);
    expect(patched.cast).toBe(detail.cast);
  });
});
