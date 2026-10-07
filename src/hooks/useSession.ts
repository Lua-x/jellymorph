import type { Api } from '@jellyfin/sdk/lib/api';
import {
  getActiveSession,
  getCurrentServer,
  useSessionStore,
  type SessionKey,
  type StoredServer,
  type StoredSession,
} from '@/api/session-store';

export interface ActiveSession {
  api: Api;
  key: SessionKey;
  session: StoredSession;
  server: StoredServer;
}

/** The signed-in session. Only valid below the session guard. */
export function useActiveSession(): ActiveSession {
  const api = useSessionStore((state) => state.api);
  const session = useSessionStore(getActiveSession);
  const server = useSessionStore((state) =>
    state.servers.find((candidate) => candidate.id === state.active?.serverId),
  );
  if (!api || !session || !server) throw new Error('useActiveSession requires a signed-in user');
  return { api, key: { serverId: session.serverId, userId: session.userId }, session, server };
}

/** The server the sign-in screens work with, or null when none is chosen yet. */
export function useCurrentServer(): StoredServer | null {
  return useSessionStore(getCurrentServer);
}
