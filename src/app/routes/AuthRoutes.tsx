import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { getFixedServerUrl } from '@/config/app-config';
import { useAppConfig } from '@/config/context';
import type { ServerSummary } from '@/domain/types';
import { useCredentialsStep } from '@/hooks/auth/useCredentialsStep';
import { useProfileSelect } from '@/hooks/auth/useProfileSelect';
import { usePublicProfilesQuery } from '@/hooks/auth/usePublicProfiles';
import { useQuickConnectStep } from '@/hooks/auth/useQuickConnectStep';
import { useServerStep } from '@/hooks/auth/useServerStep';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCurrentServer } from '@/hooks/useSession';
import { paths } from '@/navigation/paths';
import { ThemeSlot } from '@/themes/ThemeSlot';
import { SignedOutOnly } from './guards';

function useRequiredServer(): ServerSummary {
  const server = useCurrentServer();
  if (!server) throw new Error('A server must be selected (ServerGuard)');
  return server;
}

function ServerStep() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('server.title'));
  return <ThemeSlot name="LoginPage" props={{ flow: useServerStep() }} />;
}

export function ServerRoute() {
  const config = useAppConfig();
  if (getFixedServerUrl(config, window.location.origin)) {
    return <Navigate to={paths.login} replace />;
  }
  return (
    <SignedOutOnly>
      <ServerStep />
    </SignedOutOnly>
  );
}

function ProfileStep({ server }: { server: ServerSummary }) {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('profiles.title'));
  const model = useProfileSelect(server);
  const publicProfiles = usePublicProfilesQuery(server);
  const { profiles } = model;
  // Without profiles to show (none public, none remembered) the password form is the start.
  const nothingToPick =
    (profiles.status === 'success' && profiles.data.length === 0) ||
    (profiles.status === 'error' && publicProfiles.isError);
  if (nothingToPick) return <Navigate to={paths.password()} replace />;
  return <ThemeSlot name="ProfileSelect" props={model} />;
}

export function LoginRoute() {
  const server = useRequiredServer();
  return (
    <SignedOutOnly>
      <ProfileStep server={server} />
    </SignedOutOnly>
  );
}

function CredentialsStep({ server }: { server: ServerSummary }) {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('credentials.title'));
  return <ThemeSlot name="LoginPage" props={{ flow: useCredentialsStep(server) }} />;
}

export function PasswordRoute() {
  const server = useRequiredServer();
  return (
    <SignedOutOnly>
      <CredentialsStep server={server} />
    </SignedOutOnly>
  );
}

function QuickConnectStep({ server }: { server: ServerSummary }) {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('quickConnect.title'));
  return <ThemeSlot name="LoginPage" props={{ flow: useQuickConnectStep(server) }} />;
}

export function QuickConnectRoute() {
  const server = useRequiredServer();
  return (
    <SignedOutOnly>
      <QuickConnectStep server={server} />
    </SignedOutOnly>
  );
}
