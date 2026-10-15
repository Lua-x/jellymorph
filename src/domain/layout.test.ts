import { describe, expect, it } from 'vitest';
import {
  arrange,
  effectiveLayout,
  layoutFromJson,
  layoutToJson,
  mergeOrder,
  moveEntry,
  parseLayout,
  setEntryHidden,
  visibleIds,
} from './layout';

describe('mergeOrder', () => {
  it('keeps the default order when nothing is saved', () => {
    expect(mergeOrder(['a', 'b', 'c'], null)).toEqual(['a', 'b', 'c']);
  });

  it('applies the saved order and drops entries that are gone', () => {
    expect(mergeOrder(['a', 'b', 'c'], ['c', 'gone', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('puts new entries behind the entry that precedes them by default', () => {
    // A library "x" was added after "b" was saved first.
    expect(mergeOrder(['a', 'b', 'x', 'c'], ['c', 'b', 'a'])).toEqual(['c', 'b', 'x', 'a']);
    expect(mergeOrder(['x', 'a', 'b'], ['b', 'a'])).toEqual(['x', 'b', 'a']);
  });

  it('keeps the hero first and ignores duplicates', () => {
    expect(mergeOrder(['hero', 'resume', 'genres'], ['genres', 'hero', 'genres'])).toEqual([
      'hero',
      'genres',
      'resume',
    ]);
  });
});

describe('arrange and visibleIds', () => {
  const defaults = ['play', 'trailer', 'favorite', 'played'];

  it('hides what the layout hides, except "play"', () => {
    const layout = { order: null, hidden: ['trailer', 'play'] };
    expect(arrange(defaults, layout)).toEqual([
      { id: 'play', hidden: false },
      { id: 'trailer', hidden: true },
      { id: 'favorite', hidden: false },
      { id: 'played', hidden: false },
    ]);
    expect(visibleIds(defaults, layout)).toEqual(['play', 'favorite', 'played']);
  });
});

describe('effectiveLayout', () => {
  it('takes the own arrangement per list, else the default for everybody', () => {
    const own = { nav: { order: ['search'], hidden: [] } };
    const everybody = {
      nav: { order: ['favorites'], hidden: [] },
      home: { order: null, hidden: ['genres'] },
    };
    expect(effectiveLayout(own, everybody)).toEqual({
      nav: { order: ['search'], hidden: [] },
      home: { order: null, hidden: ['genres'] },
    });
  });
});

describe('moveEntry and setEntryHidden', () => {
  const entries = arrange(['hero', 'resume', 'nextUp', 'genres'], {
    order: null,
    hidden: ['nextUp'],
  });

  it('moves an entry and keeps the hidden ones', () => {
    expect(moveEntry(entries, 3, 1)).toEqual({
      order: ['hero', 'genres', 'resume', 'nextUp'],
      hidden: ['nextUp'],
    });
  });

  it('never moves anything in front of the hero, nor the hero itself', () => {
    expect(moveEntry(entries, 2, 0).order).toEqual(['hero', 'nextUp', 'resume', 'genres']);
    expect(moveEntry(entries, 0, 2).order).toEqual(['hero', 'resume', 'nextUp', 'genres']);
  });

  it('shows and hides without fixing the order', () => {
    expect(setEntryHidden(undefined, 'genres', true)).toEqual({ order: null, hidden: ['genres'] });
    expect(setEntryHidden({ order: ['a'], hidden: ['genres'] }, 'genres', false)).toEqual({
      order: ['a'],
      hidden: [],
    });
    expect(setEntryHidden(undefined, 'play', true).hidden).toEqual([]);
  });
});

describe('parseLayout', () => {
  it('keeps valid lists and drops everything else', () => {
    expect(
      parseLayout({
        home: { order: ['hero', 3, ''], hidden: ['genres'] },
        nav: { order: null, hidden: 'search' },
        unknown: { order: [] },
        facts: 'broken',
      }),
    ).toEqual({
      home: { order: ['hero'], hidden: ['genres'] },
      nav: { order: null, hidden: [] },
    });
  });

  it('reads and writes JSON, broken text counts as nothing', () => {
    const layout = { detailActions: { order: ['favorite', 'play'], hidden: ['trailer'] } };
    expect(layoutFromJson(layoutToJson(layout))).toEqual(layout);
    expect(layoutFromJson('{nope')).toEqual({});
    expect(layoutFromJson(null)).toEqual({});
  });
});
