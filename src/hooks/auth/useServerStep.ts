import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signOutOnServer } from '@/api/auth';
import { checkServerAddress, MINIMUM_VERSION } from '@/api/servers';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import type { ServerProblem } from '@/domain/types';
import { paths } from '@/navigation/paths';
import type { ServerStepModel } from './types';

export function useServerStep(): ServerStepModel {
  const config = useAppConfig();
  const navigate = useNavigate();
  const servers = useSessionStore((state) => state.servers);
  const sessions = useSessionStore((state) => state.sessions);
  const upsertServer = useSessionStore((state) => state.upsertServer);
  const selectServer = useSessionStore((state) => state.selectServer);
  const removeServer = useSessionStore((state) => state.removeServer);
  const [problem, setProblem] = useState<ServerProblem | null>(null);

  const check = useMutation({
    mutationFn: checkServerAddress,
    onSuccess: (result) => {
      if (!result.ok) {
        setProblem(result);
        return;
      }
      const server = upsertServer(result.server);
      selectServer(server.id);
      void navigate(paths.login);
    },
    onError: () => {
      setProblem({ reason: 'unreachable' });
    },
  });

  return {
    step: 'server',
    servers: [...servers]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .map((server) => ({ ...server, removable: !server.fixed })),
    initialAddress: config.jellyfinUrl ?? '',
    checking: check.isPending,
    problem,
    minimumVersion: MINIMUM_VERSION,
    connect: (address) => {
      setProblem(null);
      check.mutate(address);
    },
    choose: (serverId) => {
      selectServer(serverId);
      void navigate(paths.login);
    },
    remove: (serverId) => {
      const server = servers.find((candidate) => candidate.id === serverId);
      if (server) {
        for (const session of sessions.filter((candidate) => candidate.serverId === serverId)) {
          void signOutOnServer(server, session);
        }
      }
      removeServer(serverId);
    },
  };
}
