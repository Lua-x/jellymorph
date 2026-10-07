/**
 * Pure mappers from Jellyfin DTOs to domain types. Image URLs come from a factory so the
 * mappers stay independent of the API instance (and easy to test).
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import type {
  CastMember,
  Genre,
  ImageRef,
  ItemDetail,
  ItemKind,
  MediaItem,
  MediaTrack,
  PersonRole,
  Season,
  UserItemData,
} from './types';

export type ImageType = 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' | 'Banner';
export type ImageUrlFactory = (
  itemId: string,
  type: ImageType,
  tag: string,
  index?: number,
) => string;

const TICKS_PER_MINUTE = 600_000_000;
const WIDESCREEN = 16 / 9;

const KINDS: Partial<Record<string, ItemKind>> = {
  Movie: 'movie',
  Series: 'series',
  Season: 'season',
  Episode: 'episode',
  BoxSet: 'collection',
  Video: 'video',
  MusicVideo: 'video',
  Trailer: 'video',
  Folder: 'folder',
  CollectionFolder: 'folder',
  Person: 'person',
};

export function itemKind(type: string | null | undefined): ItemKind {
  if (!type) return 'other';
  return KINDS[type] ?? 'other';
}

function blurHash(dto: BaseItemDto, type: ImageType, tag: string): string | null {
  const hashes = dto.ImageBlurHashes?.[type] as Record<string, string> | undefined;
  return hashes?.[tag] ?? null;
}

function image(
  urls: ImageUrlFactory,
  dto: BaseItemDto,
  ownerId: string | null | undefined,
  type: ImageType,
  tag: string | null | undefined,
  aspectRatio: number | null,
  index?: number,
): ImageRef | null {
  if (!ownerId || !tag) return null;
  return { url: urls(ownerId, type, tag, index), blurHash: blurHash(dto, type, tag), aspectRatio };
}

function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = new Date(date).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

function userData(dto: BaseItemDto): UserItemData {
  const data = dto.UserData;
  const position = data?.PlaybackPositionTicks ?? 0;
  const played = data?.Played ?? false;
  const percentage = data?.PlayedPercentage ?? null;
  return {
    played,
    favorite: data?.IsFavorite ?? false,
    progress: !played && position > 0 && percentage !== null ? Math.min(1, percentage / 100) : null,
    positionTicks: position,
    unplayedCount: data?.UnplayedItemCount ?? null,
  };
}

export function toMediaItem(dto: BaseItemDto, urls: ImageUrlFactory): MediaItem {
  const id = dto.Id ?? '';
  const kind = itemKind(dto.Type);
  const tags = dto.ImageTags ?? {};
  const backdropTag = dto.BackdropImageTags?.[0];
  const parentBackdropTag = dto.ParentBackdropImageTags?.[0];

  const backdrop =
    image(urls, dto, id, 'Backdrop', backdropTag, WIDESCREEN, 0) ??
    image(urls, dto, dto.ParentBackdropItemId, 'Backdrop', parentBackdropTag, WIDESCREEN, 0);
  const thumb =
    image(urls, dto, id, 'Thumb', tags.Thumb, WIDESCREEN) ??
    image(urls, dto, dto.ParentThumbItemId, 'Thumb', dto.ParentThumbImageTag, WIDESCREEN) ??
    image(urls, dto, dto.SeriesId, 'Thumb', dto.SeriesThumbImageTag, WIDESCREEN);

  return {
    id,
    kind,
    name: dto.Name ?? '',
    year: dto.ProductionYear ?? yearOf(dto.PremiereDate),
    endYear: dto.Status === 'Ended' ? yearOf(dto.EndDate) : null,
    runtimeMinutes: dto.RunTimeTicks ? Math.round(dto.RunTimeTicks / TICKS_PER_MINUTE) : null,
    officialRating: dto.OfficialRating ?? null,
    communityRating: dto.CommunityRating ?? null,
    criticRating: dto.CriticRating ?? null,
    genres: dto.Genres ?? [],
    overview: dto.Overview ?? null,
    tagline: dto.Taglines?.[0] ?? null,
    premiereDate: dto.PremiereDate ?? null,
    images: {
      primary: image(
        urls,
        dto,
        id,
        'Primary',
        tags.Primary,
        dto.PrimaryImageAspectRatio ?? (kind === 'episode' ? WIDESCREEN : null),
      ),
      backdrop,
      thumb,
      logo:
        image(urls, dto, id, 'Logo', tags.Logo, null) ??
        image(urls, dto, dto.ParentLogoItemId, 'Logo', dto.ParentLogoImageTag, null),
    },
    userData: userData(dto),
    episode:
      kind === 'episode' && dto.SeriesId
        ? {
            seriesId: dto.SeriesId,
            seriesName: dto.SeriesName ?? '',
            seasonId: dto.SeasonId ?? null,
            seasonNumber: dto.ParentIndexNumber ?? null,
            episodeNumber: dto.IndexNumber ?? null,
            episodeNumberEnd: dto.IndexNumberEnd ?? null,
          }
        : null,
    childCount: dto.ChildCount ?? null,
  };
}

const ROLES: Partial<Record<string, PersonRole>> = {
  Actor: 'actor',
  GuestStar: 'actor',
  Director: 'director',
  Writer: 'writer',
  Producer: 'producer',
};

function toCastMember(person: BaseItemPerson, urls: ImageUrlFactory): CastMember | null {
  if (!person.Id || !person.Name) return null;
  const tag = person.PrimaryImageTag;
  const hashes = person.ImageBlurHashes?.Primary as Record<string, string> | undefined;
  return {
    id: person.Id,
    name: person.Name,
    role: person.Role ?? null,
    kind: (person.Type && ROLES[person.Type]) ?? 'other',
    image: tag
      ? {
          url: urls(person.Id, 'Primary', tag),
          blurHash: hashes?.[tag] ?? null,
          aspectRatio: 2 / 3,
        }
      : null,
  };
}

function toTrack(stream: MediaStream): MediaTrack {
  return {
    index: stream.Index ?? 0,
    title: stream.DisplayTitle ?? stream.Language ?? stream.Codec ?? '',
    language: stream.Language ?? null,
    codec: stream.Codec ?? null,
    isDefault: stream.IsDefault ?? false,
    isForced: stream.IsForced ?? false,
  };
}

function videoLabel(streams: MediaStream[]): string | null {
  const video = streams.find((stream) => stream.Type === 'Video');
  if (!video) return null;
  const width = video.Width ?? 0;
  const resolution = width >= 3800 ? '4K' : width >= 1900 ? '1080p' : width >= 1260 ? '720p' : null;
  const range = video.VideoRangeType && video.VideoRangeType !== 'SDR' ? 'HDR' : null;
  const parts = [resolution, range].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function toItemDetail(dto: BaseItemDto, urls: ImageUrlFactory): ItemDetail {
  const base = toMediaItem(dto, urls);
  const streams = dto.MediaStreams ?? dto.MediaSources?.[0]?.MediaStreams ?? [];
  const backdrops = (dto.BackdropImageTags ?? [])
    .map((tag, index) => image(urls, dto, dto.Id, 'Backdrop', tag, WIDESCREEN, index))
    .filter((ref): ref is ImageRef => ref !== null);
  return {
    ...base,
    backdrops:
      backdrops.length > 0 ? backdrops : base.images.backdrop ? [base.images.backdrop] : [],
    cast: (dto.People ?? [])
      .map((person) => toCastMember(person, urls))
      .filter((member): member is CastMember => member !== null),
    studios: (dto.Studios ?? []).map((studio) => studio.Name ?? '').filter(Boolean),
    audioTracks: streams.filter((stream) => stream.Type === 'Audio').map(toTrack),
    subtitleTracks: streams.filter((stream) => stream.Type === 'Subtitle').map(toTrack),
    videoLabel: videoLabel(streams),
    localTrailerCount: dto.LocalTrailerCount ?? 0,
    seriesStatus:
      dto.Status === 'Continuing' ? 'continuing' : dto.Status === 'Ended' ? 'ended' : null,
  };
}

export function toSeason(dto: BaseItemDto, urls: ImageUrlFactory): Season {
  return {
    id: dto.Id ?? '',
    name: dto.Name ?? '',
    number: dto.IndexNumber ?? null,
    image: image(
      urls,
      dto,
      dto.Id,
      'Primary',
      dto.ImageTags?.Primary,
      dto.PrimaryImageAspectRatio ?? null,
    ),
    episodeCount: dto.ChildCount ?? dto.RecursiveItemCount ?? null,
    unplayedCount: dto.UserData?.UnplayedItemCount ?? null,
    played: dto.UserData?.Played ?? false,
  };
}

export function toGenre(dto: BaseItemDto, urls: ImageUrlFactory): Genre {
  return {
    id: dto.Id ?? '',
    name: dto.Name ?? '',
    image:
      image(urls, dto, dto.Id, 'Thumb', dto.ImageTags?.Thumb, WIDESCREEN) ??
      image(
        urls,
        dto,
        dto.Id,
        'Primary',
        dto.ImageTags?.Primary,
        dto.PrimaryImageAspectRatio ?? null,
      ),
  };
}
