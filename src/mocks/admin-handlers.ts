import { http, HttpResponse } from 'msw';
import { artworkSvg, variantOf } from './artwork';
import {
  episodes,
  itemsById,
  removeFromCatalog,
  seasons,
  sortNameOf,
  trailers,
  type MockCustomImage,
  type MockImageType,
  type MockItem,
} from './catalog';
import { DEMO_VIEWS, type MockUser } from './fixtures';
import type { Authed } from './handlers';
import { svgResponseInit } from './images';
import { canDelete, imageTag, imageTypesOf } from './library';

/**
 * Administration endpoints of the demo server (phase 13): metadata, identify, pictures,
 * subtitles, refresh and delete. Changes live in memory until the page is reloaded, so the demo
 * always starts from the same catalog. Provider names, search results and pictures are invented.
 */

const noContent = () => new HttpResponse(null, { status: 204 });
const badRequest = () => new HttpResponse(null, { status: 400 });
const forbidden = () => new HttpResponse(null, { status: 403 });
const notFound = () => new HttpResponse(null, { status: 404 });

const ARTWORK_TYPES: readonly MockImageType[] = ['Primary', 'Backdrop', 'Thumb', 'Logo'];
const PROVIDERS = ['Demo-Archiv', 'Plakatwand'] as const;
const RATINGS = ['FSK-0', 'FSK-6', 'FSK-12', 'FSK-16', 'FSK-18'];
const SUBTITLE_FORMATS: readonly string[] = ['srt', 'vtt', 'ass', 'ssa'];
const LANGUAGE_NAMES: Record<string, string> = {
  ger: 'Deutsch',
  deu: 'Deutsch',
  eng: 'English',
  fre: 'Français',
  spa: 'Español',
  ita: 'Italiano',
  dut: 'Nederlands',
  jpn: '日本語',
};

const SIZES: Record<string, [number, number]> = {
  Primary: [1000, 1500],
  Backdrop: [1920, 1080],
  Thumb: [1280, 720],
  Logo: [800, 220],
  Banner: [1000, 185],
  Art: [1000, 562],
};

interface ItemUpdate {
  Name?: string | null;
  OriginalTitle?: string | null;
  ForcedSortName?: string | null;
  Overview?: string | null;
  Taglines?: string[] | null;
  Genres?: string[] | null;
  Tags?: string[] | null;
  Studios?: { Name?: string | null }[] | null;
  ProductionYear?: number | null;
  PremiereDate?: string | null;
  EndDate?: string | null;
  OfficialRating?: string | null;
  CommunityRating?: number | null;
  CriticRating?: number | null;
  ProviderIds?: Record<string, string | null> | null;
  LockData?: boolean | null;
}

interface SearchQuery {
  ItemId?: string;
  SearchInfo?: { Name?: string | null; Year?: number | null; ProviderIds?: Record<string, string> };
}

interface SearchResult {
  Name?: string | null;
  ProductionYear?: number | null;
  ProviderIds?: Record<string, string> | null;
  ImageUrl?: string | null;
}

interface SubtitleUpload {
  Language?: string;
  Format?: string;
  IsForced?: boolean;
  IsHearingImpaired?: boolean;
  Data?: string;
}

/** The part of a request URL before `/Items/` or `/Videos/`: the demo server's base address. */
function baseOf(request: Request): string {
  const match = /^(.*?)\/(?:Items|Videos)\//.exec(request.url);
  return match?.[1] ?? new URL(request.url).origin;
}

function remoteImageUrl(base: string, item: MockItem, type: string, variant: number): string {
  return `${base}/DemoRemoteImages/${item.id}/${type}/${String(variant)}`;
}

function variantFromUrl(url: string): number | null {
  const match = /\/DemoRemoteImages\/[^/]+\/[^/]+\/(\d+)$/.exec(url);
  return match?.[1] ? Number(match[1]) : null;
}

function setImage(item: MockItem, type: string, image: MockCustomImage) {
  item.customImages = { ...item.customImages, [type]: image };
  if (
    (ARTWORK_TYPES as readonly string[]).includes(type) &&
    !(item.images as string[]).includes(type)
  )
    item.images = [...item.images, type as MockImageType];
  item.imageVersion = (item.imageVersion ?? 0) + 1;
}

function removeImage(item: MockItem, type: string) {
  item.images = item.images.filter((entry) => entry !== type);
  if (item.customImages) {
    item.customImages = Object.fromEntries(
      Object.entries(item.customImages).filter(([key]) => key !== type),
    );
  }
  item.imageVersion = (item.imageVersion ?? 0) + 1;
}

function externalIds(item: MockItem) {
  const type = item.type === 'Series' ? 'Series' : item.type === 'Episode' ? 'Episode' : 'Movie';
  if (!['Movie', 'Series', 'Episode'].includes(item.type)) return [];
  return [
    { Name: 'Demo-Archiv', Key: 'DemoArchive', Type: type },
    ...(item.type === 'Episode' ? [] : [{ Name: 'Kinoregister', Key: 'DemoRegister', Type: type }]),
  ];
}

function isVideo(item: MockItem): boolean {
  return item.type === 'Movie' || item.type === 'Episode';
}

function subtitleTitle(language: string, format: string, forced: boolean): string {
  const name = LANGUAGE_NAMES[language] ?? language;
  return `${name}${forced ? ' (erzwungen)' : ''} - ${format.toUpperCase()} - extern`;
}

/** The item with everything that belongs to it: seasons and episodes of a series, trailers. */
function withDescendants(item: MockItem): Set<string> {
  const ids = new Set([item.id]);
  for (const season of seasons) if (season.seriesId === item.id) ids.add(season.id);
  for (const episode of episodes)
    if (episode.seriesId === item.id || episode.seasonId === item.id) ids.add(episode.id);
  for (const trailer of trailers) if (trailer.parentId === item.id) ids.add(trailer.id);
  return ids;
}

/** Pictures set through the admin endpoints, for the image route of the content handlers. */
export function customImageResponse(item: MockItem, type: string): Response | null {
  const custom = item.customImages?.[type];
  if (!custom) return null;
  if (custom.kind === 'variant') {
    if (!(ARTWORK_TYPES as readonly string[]).includes(type)) return null;
    return new HttpResponse(
      artworkSvg(variantOf(item, custom.variant), type as MockImageType),
      svgResponseInit(),
    );
  }
  const bytes = Uint8Array.from(atob(custom.data), (char) => char.charCodeAt(0));
  return new HttpResponse(bytes, {
    headers: { 'Content-Type': custom.contentType, 'Cache-Control': 'public, max-age=86400' },
  });
}

export function createAdminHandlers(authed: Authed) {
  /** Like `authed`, but only for administrators, and with the item looked up. */
  const admin = (
    resolver: (
      item: MockItem,
      request: Request,
      params: Record<string, string>,
      user: MockUser,
    ) => Response | Promise<Response>,
  ) =>
    authed((user, request, params) => {
      if (!user.isAdministrator) return forbidden();
      const item = itemsById.get(params.itemId ?? '');
      return item ? resolver(item, request, params, user) : notFound();
    });

  // The item is named in the body here, not in the path.
  const search = authed(async (user, request) => {
    if (!user.isAdministrator) return forbidden();
    const body = (await request.json()) as SearchQuery;
    const item = itemsById.get(body.ItemId ?? '');
    if (!item) return notFound();
    const name = body.SearchInfo?.Name?.trim() ?? '';
    const ids = body.SearchInfo?.ProviderIds ?? {};
    const archiveId = ids.DemoArchive?.trim();
    if (name === '' && !archiveId) return HttpResponse.json([]);
    const year = body.SearchInfo?.Year ?? item.year;
    const base = baseOf(request);
    const title = name || item.name;
    const results = [
      {
        Name: title,
        ProductionYear: year ?? undefined,
        ProviderIds: { DemoArchive: archiveId ?? `da-${item.id.slice(0, 6)}` },
        SearchProviderName: 'Demo-Archiv',
        Overview: item.overview ?? undefined,
        ImageUrl: remoteImageUrl(base, item, 'Primary', 1),
      },
      {
        Name: title,
        ProductionYear: year === null ? undefined : year - 23,
        ProviderIds: { DemoRegister: `kr-${item.id.slice(6, 12)}` },
        SearchProviderName: 'Kinoregister',
        Overview: 'Eine frühere Verfilmung desselben Stoffs, heute fast vergessen.',
        ImageUrl: remoteImageUrl(base, item, 'Primary', 2),
      },
    ];
    return HttpResponse.json(archiveId ? results.slice(0, 1) : results);
  });

  return [
    // Pictures "offered by the providers": variants of the generated artwork, loaded by <img>
    // without a token, like the real providers' pictures.
    http.get('*/DemoRemoteImages/:itemId/:type/:variant', ({ params }) => {
      const item = itemsById.get(String(params.itemId));
      const type = String(params.type);
      if (!item || !(ARTWORK_TYPES as readonly string[]).includes(type)) return notFound();
      return new HttpResponse(
        artworkSvg(variantOf(item, Number(params.variant)), type as MockImageType),
        svgResponseInit(),
      );
    }),

    http.get(
      '*/Items/:itemId/ExternalIdInfos',
      admin((item) => HttpResponse.json(externalIds(item))),
    ),
    http.post('*/Items/RemoteSearch/Movie', search),
    http.post('*/Items/RemoteSearch/Series', search),
    http.post(
      '*/Items/RemoteSearch/Apply/:itemId',
      admin(async (item, request) => {
        const result = (await request.json()) as SearchResult;
        if (!result.Name) return badRequest();
        item.name = result.Name;
        item.sortName = sortNameOf(item.forcedSortName ?? result.Name);
        item.year = result.ProductionYear ?? item.year;
        item.providerIds = { ...item.providerIds, ...result.ProviderIds };
        const variant = result.ImageUrl ? variantFromUrl(result.ImageUrl) : null;
        const replace = new URL(request.url).searchParams.get('replaceAllImages') !== 'false';
        if (replace && variant !== null) setImage(item, 'Primary', { kind: 'variant', variant });
        return noContent();
      }),
    ),

    http.get(
      '*/Items/:itemId/MetadataEditor',
      admin((item) =>
        HttpResponse.json({
          ParentalRatingOptions: RATINGS.map((name, index) => ({
            Name: name,
            Value: [0, 6, 12, 16, 18][index],
          })),
          Countries: [],
          Cultures: [],
          ExternalIdInfos: externalIds(item),
          ContentTypeOptions: [],
        }),
      ),
    ),
    // Like Jellyfin's UpdateItem: scalar fields left out are cleared, lists left out are kept.
    http.post(
      '*/Items/:itemId',
      admin(async (item, request) => {
        const dto = (await request.json()) as ItemUpdate;
        const name = dto.Name?.trim();
        if (!name) return badRequest();
        item.name = name;
        item.originalTitle = dto.OriginalTitle ?? null;
        item.forcedSortName = dto.ForcedSortName ?? null;
        item.sortName = sortNameOf(dto.ForcedSortName ?? name);
        item.overview = dto.Overview ?? null;
        item.tagline = dto.Taglines?.[0] ?? null;
        if (dto.Genres) item.genres = dto.Genres;
        if (dto.Tags) item.tags = dto.Tags;
        if (dto.Studios)
          item.studios = dto.Studios.map((studio) => studio.Name ?? '').filter(Boolean);
        item.year = dto.ProductionYear ?? null;
        item.premiereDate = dto.PremiereDate ?? null;
        item.endDate = dto.EndDate ?? null;
        item.officialRating = dto.OfficialRating ?? null;
        item.communityRating = dto.CommunityRating ?? null;
        item.criticRating = dto.CriticRating ?? null;
        if (dto.ProviderIds) {
          item.providerIds = Object.fromEntries(
            Object.entries(dto.ProviderIds).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          );
        }
        item.lockData = dto.LockData === true;
        return noContent();
      }),
    ),

    http.get(
      '*/Items/:itemId/Images',
      admin((item) =>
        HttpResponse.json(
          imageTypesOf(item).map((type) => {
            const [width, height] =
              type === 'Primary' && item.type === 'Episode' ? [1280, 720] : (SIZES[type] ?? [0, 0]);
            return {
              ImageType: type,
              ImageIndex: type === 'Backdrop' ? 0 : null,
              ImageTag: imageTag(item, type),
              Width: width,
              Height: height,
            };
          }),
        ),
      ),
    ),
    // The body is the picture as Base64 text, like Jellyfin's SetItemImage expects.
    http.post(
      '*/Items/:itemId/Images/:imageType',
      admin(async (item, request, params) => {
        const contentType = request.headers.get('Content-Type') ?? '';
        const data = (await request.text()).trim();
        if (!contentType.startsWith('image/') || data === '') return badRequest();
        setImage(item, params.imageType ?? '', { kind: 'upload', contentType, data });
        return noContent();
      }),
    ),
    http.delete(
      '*/Items/:itemId/Images/:imageType',
      admin((item, _request, params) => {
        removeImage(item, params.imageType ?? '');
        return noContent();
      }),
    ),
    http.delete(
      '*/Items/:itemId/Images/:imageType/:imageIndex',
      admin((item, _request, params) => {
        removeImage(item, params.imageType ?? '');
        return noContent();
      }),
    ),
    http.get(
      '*/Items/:itemId/RemoteImages',
      admin((item, request) => {
        const search = new URL(request.url).searchParams;
        const type = search.get('type') ?? 'Primary';
        const provider = search.get('providerName');
        const base = baseOf(request);
        const [width, height] = SIZES[type] ?? [0, 0];
        const images = (ARTWORK_TYPES as readonly string[]).includes(type)
          ? [1, 2, 3, 4, 5, 6].map((variant) => ({
              ProviderName: PROVIDERS[variant % 2],
              Url: remoteImageUrl(base, item, type, variant),
              ThumbnailUrl: remoteImageUrl(base, item, type, variant),
              Width: width,
              Height: height,
              CommunityRating: 9 - variant * 0.5,
              Language: [null, 'de', 'en'][variant % 3],
              Type: type,
            }))
          : [];
        const filtered = provider
          ? images.filter((image) => image.ProviderName === provider)
          : images;
        return HttpResponse.json({
          Images: filtered,
          TotalRecordCount: filtered.length,
          Providers: PROVIDERS,
        });
      }),
    ),
    http.post(
      '*/Items/:itemId/RemoteImages/Download',
      admin((item, request) => {
        const search = new URL(request.url).searchParams;
        const variant = variantFromUrl(search.get('imageUrl') ?? '');
        if (variant === null) return badRequest();
        setImage(item, search.get('type') ?? 'Primary', { kind: 'variant', variant });
        return noContent();
      }),
    ),

    http.get(
      '*/Items/:itemId/RemoteSearch/Subtitles/:language',
      admin((item, _request, params) => {
        const language = params.language ?? 'ger';
        if (!isVideo(item)) return HttpResponse.json([]);
        const file = item.name.replace(/[^\p{L}\p{N}]+/gu, '.');
        return HttpResponse.json([
          {
            Id: `${language}-1`,
            Name: `${file}.${language}.srt`,
            ProviderName: 'Untertitel-Archiv',
            Format: 'srt',
            ThreeLetterISOLanguageName: language,
            DownloadCount: 1520,
            CommunityRating: 8.4,
            IsHashMatch: true,
          },
          {
            Id: `${language}-2`,
            Name: `${file}.Kinofassung.${language}.srt`,
            ProviderName: 'Untertitel-Archiv',
            Format: 'srt',
            ThreeLetterISOLanguageName: language,
            DownloadCount: 310,
            CommunityRating: 6.9,
            IsHashMatch: false,
          },
          {
            Id: `${language}-3`,
            Name: `${file}.${language}.forced.ass`,
            ProviderName: 'Fan-Untertitel',
            Format: 'ass',
            ThreeLetterISOLanguageName: language,
            DownloadCount: 48,
            IsHashMatch: false,
            Forced: true,
          },
        ]);
      }),
    ),
    http.post(
      '*/Items/:itemId/RemoteSearch/Subtitles/:subtitleId',
      admin((item, _request, params) => {
        const match = /^([a-z]{3})-(\d)$/.exec(params.subtitleId ?? '');
        if (!match?.[1] || !isVideo(item)) return notFound();
        const forced = match[2] === '3';
        const format = forced ? 'ass' : 'srt';
        item.streams = [
          ...item.streams,
          {
            type: 'Subtitle',
            language: match[1],
            codec: format,
            title: subtitleTitle(match[1], format, forced),
            isDefault: false,
            external: true,
            forced,
          },
        ];
        return noContent();
      }),
    ),
    http.post(
      '*/Videos/:itemId/Subtitles',
      admin(async (item, request) => {
        const body = (await request.json()) as SubtitleUpload;
        const format = body.Format?.toLowerCase() ?? '';
        if (!body.Language || !body.Data || !SUBTITLE_FORMATS.includes(format) || !isVideo(item))
          return badRequest();
        item.streams = [
          ...item.streams,
          {
            type: 'Subtitle',
            language: body.Language,
            codec: format,
            title: subtitleTitle(body.Language, format, body.IsForced === true),
            isDefault: false,
            external: true,
            forced: body.IsForced === true,
            hearingImpaired: body.IsHearingImpaired === true,
          },
        ];
        return noContent();
      }),
    ),
    http.delete(
      '*/Videos/:itemId/Subtitles/:index',
      admin((item, _request, params) => {
        const index = Number(params.index);
        const stream = item.streams[index];
        if (stream?.type !== 'Subtitle' || !stream.external) return notFound();
        item.streams = item.streams.filter((_stream, position) => position !== index);
        return noContent();
      }),
    ),

    // Refresh and library scan: accepted; the demo catalog has nothing to look up.
    http.post(
      '*/Items/:itemId/Refresh',
      authed((user, _request, params) => {
        if (!user.isAdministrator) return forbidden();
        const id = params.itemId ?? '';
        return itemsById.has(id) || DEMO_VIEWS.some((view) => view.id === id)
          ? noContent()
          : notFound();
      }),
    ),
    http.delete(
      '*/Items/:itemId',
      admin((item, _request, _params, user) => {
        if (!canDelete(user.id, item)) return forbidden();
        removeFromCatalog(withDescendants(item));
        return noContent();
      }),
    ),
  ];
}
