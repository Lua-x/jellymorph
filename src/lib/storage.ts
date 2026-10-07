/**
 * Storage access that never throws. Browsers block storage in some private modes and
 * sandboxed contexts; the app must keep working there, just without persistence.
 */

export type StorageArea = 'local' | 'session';

function area(kind: StorageArea): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readString(kind: StorageArea, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeString(kind: StorageArea, key: string, value: string | null): void {
  try {
    const storage = area(kind);
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled: persistence is best effort.
  }
}

export function readJson(kind: StorageArea, key: string): unknown {
  const raw = readString(kind, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeJson(kind: StorageArea, key: string, value: unknown): void {
  writeString(kind, key, value === null || value === undefined ? null : JSON.stringify(value));
}
