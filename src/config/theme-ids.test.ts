import { expect, it } from 'vitest';
import entrypoint from '../../docker/entrypoint.sh?raw';
import { THEME_IDS } from './theme-ids';

it('the container entrypoint accepts exactly the known theme ids for DEFAULT_THEME', () => {
  const declared = /^theme_ids="([^"]*)"$/m.exec(entrypoint)?.[1];
  expect(declared?.split(' ')).toEqual([...THEME_IDS]);
});
