import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/api/session-store';
import { DEFAULT_APP_CONFIG, type AppConfig } from '@/config/app-config';
import { initI18n } from '@/i18n';
import { collections, LIBRARY, movies, series } from '@/mocks/catalog';
import { DEMO_SERVER, DEMO_USERS } from '@/mocks/fixtures';
import { mockState, TEST_SERVER_URL } from '@/mocks/node';
import { loadDefaultTheme, loadThemeModule } from '@/themes/loader';
import { getThemeManifest } from '@/themes/registry';
import { App } from './App';

const config: AppConfig = { ...DEFAULT_APP_CONFIG, jellyfinUrl: TEST_SERVER_URL, lockServer: true };
const alex = DEMO_USERS[0];
const TIMEOUT = { timeout: 4000 };

function byName<T extends { name: string }>(list: readonly T[], name: string): T {
  const found = list.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing demo item ${name}`);
  return found;
}

/** Signs Alex in directly and opens `path`. */
async function openAs(path: string) {
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

beforeAll(async () => {
  await initI18n('de');
  await Promise.all([loadDefaultTheme(), loadThemeModule(getThemeManifest('default'))]);
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('home', () => {
  it('shows the hero and the rows that have content', async () => {
    await openAs('/');
    expect(await screen.findByRole('region', { name: 'Empfohlen' }, TIMEOUT)).toBeInTheDocument();
    const resume = await screen.findByRole('region', { name: 'Weiterschauen' }, TIMEOUT);
    expect(within(resume).getAllByRole('link').length).toBeGreaterThan(0);
    expect(
      await screen.findByRole('region', { name: 'Neu in Filme' }, TIMEOUT),
    ).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Sammlungen' }, TIMEOUT)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Komödie' }, TIMEOUT)).toBeInTheDocument();
  });
});

describe('library', () => {
  it('lists, sorts and filters a library', async () => {
    const user = await openAs(`/library/${LIBRARY.movies}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Filme' }, TIMEOUT),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(`${String(movies.length)} Titel`, undefined, TIMEOUT),
    ).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Titel in Filme' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Sortieren nach'), 'year');
    expect(window.location.search).toContain('sort=year');

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.click(
      await screen.findByRole('button', { name: 'Komödie', pressed: false }, TIMEOUT),
    );
    const comedies = movies.filter((movie) => movie.genres.includes('Komödie')).length;
    expect(
      await screen.findByText(`${String(comedies)} Titel`, undefined, TIMEOUT),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter „Komödie“ entfernen' })).toBeInTheDocument();
  });

  it('shows the members of a collection', async () => {
    const collection = byName(collections, 'Nebelstadt – Die Sammlung');
    await openAs(`/collection/${collection.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: collection.name }, TIMEOUT),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 Titel', undefined, TIMEOUT)).toBeInTheDocument();
  });
});

describe('details', () => {
  it('shows a movie and saves the favorite state on the server', async () => {
    const movie = byName(movies, 'Nebelstadt');
    const user = await openAs(`/item/${movie.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nebelstadt' }, TIMEOUT),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deutsch - E-AC3 5\.1/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Besetzung' })).toBeInTheDocument();

    const wasFavorite = mockState.library.get(alex?.id ?? '', movie.id).favorite;
    const button = screen.getByRole('button', {
      pressed: wasFavorite,
      name: wasFavorite ? 'Aus Favoriten entfernen' : 'Favorit',
    });
    await user.click(button);
    expect(
      await screen.findByRole('button', {
        pressed: !wasFavorite,
        name: wasFavorite ? 'Favorit' : 'Aus Favoriten entfernen',
      }),
    ).toBeInTheDocument();
    await waitUntil(
      () => mockState.library.get(alex?.id ?? '', movie.id).favorite === !wasFavorite,
    );
  });

  it('shows seasons, the next episode and lets the user mark episodes', async () => {
    const show = byName(series, 'Hafenviertel');
    const user = await openAs(`/item/${show.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hafenviertel' }, TIMEOUT),
    ).toBeInTheDocument();
    // Season 2 is open because its fourth episode is the next one to watch.
    expect(
      await screen.findByRole('tab', { name: 'Staffel 2', selected: true }, TIMEOUT),
    ).toBeInTheDocument();
    // Once in the header link, once as badge on the episode in the list.
    await waitFor(() => {
      expect(screen.getAllByText('Als Nächstes')).toHaveLength(2);
    }, TIMEOUT);
    const nextEpisode = screen.getAllByText('Als Nächstes')[1]?.closest('li');
    expect(nextEpisode).toHaveTextContent(/^4./);

    await user.click(screen.getByRole('tab', { name: 'Staffel 3' }));
    expect(
      await screen.findByRole('tab', { name: 'Staffel 3', selected: true }),
    ).toBeInTheDocument();
    const toggle = (
      await screen.findAllByRole('button', { name: /als gesehen markieren/ }, TIMEOUT)
    )[0];
    if (!toggle) throw new Error('No episode toggle');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('search and favorites', () => {
  it('finds titles while typing', async () => {
    const user = await openAs('/search');
    await user.type(await screen.findByRole('searchbox', {}, TIMEOUT), 'nebel');
    const moviesGroup = await screen.findByRole('region', { name: /^Filme/ }, TIMEOUT);
    expect(within(moviesGroup).getByRole('link', { name: /Nebelstadt 2/ })).toBeInTheDocument();
    expect(window.location.search).toBe('?q=nebel');
  });

  it('lists the favorites by type', async () => {
    await openAs('/favorites');
    const shows = await screen.findByRole('region', { name: /^Serien/ }, TIMEOUT);
    expect(within(shows).getByRole('link', { name: /Hafenviertel/ })).toBeInTheDocument();
  });
});

/** Polls a condition about server state that changes after an async request. */
async function waitUntil(condition: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
