import type { Api } from '@jellyfin/sdk/lib/api';
import { create } from 'zustand';
import type { ServerSummary } from '@/domain/types';
import { readJson, writeJson, type StorageArea } from '@/lib/storage';
import { createApi, onUnauthorized } from './client';

export interface StoredServer extends ServerSummary {
  /** Pinned by the deployment (demo, proxy or LOCK_SERVER); cannot be removed by the user. */
  fixed: boolean;
  lastUsedAt: number;
}

/** A signed-in user. Only the access token is stored, never a password. */
export interface StoredSession {
  serverId: string;
  userId: string;
  userName: string;
  accessToken: string;
  imageTag: string | null;
  /** Kept in localStorage; otherwise only for this browser tab (sessionStorage). */
  remembered: boolean;
  signedInAt: number;
}

export interface SessionKey {
  serverId: string;
  userId: string;
}

interface SessionState {
  servers: StoredServer[];
  currentServerId: string | null;
  sessions: StoredSession[];
  active: SessionKey | null;
  /** API instance for the active session. */
  api: Api | null;
  /** Why the user was sent back to the sign-in screen. */
  notice: 'expired' | null;

  upsertServer: (server: ServerSummary, fixed?: boolean) => StoredServer;
  removeServer: (serverId: string) => void;
  selectServer: (serverId: string | null) => void;
  /** Stores a new session and makes it the active one. */
  signIn: (session: StoredSession) => void;
  activate: (key: SessionKey) => void;
  deactivate: () => void;
  removeSession: (key: SessionKey) => void;
  expireActive: () => void;
  clearNotice: () => void;
}

const SERVERS_KEY = 'jellymorph.servers';
const SESSIONS_KEY = 'jellymorph.sessions';
const ACTIVE_KEY = 'jellymorph.active';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredServer(value: unknown): value is StoredServer {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.url === 'string' &&
    typeof value.version === 'string' &&
    typeof value.fixed === 'boolean' &&
    typeof value.lastUsedAt === 'number'
  );
}

function isStoredSession(value: unknown): value is StoredSession {
  return (
    isRecord(value) &&
    typeof value.serverId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.userName === 'string' &&
    typeof value.accessToken === 'string' &&
    value.accessToken !== '' &&
    (value.imageTag === null || typeof value.imageTag === 'string') &&
    typeof value.remembered === 'boolean' &&
    typeof value.signedInAt === 'number'
  );
}

function isSessionKey(value: unknown): value is SessionKey {
  return isRecord(value) && typeof value.serverId === 'string' && typeof value.userId === 'string';
}

function readSessions(area: StorageArea, remembered: boolean): StoredSession[] {
  const raw = readJson(area, SESSIONS_KEY);
  return Array.isArray(raw)
    ? raw.filter(isStoredSession).filter((session) => session.remembered === remembered)
    : [];
}

export function sameSession(a: SessionKey | null, b: SessionKey | null): boolean {
  return a !== null && b !== null && a.serverId === b.serverId && a.userId === b.userId;
}

function loadInitialState(): Pick<
  SessionState,
  'servers' | 'currentServerId' | 'sessions' | 'active'
> {
  const rawServers = readJson('local', SERVERS_KEY);
  const servers =
    isRecord(rawServers) && Array.isArray(rawServers.servers)
      ? rawServers.servers.filter(isStoredServer)
      : [];
  const currentServerId =
    isRecord(rawServers) && typeof rawServers.currentServerId === 'string'
      ? rawServers.currentServerId
      : null;
  const sessions = [...readSessions('local', true), ...readSessions('session', false)];

  const candidates = [readJson('session', ACTIVE_KEY), readJson('local', ACTIVE_KEY)];
  const active =
    candidates
      .filter(isSessionKey)
      .find((key) => sessions.some((session) => sameSession(session, key))) ?? null;

  return { servers, currentServerId, sessions, active };
}

function persist(state: SessionState): void {
  writeJson('local', SERVERS_KEY, {
    servers: state.servers,
    currentServerId: state.currentServerId,
  });
  writeJson(
    'local',
    SESSIONS_KEY,
    state.sessions.filter((session) => session.remembered),
  );
  writeJson(
    'session',
    SESSIONS_KEY,
    state.sessions.filter((session) => !session.remembered),
  );
  const activeSession = state.sessions.find((session) => sameSession(session, state.active));
  writeJson('session', ACTIVE_KEY, state.active);
  // Other tabs and the next visit start with the last remembered user.
  if (!state.active || activeSession?.remembered) writeJson('local', ACTIVE_KEY, state.active);
}

function buildApi(
  servers: StoredServer[],
  sessions: StoredSession[],
  key: SessionKey | null,
): Api | null {
  const session = sessions.find((candidate) => sameSession(candidate, key));
  const server = servers.find((candidate) => candidate.id === session?.serverId);
  return session && server ? createApi(server.url, session.accessToken) : null;
}

const initial = loadInitialState();

export const useSessionStore = create<SessionState>()((set, get) => ({
  ...initial,
  api: buildApi(initial.servers, initial.sessions, initial.active),
  notice: null,

  upsertServer: (summary, fixed = false) => {
    const existing = get().servers.find((server) => server.id === summary.id);
    const server: StoredServer = {
      ...summary,
      fixed: fixed || (existing?.fixed ?? false),
      lastUsedAt: Date.now(),
    };
    const servers = existing
      ? get().servers.map((candidate) => (candidate.id === summary.id ? server : candidate))
      : [...get().servers, server];
    // The address of a server may change; keep the active API in sync.
    const api =
      existing && existing.url !== server.url
        ? buildApi(servers, get().sessions, get().active)
        : get().api;
    set({ servers, api });
    return server;
  },

  removeServer: (serverId) => {
    const { servers, sessions, currentServerId, active } = get();
    if (servers.find((server) => server.id === serverId)?.fixed) return;
    const removesActive = active?.serverId === serverId;
    set({
      servers: servers.filter((server) => server.id !== serverId),
      sessions: sessions.filter((session) => session.serverId !== serverId),
      currentServerId: currentServerId === serverId ? null : currentServerId,
      active: removesActive ? null : active,
      api: removesActive ? null : get().api,
    });
  },

  selectServer: (serverId) => {
    set({
      currentServerId: serverId,
      servers: get().servers.map((server) =>
        server.id === serverId ? { ...server, lastUsedAt: Date.now() } : server,
      ),
    });
  },

  signIn: (session) => {
    const sessions = [
      ...get().sessions.filter((candidate) => !sameSession(candidate, session)),
      session,
    ];
    const key = { serverId: session.serverId, userId: session.userId };
    set({
      sessions,
      active: key,
      currentServerId: session.serverId,
      api: buildApi(get().servers, sessions, key),
      notice: null,
    });
  },

  activate: (key) => {
    if (!get().sessions.some((session) => sameSession(session, key))) return;
    set({
      active: key,
      currentServerId: key.serverId,
      api: buildApi(get().servers, get().sessions, key),
      notice: null,
    });
  },

  deactivate: () => {
    set({ active: null, api: null });
  },

  removeSession: (key) => {
    const removesActive = sameSession(get().active, key);
    set({
      sessions: get().sessions.filter((session) => !sameSession(session, key)),
      active: removesActive ? null : get().active,
      api: removesActive ? null : get().api,
    });
  },

  expireActive: () => {
    const { active } = get();
    if (!active) return;
    set({
      sessions: get().sessions.filter((session) => !sameSession(session, active)),
      active: null,
      api: null,
      notice: 'expired',
    });
  },

  clearNotice: () => {
    set({ notice: null });
  },
}));

useSessionStore.subscribe(persist);

onUnauthorized((api) => {
  if (api === useSessionStore.getState().api) useSessionStore.getState().expireActive();
});

export function getActiveSession(state: SessionState): StoredSession | null {
  return state.sessions.find((session) => sameSession(session, state.active)) ?? null;
}

export function getCurrentServer(state: SessionState): StoredServer | null {
  return state.servers.find((server) => server.id === state.currentServerId) ?? null;
}
