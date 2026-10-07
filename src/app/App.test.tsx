import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/api/session-store';
import { DEFAULT_APP_CONFIG, type AppConfig } from '@/config/app-config';
import { initI18n } from '@/i18n';
import { DEMO_SERVER, DEMO_USERS } from '@/mocks/fixtures';
import { mockState, TEST_SERVER_URL } from '@/mocks/node';
import { loadDefaultTheme, loadThemeModule } from '@/themes/loader';
import { getThemeManifest } from '@/themes/registry';
import { App } from './App';

const locked: AppConfig = { ...DEFAULT_APP_CONFIG, jellyfinUrl: TEST_SERVER_URL, lockServer: true };

async function renderApp(config: AppConfig = locked) {
  const user = userEvent.setup();
  // The theme chunk suspends the first render; let React finish that inside act().
  await act(async () => {
    render(<App config={config} />);
    await Promise.resolve();
  });
  return { user };
}

/** The user menu shows who is signed in once the app shell is there. */
function findSignedIn(name: string) {
  return screen.findByRole(
    'button',
    { name: new RegExp(`^${name}.*Benutzermenü`) },
    { timeout: 3000 },
  );
}

beforeAll(async () => {
  await initI18n('de');
  await Promise.all([loadDefaultTheme(), loadThemeModule(getThemeManifest('default'))]);
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  useSessionStore.setState({
    servers: [],
    currentServerId: null,
    sessions: [],
    active: null,
    api: null,
    notice: null,
  });
});

describe('sign-in', () => {
  it('signs in with a profile that has no password and shows the libraries', async () => {
    const { user } = await renderApp();
    await user.click(await screen.findByRole('button', { name: /Alex/ }));

    expect(await findSignedIn('Alex')).toBeInTheDocument();
    const libraries = await screen.findByRole('region', { name: 'Bibliotheken' });
    expect(await within(libraries).findByRole('link', { name: /Filme/ })).toBeInTheDocument();
    expect(within(libraries).getByRole('link', { name: /Anime/ })).toBeInTheDocument();
    // Music libraries are out of scope for v1 and stay hidden.
    expect(within(libraries).queryByText('Musik')).not.toBeInTheDocument();
  });

  it('asks for the password of protected profiles and explains wrong input', async () => {
    const { user } = await renderApp();
    await user.click(await screen.findByRole('button', { name: /Mika/ }));

    const username = await screen.findByLabelText('Benutzername');
    expect(username).toHaveValue('Mika');
    const password = screen.getByLabelText('Passwort');
    await user.type(password, 'falsch');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText('Benutzername oder Passwort ist falsch.')).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, 'demo{Enter}');
    expect(await findSignedIn('Mika')).toBeInTheDocument();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('"demo"');
  });

  it('lets the user pick a server when none is pinned', async () => {
    const { user } = await renderApp(DEFAULT_APP_CONFIG);
    const address = await screen.findByLabelText('Server-Adresse');
    await user.type(address, `${TEST_SERVER_URL}:8096`);
    await user.click(screen.getByRole('button', { name: 'Verbinden' }));

    expect(await screen.findByRole('heading', { name: 'Profil auswählen' })).toBeInTheDocument();
    expect(screen.getByText(DEMO_SERVER.ServerName)).toBeInTheDocument();
  });

  it('remembers profiles so the next sign-in needs no password', async () => {
    const { user } = await renderApp();
    await user.click(await screen.findByRole('button', { name: /Kim/ }));
    await user.type(await screen.findByLabelText('Passwort'), 'demo{Enter}');
    await findSignedIn('Kim');

    await user.click(screen.getByRole('button', { name: /Benutzermenü/ }));
    await user.click(screen.getByRole('button', { name: 'Profil wechseln' }));
    await user.click(await screen.findByRole('button', { name: 'Kim' }));

    expect(await findSignedIn('Kim')).toBeInTheDocument();
  });

  it('ends the session on the server when signing out', async () => {
    const { user } = await renderApp();
    await user.click(await screen.findByRole('button', { name: /Alex/ }));
    await findSignedIn('Alex');
    const token = useSessionStore.getState().api?.accessToken ?? null;
    expect(mockState.userForToken(token)?.name).toBe('Alex');

    await user.click(screen.getByRole('button', { name: /Benutzermenü/ }));
    await user.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByRole('heading', { name: 'Profil auswählen' })).toBeInTheDocument();
    expect(mockState.userForToken(token)).toBeNull();
    expect(useSessionStore.getState().sessions).toEqual([]);
  });
});

describe('expired sessions', () => {
  it('returns to sign-in with a notice when the server rejects the token', async () => {
    const alex = DEMO_USERS[0];
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
    });
    useSessionStore.getState().signIn({
      serverId: DEMO_SERVER.Id,
      userId: alex?.id ?? '',
      userName: 'Alex',
      accessToken: 'revoked-token',
      imageTag: null,
      remembered: true,
      signedInAt: 1,
    });

    await renderApp();
    expect(
      await screen.findByText('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Profil auswählen' })).toBeInTheDocument();
  });
});
