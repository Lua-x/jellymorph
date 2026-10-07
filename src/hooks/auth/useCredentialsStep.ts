import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { signInWithPassword } from '@/api/auth';
import { describeError } from '@/api/errors';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import type { ServerSummary } from '@/domain/types';
import { paths, returnTarget } from '@/navigation/paths';
import type { CredentialsInput, CredentialsStepModel } from './types';
import {
  usePublicProfilesQuery,
  useQuickConnectEnabled,
  useRememberedProfiles,
} from './usePublicProfiles';
import { useServerChange } from './useServerChange';

export function useCredentialsStep(server: ServerSummary): CredentialsStepModel {
  const config = useAppConfig();
  const navigate = useNavigate();
  // Router state is untyped; it is only passed on and validated by returnTarget().
  const returnState: unknown = useLocation().state;
  const [searchParams] = useSearchParams();
  const signIn = useSessionStore((state) => state.signIn);
  const notice = useSessionStore((state) => state.notice);
  const clearNotice = useSessionStore((state) => state.clearNotice);
  const quickConnectEnabled = useQuickConnectEnabled(server);
  const publicProfiles = usePublicProfilesQuery(server);
  const remembered = useRememberedProfiles(server);
  const changeServer = useServerChange();

  const login = useMutation({
    mutationFn: ({ username, password, remember }: CredentialsInput) =>
      signInWithPassword(server, username, password, remember),
    onSuccess: (session) => {
      signIn(session);
      void navigate(returnTarget(returnState), { replace: true });
    },
  });

  const hasProfiles = remembered.length > 0 || (publicProfiles.data?.length ?? 0) > 0;

  return {
    step: 'credentials',
    server,
    initialUsername: searchParams.get('user') ?? '',
    submitting: login.isPending,
    error: login.isError ? describeError(login.error) : null,
    notice,
    demo: config.demoMode,
    submit: (input) => {
      clearNotice();
      login.mutate({ ...input, username: input.username.trim() });
    },
    quickConnect: quickConnectEnabled
      ? () => {
          void navigate(paths.quickConnect, { state: returnState });
        }
      : null,
    showProfiles: hasProfiles
      ? () => {
          void navigate(paths.login, { state: returnState });
        }
      : null,
    changeServer,
  };
}
