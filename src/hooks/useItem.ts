import { useQuery } from '@tanstack/react-query';
import { fetchEpisodes, fetchItem, fetchNextUp, fetchSeasons, fetchSimilar } from '@/api/items';
import type { ItemDetail, MediaItem, QueryResult, Season } from '@/domain/types';
import { queryKeys } from './query-keys';
import { toQueryResult } from './query-result';
import { useActiveSession } from './useSession';

export function useItemDetail(itemId: string): QueryResult<ItemDetail> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.item(key, itemId),
      queryFn: ({ signal }) => fetchItem(api, itemId, signal),
      staleTime: 60_000,
    }),
  );
}

export function useSimilarItems(itemId: string, enabled = true): QueryResult<MediaItem[]> {
  const { api, key } = useActiveSession();
  return toQueryResult(
    useQuery({
      queryKey: queryKeys.similar(key, itemId),
      queryFn: ({ signal }) => fetchSimilar(api, itemId, signal),
      staleTime: 10 * 60_000,
      enabled,
    }),
  );
}

export interface SeriesModel {
  seasons: QueryResult<Season[]>;
  selectedSeasonId: string | null;
  episodes: QueryResult<MediaItem[]>;
  nextUp: QueryResult<MediaItem | null>;
}

/**
 * Seasons, episodes of the chosen season and the next episode to watch. Without an explicit
 * choice the season of the next episode is shown, otherwise the first one.
 */
export function useSeries(seriesId: string, requestedSeasonId: string | null): SeriesModel {
  const { api, key } = useActiveSession();
  const seasons = useQuery({
    queryKey: queryKeys.seasons(key, seriesId),
    queryFn: ({ signal }) => fetchSeasons(api, seriesId, signal),
    staleTime: 60_000,
  });
  const nextUp = useQuery({
    queryKey: queryKeys.nextUp(key, seriesId),
    queryFn: async ({ signal }) =>
      (await fetchNextUp(api, { seriesId, limit: 1, includeResumable: true }, signal))[0] ?? null,
  });

  const seasonIds = seasons.data?.map((season) => season.id) ?? [];
  const nextUpSeason = nextUp.data?.episode?.seasonId ?? null;
  let selectedSeasonId: string | null = null;
  if (requestedSeasonId && seasonIds.includes(requestedSeasonId))
    selectedSeasonId = requestedSeasonId;
  else if (nextUpSeason && seasonIds.includes(nextUpSeason)) selectedSeasonId = nextUpSeason;
  else selectedSeasonId = seasonIds[0] ?? null;

  const episodes = useQuery({
    queryKey: queryKeys.episodes(key, seriesId, selectedSeasonId ?? ''),
    queryFn: ({ signal }) => fetchEpisodes(api, seriesId, selectedSeasonId ?? '', signal),
    enabled: selectedSeasonId !== null && !nextUp.isPending,
    staleTime: 60_000,
  });

  const seasonsResult = toQueryResult(seasons);
  return {
    seasons: seasonsResult,
    selectedSeasonId,
    episodes:
      seasonsResult.status === 'success' && seasonIds.length === 0
        ? { status: 'success', data: [], isRefreshing: false }
        : seasonsResult.status === 'error'
          ? seasonsResult
          : toQueryResult(episodes),
    nextUp: toQueryResult(nextUp),
  };
}
