/** Renders the whole app against the mock server with a signed-in demo user. */
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSessionStore } from '@/api/session-store';
import { App } from '@/app/App';
import { DEFAULT_APP_CONFIG, type AppConfig } from '@/config/app-config';
import { initI18n } from '@/i18n';
import { DEMO_SERVER, DEMO_USERS } from '@/mocks/fixtures';
import { mockState, TEST_SERVER_URL } from '@/mocks/node';
import { loadDefaultTheme, loadThemeModule } from '@/themes/loader';
import { getThemeManifest } from '@/themes/registry';

export const config: AppConfig = {
  ...DEFAULT_APP_CONFIG,
  jellyfinUrl: TEST_SERVER_URL,
  lockServer: true,
};
export const alex = DEMO_USERS[0];
export const TIMEOUT = { timeout: 4000 };

export function byName<T extends { name: string }>(list: readonly T[], name: string): T {
  const found = list.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing demo item ${name}`);
  return found;
}

/** Translations and theme chunks, loaded once per test file (beforeAll). */
export async function prepareApp(): Promise<void> {
  await initI18n('de');
  await Promise.all([loadDefaultTheme(), loadThemeModule(getThemeManifest('default'))]);
}

/** Signs Alex in directly and opens `path`. */
export async function openAs(path: string) {
  const token = mockState.issueToken(alex?.id ?? '');
  useSessionStore.setState({
    servers: [
      {
        id: DEMO_SERVER.Id,
        name: DEMO_SERVER.ServerName,
        url: TEST_SERVER_URL,
        version: DEMO_SERVER.Version,
        fixed: true,
        lastUsedAt: 1,
      },
    ],
    currentServerId: DEMO_SERVER.Id,
    sessions: [],
    active: null,
    api: null,
    notice: null,
  });
  useSessionStore.getState().signIn({
    serverId: DEMO_SERVER.Id,
    userId: alex?.id ?? '',
    userName: 'Alex',
    accessToken: token,
    imageTag: null,
    remembered: true,
    signedInAt: 1,
  });
  window.history.replaceState(null, '', path);
  const user = userEvent.setup();
  await act(async () => {
    render(<App config={config} />);
    await Promise.resolve();
  });
  return user;
}
