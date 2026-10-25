import { describe, expect, it } from 'vitest';
import { dailyPicks, dayKey } from './daily';

describe('dailyPicks', () => {
  it('picks the same positions all day and others on another day', () => {
    const today = dailyPicks(500, 6, '2026-10-25');
    expect(dailyPicks(500, 6, '2026-10-25')).toEqual(today);
    expect(dailyPicks(500, 6, '2026-10-26')).not.toEqual(today);
  });

  it('returns different positions inside the list', () => {
    const picks = dailyPicks(40, 6, '2026-10-25');
    expect(picks).toHaveLength(6);
    expect(new Set(picks).size).toBe(6);
    expect(picks.every((index) => Number.isInteger(index) && index >= 0 && index < 40)).toBe(true);
  });

  it('never asks for more titles than there are', () => {
    expect(dailyPicks(3, 6, '2026-10-25').sort()).toEqual([0, 1, 2]);
    expect(dailyPicks(0, 6, '2026-10-25')).toEqual([]);
  });
});

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
