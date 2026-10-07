import { http, HttpResponse, ws, type HttpResponseResolver } from 'msw';
import { artworkSvg } from './artwork';
import { itemsById, type MockImageType } from './catalog';
import { DEMO_VIEWS, type MockUser } from './fixtures';
import { libraryArtSvg, svgResponseInit } from './images';
import {
  filterOptions,
  genreItems,
  itemDto,
  latestItems,
  markPlayed,
  nextUp,
  parseItemQuery,
  queryItems,
  resumeItems,
  searchPeople,
  similarItems,
  userDataDto,
} from './library';
import type { MockState } from './state';

type Authed = (
  resolver: (
    user: MockUser,
    request: Request,
    params: Record<string, string>,
  ) => Response | Promise<Response>,
) => HttpResponseResolver<Record<string, string>>;

const notFound = () => new HttpResponse(null, { status: 404 });
const IMAGE_TYPES: readonly string[] = ['Primary', 'Backdrop', 'Thumb', 'Logo'];

function artwork(itemId: string, type: string): Response {
  const view = DEMO_VIEWS.find((candidate) => candidate.id === itemId);
  if (view) return new HttpResponse(libraryArtSvg(view.hue), svgResponseInit());
  const item = itemsById.get(itemId);
  if (!item || !IMAGE_TYPES.includes(type) || !item.images.includes(type as MockImageType))
    return notFound();
  return new HttpResponse(artworkSvg(item, type as MockImageType), svgResponseInit());
}

/** Library, item, show and user-data endpoints of the mock server. */
export function createContentHandlers(state: MockState, authed: Authed) {
  const library = state.library;
  const page = (items: unknown[]) =>
    HttpResponse.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
  const limitOf = (request: Request, fallback: number) => {
    const value = new URL(request.url).searchParams.get('limit');
    return value === null ? fallback : Number(value);
  };

  return [
    http.get('*/Items/:itemId/Images/:imageType/:imageIndex', ({ params }) =>
      artwork(String(params.itemId), String(params.imageType)),
    ),
    http.get('*/Items/:itemId/Images/:imageType', ({ params }) =>
      artwork(String(params.itemId), String(params.imageType)),
    ),

    http.get(
      '*/UserItems/Resume',
      authed((user, request) => page(resumeItems(library, user.id).slice(0, limitOf(request, 20)))),
    ),
    http.get(
      '*/Shows/NextUp',
      authed((user, request) => {
        const params = new URL(request.url).searchParams;
        const items = nextUp(
          library,
          user.id,
          params.get('seriesId') ?? undefined,
          params.get('enableResumable') !== 'false',
        );
        return page(items.slice(0, limitOf(request, 20)));
      }),
    ),
    http.get(
      '*/Items/Latest',
      authed((user, request) => {
        const parentId = new URL(request.url).searchParams.get('parentId') ?? '';
        return HttpResponse.json(latestItems(library, user.id, parentId, limitOf(request, 20)));
      }),
    ),
    http.get(
      '*/Items/Filters',
      authed((_user, request) => {
        const query = parseItemQuery(new URL(request.url));
        return HttpResponse.json(filterOptions(query.parentId ?? null, query.includeItemTypes));
      }),
    ),
    http.get(
      '*/Items/:itemId/Similar',
      authed((user, request, params) =>
        page(similarItems(library, user.id, params.itemId ?? '', limitOf(request, 12))),
      ),
    ),
    http.get(
      '*/Items/:itemId/LocalTrailers',
      authed(() => HttpResponse.json([])),
    ),
    http.get(
      '*/Items/:itemId',
      authed((user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        return item ? HttpResponse.json(itemDto(library, user.id, item)) : notFound();
      }),
    ),
    http.get(
      '*/Items',
      authed((user, request) =>
        HttpResponse.json(queryItems(library, user.id, parseItemQuery(new URL(request.url)))),
      ),
    ),
    http.get(
      '*/Shows/:seriesId/Seasons',
      authed((user, _request, params) =>
        HttpResponse.json(
          queryItems(library, user.id, { parentId: params.seriesId, sortBy: ['IndexNumber'] }),
        ),
      ),
    ),
    http.get(
      '*/Shows/:seriesId/Episodes',
      authed((user, request) => {
        const seasonId = new URL(request.url).searchParams.get('seasonId');
        const result = queryItems(library, user.id, { parentId: seasonId });
        result.Items.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
        return HttpResponse.json(result);
      }),
    ),
    http.get(
      '*/Genres',
      authed((_user, request) =>
        page(genreItems(parseItemQuery(new URL(request.url)).includeItemTypes)),
      ),
    ),
    http.get(
      '*/Persons',
      authed((user, request) => {
        const term = new URL(request.url).searchParams.get('searchTerm') ?? '';
        return page(searchPeople(library, user.id, term, limitOf(request, 20)));
      }),
    ),
    http.post(
      '*/UserFavoriteItems/:itemId',
      authed((user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        if (!item) return notFound();
        library.set(user.id, item.id, { favorite: true });
        return HttpResponse.json(userDataDto(library, user.id, item));
      }),
    ),
    http.delete(
      '*/UserFavoriteItems/:itemId',
      authed((user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        if (!item) return notFound();
        library.set(user.id, item.id, { favorite: false });
        return HttpResponse.json(userDataDto(library, user.id, item));
      }),
    ),
    http.post(
      '*/UserPlayedItems/:itemId',
      authed((user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        return item ? HttpResponse.json(markPlayed(library, user.id, item, true)) : notFound();
      }),
    ),
    http.delete(
      '*/UserPlayedItems/:itemId',
      authed((user, _request, params) => {
        const item = itemsById.get(params.itemId ?? '');
        return item ? HttpResponse.json(markPlayed(library, user.id, item, false)) : notFound();
      }),
    ),
    // Live updates: accept the connection; the demo server sends no events.
    ws.link('*/socket').addEventListener('connection', () => undefined),
  ];
}
