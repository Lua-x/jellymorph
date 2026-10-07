import type { SessionKey } from '@/api/session-store';

/**
 * Query keys. Everything that belongs to a user starts with [serverId, userId], so data of one
 * user can never show up for another one.
 */
export const queryKeys = {
  fixedServer: (url: string) => ['fixedServer', url] as const,
  publicProfiles: (serverId: string) => ['server', serverId, 'publicProfiles'] as const,
  quickConnectEnabled: (serverId: string) => ['server', serverId, 'quickConnectEnabled'] as const,
  currentUser: ({ serverId, userId }: SessionKey) => [serverId, userId, 'currentUser'] as const,
  libraries: ({ serverId, userId }: SessionKey) => [serverId, userId, 'libraries'] as const,
};
