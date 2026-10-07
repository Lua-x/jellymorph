import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getPublicProfiles, isQuickConnectEnabled, profileFromSession } from '@/api/auth';
import { useSessionStore } from '@/api/session-store';
import type { Profile, ServerSummary } from '@/domain/types';
import { queryKeys } from '../query-keys';

/** Public users of the server (if it lists them). */
export function usePublicProfilesQuery(server: ServerSummary) {
  return useQuery({
    queryKey: queryKeys.publicProfiles(server.id),
    queryFn: ({ signal }) => getPublicProfiles(server, signal),
    staleTime: 60_000,
  });
}

export function useQuickConnectEnabled(server: ServerSummary): boolean {
  const query = useQuery({
    queryKey: queryKeys.quickConnectEnabled(server.id),
    queryFn: ({ signal }) => isQuickConnectEnabled(server, signal),
    staleTime: 5 * 60_000,
  });
  return query.data === true;
}

/** Users with a token stored on this device, newest first. */
export function useRememberedProfiles(server: ServerSummary): Profile[] {
  const sessions = useSessionStore((state) => state.sessions);
  return useMemo(
    () =>
      sessions
        .filter((session) => session.serverId === server.id && session.remembered)
        .sort((a, b) => b.signedInAt - a.signedInAt)
        .map((session) => profileFromSession(server, session)),
    [sessions, server],
  );
}

/** Remembered profiles first, then public users that are not remembered yet. */
export function mergeProfiles(remembered: Profile[], publicProfiles: Profile[]): Profile[] {
  const rememberedIds = new Set(remembered.map((profile) => profile.id));
  const publicById = new Map(publicProfiles.map((profile) => [profile.id, profile]));
  return [
    ...remembered.map((profile) => ({
      ...profile,
      imageUrl: profile.imageUrl ?? publicById.get(profile.id)?.imageUrl ?? null,
    })),
    ...publicProfiles.filter((profile) => !rememberedIds.has(profile.id)),
  ];
}
