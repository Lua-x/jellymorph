import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredSession } from './session-store';

const server = { id: 'srv1', name: 'Home', url: 'http://jellyfin.test', version: '10.11.0' };

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    serverId: 'srv1',
    userId: 'user1',
    userName: 'Alex',
    accessToken: 'token-1',
    imageTag: null,
    remembered: true,
    signedInAt: 1,
    ...overrides,
  };
}

/** The store reads storage when the module loads, so each test gets a fresh module. */
async function freshStore() {
  vi.resetModules();
  return (await import('./session-store')).useSessionStore;
}

describe('session store', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores remembered sessions in localStorage and tab sessions in sessionStorage', async () => {
    const store = await freshStore();
    store.getState().upsertServer(server);
    store.getState().signIn(session());
    store
      .getState()
      .signIn(session({ userId: 'user2', accessToken: 'token-2', remembered: false }));

    const local = JSON.parse(
      localStorage.getItem('jellymorph.sessions') ?? '[]',
    ) as StoredSession[];
    const tab = JSON.parse(
      sessionStorage.getItem('jellymorph.sessions') ?? '[]',
    ) as StoredSession[];
    expect(local.map((entry) => entry.userId)).toEqual(['user1']);
    expect(tab.map((entry) => entry.userId)).toEqual(['user2']);
  });

  it('never persists anything that looks like a password', async () => {
    const store = await freshStore();
    store.getState().upsertServer(server);
    store.getState().signIn(session());
    const everything = JSON.stringify([
      Object.entries(localStorage),
      Object.entries(sessionStorage),
    ]);
    expect(everything).not.toMatch(/password|"pw"/i);
  });

  it('restores the active session and its API after a reload', async () => {
    const first = await freshStore();
    first.getState().upsertServer(server);
    first.getState().signIn(session());

    const second = await freshStore();
    expect(second.getState().active).toEqual({ serverId: 'srv1', userId: 'user1' });
    expect(second.getState().api?.accessToken).toBe('token-1');
    expect(second.getState().api?.basePath).toBe('http://jellyfin.test');
  });

  it('ignores corrupted storage', async () => {
    localStorage.setItem('jellymorph.sessions', '{not json');
    localStorage.setItem('jellymorph.servers', JSON.stringify({ servers: [{ id: 1 }] }));
    const store = await freshStore();
    expect(store.getState().sessions).toEqual([]);
    expect(store.getState().servers).toEqual([]);
  });

  it('marks an expired session and drops its token', async () => {
    const store = await freshStore();
    store.getState().upsertServer(server);
    store.getState().signIn(session());
    store.getState().expireActive();
    expect(store.getState().active).toBeNull();
    expect(store.getState().api).toBeNull();
    expect(store.getState().notice).toBe('expired');
    expect(store.getState().sessions).toEqual([]);
  });

  it('keeps pinned servers when the user tries to remove them', async () => {
    const store = await freshStore();
    store.getState().upsertServer(server, true);
    store.getState().removeServer('srv1');
    expect(store.getState().servers).toHaveLength(1);
  });

  it('removes a server together with its sessions', async () => {
    const store = await freshStore();
    store.getState().upsertServer(server);
    store.getState().signIn(session());
    store.getState().removeServer('srv1');
    expect(store.getState().servers).toEqual([]);
    expect(store.getState().sessions).toEqual([]);
    expect(store.getState().active).toBeNull();
  });
});
