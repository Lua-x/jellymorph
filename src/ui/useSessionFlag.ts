import { useCallback, useState } from 'react';
import { readString, writeString } from '@/lib/storage';

const PREFIX = 'jellymorph.session.';

/**
 * A flag that lasts for the browser session (tab), e.g. "the boot sequence has been shown".
 * Themes may not touch storage themselves; this is the shared way for such one-time effects.
 */
export function useSessionFlag(key: string): [boolean, () => void] {
  const [value, setValue] = useState(() => readString('session', PREFIX + key) === '1');
  const set = useCallback(() => {
    writeString('session', PREFIX + key, '1');
    setValue(true);
  }, [key]);
  return [value, set];
}
