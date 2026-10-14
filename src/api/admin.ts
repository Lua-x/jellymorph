import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { RemoteSearchResult } from '@jellyfin/sdk/lib/generated-client/models/remote-search-result';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getItemLookupApi } from '@jellyfin/sdk/lib/utils/api/item-lookup-api';
import { getItemUpdateApi } from '@jellyfin/sdk/lib/utils/api/item-update-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getRemoteImageApi } from '@jellyfin/sdk/lib/utils/api/remote-image-api';
import { getSubtitleApi } from '@jellyfin/sdk/lib/utils/api/subtitle-api';
import type {
  EditableImageType,
  ExternalIdField,
  IdentifyQuery,
  ItemImageEntry,
  MetadataDraft,
  MetadataEditorData,
  RemoteImageList,
  RemoteSubtitle,
} from '@/domain/types';
import { itemImageUrl } from './urls';

/**
 * Administration of single items (phase 13). Every call needs an administrator; the server
 * answers 403 otherwise. Checked against SDK 1.0.0 and, where the SDK types differ from the
 * server, against Jellyfin's controllers (see the notes at the calls).
 */

const EDITABLE_IMAGES: readonly EditableImageType[] = [
  'Primary',
  'Backdrop',
  'Logo',
  'Thumb',
  'Banner',
  'Art',
];

function dateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function isoDate(value: string | null): string | null {
  return value ? `${value}T00:00:00.0000000Z` : null;
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function providerIds(dto: BaseItemDto): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dto.ProviderIds ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );
}

export function toMetadataDraft(dto: BaseItemDto): MetadataDraft {
  return {
    name: dto.Name ?? '',
    originalTitle: dto.OriginalTitle ?? '',
    sortName: dto.ForcedSortName ?? '',
    overview: dto.Overview ?? '',
    tagline: dto.Taglines?.[0] ?? '',
    genres: dto.Genres ?? [],
    tags: dto.Tags ?? [],
    studios: (dto.Studios ?? []).map((studio) => studio.Name ?? '').filter(Boolean),
    year: dto.ProductionYear ?? null,
    premiereDate: dateOnly(dto.PremiereDate),
    endDate: dateOnly(dto.EndDate),
    officialRating: dto.OfficialRating ?? '',
    communityRating: dto.CommunityRating ?? null,
    criticRating: dto.CriticRating ?? null,
    providerIds: providerIds(dto),
    locked: dto.LockData === true,
  };
}

/**
 * The item as sent back to the server. Jellyfin's UpdateItem clears every scalar field the
 * request leaves out (title, description, dates, ratings), so the editor sends the item as it was
 * loaded with only the edited fields replaced, like jellyfin-web does.
 */
export function applyMetadataDraft(dto: BaseItemDto, draft: MetadataDraft): BaseItemDto {
  return {
    ...dto,
    Name: draft.name.trim(),
    OriginalTitle: text(draft.originalTitle),
    ForcedSortName: text(draft.sortName),
    Overview: text(draft.overview),
    Taglines: text(draft.tagline) === null ? [] : [draft.tagline.trim()],
    Genres: draft.genres,
    Tags: draft.tags,
    Studios: draft.studios.map((name) => ({ Name: name })),
    ProductionYear: draft.year,
    PremiereDate: isoDate(draft.premiereDate),
    EndDate: isoDate(draft.endDate),
    OfficialRating: text(draft.officialRating),
    CommunityRating: draft.communityRating,
    CriticRating: draft.criticRating,
    ProviderIds: draft.providerIds,
    LockData: draft.locked,
  };
}

/** The raw item (kept for saving) plus everything the editor shows. */
export async function fetchMetadataEditor(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<{ dto: BaseItemDto; editor: MetadataEditorData }> {
  const [item, info] = await Promise.all([
    getLibraryApi(api).getItem({ itemId }, { signal }),
    getItemUpdateApi(api).getMetadataEditorInfo({ itemId }, { signal }),
  ]);
  const ratings = [
    ...new Set(
      (info.data.ParentalRatingOptions ?? [])
        .map((rating) => rating.Name ?? '')
        .filter((name) => name !== ''),
    ),
  ];
  return {
    dto: item.data,
    editor: {
      draft: toMetadataDraft(item.data),
      ratings,
      externalIds: toExternalIds(info.data.ExternalIdInfos),
    },
  };
}

export async function saveMetadata(api: Api, dto: BaseItemDto, draft: MetadataDraft) {
  await getItemUpdateApi(api).updateItem({
    itemId: dto.Id ?? '',
    baseItemDto: applyMetadataDraft(dto, draft),
  });
}

function toExternalIds(
  infos: { Key?: string; Name?: string; Type?: string | null }[] | null | undefined,
) {
  const seen = new Set<string>();
  const fields: ExternalIdField[] = [];
  for (const info of infos ?? []) {
    if (!info.Key || seen.has(info.Key)) continue;
    seen.add(info.Key);
    fields.push({ key: info.Key, name: info.Name ?? info.Key, mediaType: info.Type ?? null });
  }
  return fields;
}

export async function fetchExternalIds(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<ExternalIdField[]> {
  const { data } = await getItemLookupApi(api).getExternalIdInfos({ itemId }, { signal });
  return toExternalIds(data);
}

/** Search the metadata providers for a movie or a series. */
export async function searchIdentity(
  api: Api,
  kind: 'movie' | 'series',
  itemId: string,
  query: IdentifyQuery,
): Promise<RemoteSearchResult[]> {
  const searchInfo = {
    Name: query.name.trim() || null,
    Year: query.year,
    ProviderIds: query.providerIds,
  };
  const lookup = getItemLookupApi(api);
  const { data } =
    kind === 'movie'
      ? await lookup.getMovieRemoteSearchResults({
          movieInfoRemoteSearchQuery: { ItemId: itemId, SearchInfo: searchInfo },
        })
      : await lookup.getSeriesRemoteSearchResults({
          seriesInfoRemoteSearchQuery: { ItemId: itemId, SearchInfo: searchInfo },
        });
  return data;
}

export async function applyIdentity(
  api: Api,
  itemId: string,
  result: RemoteSearchResult,
  replaceAllImages: boolean,
) {
  await getItemLookupApi(api).applySearchCriteria({
    itemId,
    remoteSearchResult: result,
    replaceAllImages,
  });
}

/** Deletes the item and its files on the server. */
export async function deleteItem(api: Api, itemId: string) {
  await getLibraryApi(api).deleteItem({ itemId });
}

export async function fetchItemImages(
  api: Api,
  itemId: string,
  signal?: AbortSignal,
): Promise<ItemImageEntry[]> {
  const { data } = await getImageApi(api).getItemImageInfos({ itemId }, { signal });
  return data
    .filter(
      (info): info is typeof info & { ImageType: EditableImageType } =>
        info.ImageType !== undefined &&
        (EDITABLE_IMAGES as readonly string[]).includes(info.ImageType),
    )
    .map((info) => ({
      type: info.ImageType,
      index: info.ImageIndex ?? 0,
      url: itemImageUrl(
        api,
        itemId,
        info.ImageType,
        { tag: info.ImageTag ?? '', maxWidth: 480 },
        info.ImageIndex ?? undefined,
      ),
      width: info.Width ?? null,
      height: info.Height ?? null,
    }));
}

export async function fetchRemoteImages(
  api: Api,
  itemId: string,
  type: EditableImageType,
  provider: string | null,
  signal?: AbortSignal,
): Promise<RemoteImageList> {
  const { data } = await getRemoteImageApi(api).getRemoteImages(
    {
      itemId,
      type: type,
      providerName: provider ?? undefined,
      includeAllLanguages: false,
      limit: 60,
    },
    { signal },
  );
  return {
    images: (data.Images ?? [])
      .filter((image): image is typeof image & { Url: string } => Boolean(image.Url))
      .map((image) => ({
        url: image.Url,
        thumbnailUrl: image.ThumbnailUrl ?? image.Url,
        provider: image.ProviderName ?? null,
        width: image.Width ?? null,
        height: image.Height ?? null,
        language: image.Language ?? null,
        rating: image.CommunityRating ?? null,
      })),
    providers: data.Providers ?? [],
  };
}

export async function downloadRemoteImage(
  api: Api,
  itemId: string,
  type: EditableImageType,
  imageUrl: string,
) {
  await getRemoteImageApi(api).downloadRemoteImage({ itemId, type: type, imageUrl });
}

function fileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read the file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a picture from the device. Jellyfin's ImageController.SetItemImage reads the body as
 * Base64 text with an image content type; the SDK types it as a binary File, so this one call
 * goes through the SDK's axios instance by hand (like DELETE /Videos/ActiveEncodings).
 */
export async function uploadItemImage(
  api: Api,
  itemId: string,
  type: EditableImageType,
  file: File,
) {
  const body = await fileAsBase64(file);
  await api.axiosInstance.post(
    api.getUri(`/Items/${encodeURIComponent(itemId)}/Images/${type}`),
    body,
    { headers: { Authorization: api.authorizationHeader, 'Content-Type': file.type } },
  );
}

export async function deleteItemImage(
  api: Api,
  itemId: string,
  type: EditableImageType,
  index: number,
) {
  await getImageApi(api).deleteItemImage({
    itemId,
    imageType: type,
    imageIndex: index,
  });
}

export async function searchSubtitles(
  api: Api,
  itemId: string,
  language: string,
  signal?: AbortSignal,
): Promise<RemoteSubtitle[]> {
  const { data } = await getSubtitleApi(api).searchRemoteSubtitles(
    { itemId, language },
    { signal },
  );
  return data
    .filter((subtitle): subtitle is typeof subtitle & { Id: string } => Boolean(subtitle.Id))
    .map((subtitle) => ({
      id: subtitle.Id,
      name: subtitle.Name ?? subtitle.Id,
      provider: subtitle.ProviderName ?? null,
      format: subtitle.Format ?? null,
      downloads: subtitle.DownloadCount ?? null,
      rating: subtitle.CommunityRating ?? null,
      hashMatch: subtitle.IsHashMatch === true,
      forced: subtitle.Forced === true,
      hearingImpaired: subtitle.HearingImpaired === true,
    }));
}

export async function downloadSubtitle(api: Api, itemId: string, subtitleId: string) {
  await getSubtitleApi(api).downloadRemoteSubtitles({ itemId, subtitleId });
}

/** Uploads a subtitle file; the server stores it next to the video. */
export async function uploadSubtitle(
  api: Api,
  itemId: string,
  file: File,
  options: { language: string; forced: boolean; hearingImpaired: boolean },
) {
  const format = file.name.split('.').pop()?.toLowerCase() ?? 'srt';
  await getSubtitleApi(api).uploadSubtitle({
    itemId,
    uploadSubtitleDto: {
      Language: options.language,
      Format: format,
      IsForced: options.forced,
      IsHearingImpaired: options.hearingImpaired,
      Data: await fileAsBase64(file),
    },
  });
}

export async function deleteSubtitle(api: Api, itemId: string, index: number) {
  await getSubtitleApi(api).deleteSubtitle({ itemId, index });
}
