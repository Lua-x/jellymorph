import { screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collections, LIBRARY, movies, series } from '@/mocks/catalog';
import { mockState } from '@/mocks/node';
import { alex, byName, openAs, prepareApp, TIMEOUT } from '@/test/app';

beforeAll(prepareApp);

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
    const audio = movie.streams.find((stream) => stream.type === 'Audio')?.title ?? '';
    expect(screen.getByText(audio, { exact: false })).toBeInTheDocument();
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
    // The started fourth episode: "Resume" in the header, a badge in the episode list.
    expect(
      await screen.findByRole('button', { name: /^Fortsetzen S2 · F4/ }, TIMEOUT),
    ).toBeInTheDocument();
    const nextEpisode = (await screen.findByText('Als Nächstes', undefined, TIMEOUT)).closest('li');
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
