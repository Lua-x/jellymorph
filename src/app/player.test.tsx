import { act, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodes, movies, type MockItem } from '@/mocks/catalog';
import type * as Capabilities from '@/player/capabilities';
import { mockState } from '@/mocks/node';
import { CHROME } from '@/test/capabilities';
import { alex, openAs, prepareApp, TIMEOUT } from '@/test/app';

// jsdom cannot decode video: the engine only sets the start position, the capabilities are
// those of a desktop Chrome.
vi.mock('@/player/engines', () => ({
  createEngine: (kind: string, { video }: { video: HTMLVideoElement }) =>
    Promise.resolve({
      kind,
      load: (_url: string, start: number) => {
        video.currentTime = start;
        return Promise.resolve();
      },
      destroy: () => {
        video.load();
      },
    }),
}));
vi.mock('@/player/capabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof Capabilities>()),
  getCapabilities: () => Promise.resolve(CHROME),
}));

beforeAll(prepareApp);

beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
  }
});

function unwatched(list: readonly MockItem[]): MockItem {
  const item = list.find((candidate) => {
    const data = mockState.library.get(alex?.id ?? '', candidate.id);
    return data.positionTicks === 0 && !data.played;
  });
  if (!item) throw new Error('No unwatched demo title');
  return item;
}

function started(list: readonly MockItem[]): MockItem {
  const item = list.find((candidate) => {
    const data = mockState.library.get(alex?.id ?? '', candidate.id);
    return data.positionTicks > 0 && !data.played;
  });
  if (!item) throw new Error('No started demo title');
  return item;
}

describe('player', () => {
  it('plays a movie from its detail page and goes back on Escape', async () => {
    const movie = unwatched(movies);
    const user = await openAs(`/item/${movie.id}`);
    await user.click(await screen.findByRole('button', { name: 'Abspielen' }, TIMEOUT));

    expect(await screen.findByRole('group', { name: 'Videoplayer' }, TIMEOUT)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pause' }, TIMEOUT)).toBeInTheDocument();
    expect(screen.getByText(movie.name)).toBeInTheDocument();
    expect(window.location.search).toBe('?start=0');
    await waitFor(() => {
      expect(mockState.reports.some((report) => report.kind === 'start')).toBe(true);
    }, TIMEOUT);

    await user.keyboard('{Escape}');
    expect(
      await screen.findByRole('heading', { level: 1, name: movie.name }, TIMEOUT),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockState.reports.at(-1)?.kind).toBe('stopped');
    }, TIMEOUT);
  });

  it('asks whether to resume a started movie', async () => {
    const movie = started(movies);
    const user = await openAs(`/play/${movie.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: movie.name }, TIMEOUT),
    ).toBeInTheDocument();
    expect(screen.getByText('Weiterschauen?')).toBeInTheDocument();
    const resume = screen.getByRole('button', { name: /^Fortsetzen ab / });
    expect(resume).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Von vorne' }));
    expect(await screen.findByRole('group', { name: 'Videoplayer' }, TIMEOUT)).toBeInTheDocument();
    expect(window.location.search).toBe('?start=0');
  });

  it('resumes from the detail page at the saved position', async () => {
    const movie = started(movies);
    const seconds = Math.floor(mockState.library.get(alex?.id ?? '', movie.id).positionTicks / 1e7);
    const user = await openAs(`/item/${movie.id}`);
    await user.click(await screen.findByRole('button', { name: /^Fortsetzen ab / }, TIMEOUT));
    await screen.findByRole('group', { name: 'Videoplayer' }, TIMEOUT);
    expect(window.location.search).toBe(`?start=${String(seconds)}`);
  });

  it('plays an episode from the episode list', async () => {
    const episode = episodes.find((candidate) => candidate.seriesId && candidate.indexNumber === 1);
    if (!episode?.seriesId || !episode.seasonId) throw new Error('No first episode');
    const user = await openAs(`/item/${episode.seriesId}?season=${episode.seasonId}`);
    await user.click(
      await screen.findByRole('button', { name: `„${episode.name}“ abspielen` }, TIMEOUT),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe(`/play/${episode.id}`);
    }, TIMEOUT);
  });

  it('plays the local trailer of a movie', async () => {
    const movie = movies.find((candidate) => candidate.localTrailerCount > 0);
    if (!movie) throw new Error('No demo title with a trailer');
    const user = await openAs(`/item/${movie.id}`);
    await user.click(await screen.findByRole('button', { name: 'Trailer' }, TIMEOUT));
    expect(
      await screen.findByText(`${movie.name} – Trailer`, undefined, TIMEOUT),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/play/t${movie.id.slice(1)}`);
  });

  it('opens the track menu and switches subtitles on', async () => {
    const movie = unwatched(movies);
    const user = await openAs(`/play/${movie.id}?start=0`);
    await user.click(await screen.findByRole('button', { name: 'Audio und Untertitel' }, TIMEOUT));
    const dialog = await screen.findByRole('dialog', { name: 'Audio und Untertitel' });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Deutsch - SRT/ }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Deutsch - SRT/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });
    await waitFor(() => {
      expect(document.querySelector('video track')).not.toBeNull();
    }, TIMEOUT);
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Escape closed only the menu, not the player.
    expect(screen.getByRole('group', { name: 'Videoplayer' })).toBeInTheDocument();
  });
});
