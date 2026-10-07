import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { signInWithPassword, signOutOnServer, verifySession } from '@/api/auth';
import { describeError } from '@/api/errors';
import { sameSession, useSessionStore } from '@/api/session-store';
import type { AppError, Profile, QueryResult, ServerSummary } from '@/domain/types';
import { paths, returnTarget } from '@/navigation/paths';
import { toQueryResult } from '../query-result';
import type { ProfileSelectModel } from './types';
import {
  mergeProfiles,
  usePublicProfilesQuery,
  useQuickConnectEnabled,
  useRememberedProfiles,
} from './usePublicProfiles';
import { useServerChange } from './useServerChange';

export function useProfileSelect(server: ServerSummary): ProfileSelectModel {
  const navigate = useNavigate();
  // Router state is untyped; it is only passed on and validated by returnTarget().
  const returnState: unknown = useLocation().state;
  const sessions = useSessionStore((state) => state.sessions);
  const signIn = useSessionStore((state) => state.signIn);
  const activate = useSessionStore((state) => state.activate);
  const removeSession = useSessionStore((state) => state.removeSession);
  const publicQuery = usePublicProfilesQuery(server);
  const remembered = useRememberedProfiles(server);
  const quickConnectEnabled = useQuickConnectEnabled(server);
  const changeServer = useServerChange();
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const publicResult = toQueryResult(publicQuery);
  let profiles: QueryResult<Profile[]>;
  if (publicResult.status === 'success') {
    profiles = { ...publicResult, data: mergeProfiles(remembered, publicResult.data) };
  } else if (remembered.length > 0) {
    // Remembered users can always sign in, even if the public list failed or is still loading.
    profiles = {
      status: 'success',
      data: remembered,
      isRefreshing: publicResult.status === 'pending',
    };
  } else {
    profiles = publicResult;
  }

  const finish = () => {
    void navigate(returnTarget(returnState), { replace: true });
  };

  async function select(profile: Profile) {
    const key = { serverId: server.id, userId: profile.id };
    const stored = sessions.find((session) => sameSession(session, key));
    if (stored) {
      try {
        await verifySession(server, stored);
        activate(key);
        finish();
        return;
      } catch (failure) {
        const appError = describeError(failure);
        if (appError.kind !== 'auth') throw failure;
        // The token was revoked on the server: forget it and ask for the password.
        removeSession(key);
        void navigate(paths.password(profile.name), { state: returnState });
        return;
      }
    }
    if (!profile.hasPassword) {
      signIn(await signInWithPassword(server, profile.name, '', true));
      finish();
      return;
    }
    void navigate(paths.password(profile.name), { state: returnState });
  }

  return {
    server,
    profiles,
    pendingProfileId,
    error,
    onSelect: (profile) => {
      if (pendingProfileId) return;
      setError(null);
      setPendingProfileId(profile.id);
      select(profile)
        .catch((failure: unknown) => {
          setError(describeError(failure));
        })
        .finally(() => {
          setPendingProfileId(null);
        });
    },
    onForget: (profile) => {
      const key = { serverId: server.id, userId: profile.id };
      const stored = sessions.find((session) => sameSession(session, key));
      if (stored) void signOutOnServer(server, stored);
      removeSession(key);
    },
    onOtherUser: () => {
      void navigate(paths.password(), { state: returnState });
    },
    onQuickConnect: quickConnectEnabled
      ? () => {
          void navigate(paths.quickConnect, { state: returnState });
        }
      : null,
    onChangeServer: changeServer,
  };
}
