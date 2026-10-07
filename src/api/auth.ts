import type { Api } from '@jellyfin/sdk/lib/api';
import type { AuthenticationResult } from '@jellyfin/sdk/lib/generated-client/models/authentication-result';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type { Profile, ServerSummary } from '@/domain/types';
import { createApi } from './client';
import { AppFailure } from './errors';
import { userImageUrl } from './urls';
import type { StoredSession } from './session-store';

function toSession(
  server: ServerSummary,
  result: AuthenticationResult,
  remembered: boolean,
): StoredSession {
  const user = result.User;
  if (!result.AccessToken || !user?.Id) {
    throw new AppFailure({ kind: 'server', detail: 'Authentication result without token or user' });
  }
  return {
    serverId: server.id,
    userId: user.Id,
    userName: user.Name ?? '',
    accessToken: result.AccessToken,
    imageTag: user.PrimaryImageTag ?? null,
    remembered,
    signedInAt: Date.now(),
  };
}

export async function signInWithPassword(
  server: ServerSummary,
  username: string,
  password: string,
  remembered: boolean,
): Promise<StoredSession> {
  const api = createApi(server.url);
  const { data } = await getAuthenticationApi(api).authenticateUserByName({
    authenticateUserByName: { Username: username, Pw: password },
  });
  return toSession(server, data, remembered);
}

export async function isQuickConnectEnabled(
  server: ServerSummary,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const { data } = await getAuthenticationApi(createApi(server.url)).getQuickConnectEnabled({
      signal,
    });
    return data;
  } catch {
    return false;
  }
}

export interface QuickConnectRequest {
  code: string;
  secret: string;
}

export async function startQuickConnect(server: ServerSummary): Promise<QuickConnectRequest> {
  const { data } = await getAuthenticationApi(createApi(server.url)).initiateQuickConnect();
  if (!data.Code || !data.Secret) {
    throw new AppFailure({ kind: 'server', detail: 'Quick Connect returned no code' });
  }
  return { code: data.Code, secret: data.Secret };
}

export async function isQuickConnectAuthorized(
  server: ServerSummary,
  secret: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const { data } = await getAuthenticationApi(createApi(server.url)).getQuickConnectState(
    { secret },
    { signal },
  );
  return data.Authenticated === true;
}

export async function completeQuickConnect(
  server: ServerSummary,
  secret: string,
  remembered: boolean,
): Promise<StoredSession> {
  const { data } = await getAuthenticationApi(createApi(server.url)).authenticateWithQuickConnect({
    quickConnectDto: { Secret: secret },
  });
  return toSession(server, data, remembered);
}

/** Ends the session on the server. Failures are ignored: the token is dropped locally anyway. */
export async function signOutOnServer(
  server: ServerSummary,
  session: StoredSession,
): Promise<void> {
  try {
    await getSessionApi(createApi(server.url, session.accessToken)).reportSessionEnded();
  } catch {
    // The server may be unreachable or the token already revoked.
  }
}

function avatarUrl(api: Api, user: Pick<UserDto, 'Id' | 'PrimaryImageTag'>): string | null {
  if (!user.Id || !user.PrimaryImageTag) return null;
  return userImageUrl(api, user.Id, user.PrimaryImageTag);
}

export async function getPublicProfiles(
  server: ServerSummary,
  signal?: AbortSignal,
): Promise<Profile[]> {
  const api = createApi(server.url);
  const { data } = await getUserApi(api).getPublicUsers({ signal });
  return data
    .filter((user): user is UserDto & { Id: string } => typeof user.Id === 'string')
    .map((user) => ({
      id: user.Id,
      name: user.Name ?? '',
      imageUrl: avatarUrl(api, user),
      // Deprecated in the 12.0 spec without a replacement, but still sent by 10.10–12.0. Without
      // it we would have to probe with an empty password, which counts towards the lockout.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- see above
      hasPassword: user.HasPassword !== false,
      remembered: false,
    }));
}

/** Profile entry for a user whose token is stored on this device. */
export function profileFromSession(server: ServerSummary, session: StoredSession): Profile {
  const api = createApi(server.url);
  return {
    id: session.userId,
    name: session.userName,
    imageUrl: avatarUrl(api, { Id: session.userId, PrimaryImageTag: session.imageTag }),
    hasPassword: true,
    remembered: true,
  };
}

/** Confirms a stored token still works and returns fresh user data. */
export async function verifySession(
  server: ServerSummary,
  session: StoredSession,
): Promise<UserDto> {
  const { data } = await getUserApi(createApi(server.url, session.accessToken)).getCurrentUser();
  return data;
}
