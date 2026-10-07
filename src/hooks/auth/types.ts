import type { AppError, Profile, QueryResult, ServerProblem, ServerSummary } from '@/domain/types';

export interface SavedServerView extends ServerSummary {
  /** False for servers pinned by the deployment. */
  removable: boolean;
}

export interface ServerStepModel {
  step: 'server';
  servers: SavedServerView[];
  initialAddress: string;
  checking: boolean;
  problem: ServerProblem | null;
  minimumVersion: string;
  connect: (address: string) => void;
  choose: (serverId: string) => void;
  remove: (serverId: string) => void;
}

export interface CredentialsInput {
  username: string;
  password: string;
  remember: boolean;
}

export interface CredentialsStepModel {
  step: 'credentials';
  server: ServerSummary;
  initialUsername: string;
  submitting: boolean;
  error: AppError | null;
  /** Shown when the previous session ended unexpectedly. */
  notice: 'expired' | null;
  /** Running against the built-in demo server; themes may show the demo password. */
  demo: boolean;
  submit: (input: CredentialsInput) => void;
  quickConnect: (() => void) | null;
  showProfiles: (() => void) | null;
  changeServer: (() => void) | null;
}

export type QuickConnectState =
  | { status: 'starting' }
  | { status: 'waiting'; code: string; expiresAt: number }
  | { status: 'signingIn'; code: string }
  | { status: 'expired' }
  | { status: 'unavailable' }
  | { status: 'error'; error: AppError };

export interface QuickConnectStepModel {
  step: 'quickConnect';
  server: ServerSummary;
  state: QuickConnectState;
  /** The demo server approves codes on its own after a few seconds. */
  demo: boolean;
  remember: boolean;
  setRemember: (remember: boolean) => void;
  restart: () => void;
  usePassword: () => void;
  changeServer: (() => void) | null;
}

/** Everything the LoginPage of a theme needs; the step decides what to render. */
export type LoginFlow = ServerStepModel | CredentialsStepModel | QuickConnectStepModel;

export interface ProfileSelectModel {
  server: ServerSummary;
  profiles: QueryResult<Profile[]>;
  /** Profile currently signing in, for a busy indicator. */
  pendingProfileId: string | null;
  error: AppError | null;
  onSelect: (profile: Profile) => void;
  onForget: (profile: Profile) => void;
  onOtherUser: () => void;
  onQuickConnect: (() => void) | null;
  onChangeServer: (() => void) | null;
}
