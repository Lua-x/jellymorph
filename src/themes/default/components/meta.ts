import type { TFunction } from 'i18next';
import type { MediaItem } from '@/domain/types';

/** "1 Std. 52 Min." / "45 Min." */
export function runtimeText(t: TFunction<'content'>, minutes: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0
    ? t('meta.hoursMinutes', { hours, minutes: rest })
    : t('meta.minutes', { count: rest });
}

/** "S2 · F5" (German) / "S2 · E5" (English); also handles double episodes. */
export function episodeCode(t: TFunction<'content'>, item: MediaItem): string | null {
  const episode = item.episode;
  if (episode?.seasonNumber == null || episode.episodeNumber === null) return null;
  const number =
    episode.episodeNumberEnd && episode.episodeNumberEnd !== episode.episodeNumber
      ? `${String(episode.episodeNumber)}–${String(episode.episodeNumberEnd)}`
      : String(episode.episodeNumber);
  return t('meta.episodeCode', { season: episode.seasonNumber, episode: number });
}

/** "2015", "2015–2019" or "seit 2015" for running series. */
export function yearText(t: TFunction<'content'>, item: MediaItem): string | null {
  if (item.year === null) return null;
  if (item.kind !== 'series') return String(item.year);
  if (item.endYear !== null && item.endYear !== item.year) {
    return t('meta.yearRange', { from: item.year, to: item.endYear });
  }
  return item.endYear === null ? t('meta.since', { year: item.year }) : String(item.year);
}

export function ratingText(language: string, rating: number | null): string | null {
  if (rating === null) return null;
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

/** Second line under a card title. */
export function cardSubtitle(t: TFunction<'content'>, item: MediaItem): string | null {
  switch (item.kind) {
    case 'episode':
      return [episodeCode(t, item), item.name].filter(Boolean).join(' · ') || null;
    case 'series':
      return yearText(t, item);
    case 'collection':
      return item.childCount !== null ? t('meta.titles', { count: item.childCount }) : null;
    case 'person':
      return null;
    default:
      return yearText(t, item);
  }
}

/** Card title: episodes show their series, everything else its own name. */
export function cardTitle(item: MediaItem): string {
  return item.kind === 'episode' && item.episode ? item.episode.seriesName : item.name;
}
