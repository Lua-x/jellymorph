import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { isQuickConnectEnabled } from '@/api/auth';
import { describeError } from '@/api/errors';
import { useSessionStore } from '@/api/session-store';
import { useAppConfig } from '@/config/context';
import type { ServerSummary } from '@/domain/types';
import { paths, returnTarget } from '@/navigation/paths';
import { runQuickConnect } from './quick-connect';
import type { QuickConnectState, QuickConnectStepModel } from './types';
import { useServerChange } from './useServerChange';

export function useQuickConnectStep(server: ServerSummary): QuickConnectStepModel {
  const config = useAppConfig();
  const navigate = useNavigate();
  // Router state is untyped; it is only passed on and validated by returnTarget().
  const returnState: unknown = useLocation().state;
  const signIn = useSessionStore((state) => state.signIn);
  const changeServer = useServerChange();
  const [state, setState] = useState<QuickConnectState>({ status: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const [remember, setRememberState] = useState(true);
  const rememberRef = useRef(true);
  const returnTo = returnTarget(returnState);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function run() {
      if (!(await isQuickConnectEnabled(server, signal))) {
        if (!signal.aborted) setState({ status: 'unavailable' });
        return;
      }
      const outcome = await runQuickConnect(server, {
        signal,
        onCode: ({ code }, expiresAt) => {
          setState({ status: 'waiting', code, expiresAt });
        },
        onAuthorized: () => {
          setState((current) =>
            current.status === 'waiting' ? { status: 'signingIn', code: current.code } : current,
          );
        },
        remembered: () => rememberRef.current,
      });
      if (outcome.status === 'expired') {
        setState({ status: 'expired' });
        return;
      }
      signIn(outcome.session);
      void navigate(returnTo, { replace: true });
    }

    run().catch((error: unknown) => {
      if (!signal.aborted) setState({ status: 'error', error: describeError(error) });
    });
    return () => {
      controller.abort();
    };
  }, [attempt, server, signIn, navigate, returnTo]);

  return {
    step: 'quickConnect',
    server,
    state,
    demo: config.demoMode,
    remember,
    setRemember: (value) => {
      rememberRef.current = value;
      setRememberState(value);
    },
    restart: () => {
      setState({ status: 'starting' });
      setAttempt((count) => count + 1);
    },
    usePassword: () => {
      void navigate(paths.password(), { state: returnState, replace: true });
    },
    changeServer,
  };
}
