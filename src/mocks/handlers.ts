import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import { DEMO_SERVER, DEMO_VIEWS, type MockUser } from './fixtures';
import { createContentHandlers } from './content-handlers';
import { avatarSvg, svgResponseInit } from './images';
import type { MockState } from './state';

/** Reads the token from `Authorization: MediaBrowser …, Token="…"` or the ApiKey parameter. */
function tokenOf(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const fromHeader = /Token="([^"]*)"/.exec(header)?.[1];
  if (fromHeader) return fromHeader;
  return new URL(request.url).searchParams.get('ApiKey');
}

function userDto(user: MockUser) {
  return {
    Name: user.name,
    ServerId: DEMO_SERVER.Id,
    ServerName: DEMO_SERVER.ServerName,
    Id: user.id,
    PrimaryImageTag: user.imageTag ?? undefined,
    HasPassword: user.password !== null,
    HasConfiguredPassword: user.password !== null,
    EnableAutoLogin: false,
    Configuration: {
      AudioLanguagePreference: '',
      SubtitleLanguagePreference: '',
      SubtitleMode: 'Default',
      EnableNextEpisodeAutoPlay: true,
      OrderedViews: [],
      MyMediaExcludes: [],
      LatestItemsExcludes: [],
    },
    Policy: { IsAdministrator: user.isAdministrator, IsDisabled: false },
  };
}

function authResult(state: MockState, user: MockUser) {
  return {
    User: userDto(user),
    AccessToken: state.issueToken(user.id),
    ServerId: DEMO_SERVER.Id,
    SessionInfo: { UserId: user.id, UserName: user.name },
  };
}

const unauthorized = () => new HttpResponse(null, { status: 401 });

/**
 * Request handlers emulating the Jellyfin endpoints the client uses. Paths start with `*` so
 * they work for any base URL (demo server path, test server, proxy).
 */
export function createHandlers(state: MockState) {
  const latency = async () => {
    if (state.options.latencyMs > 0) await delay(state.options.latencyMs);
  };

  /** Wraps a resolver that needs a signed-in user. */
  const authed =
    (
      resolver: (
        user: MockUser,
        request: Request,
        params: Record<string, string>,
      ) => Response | Promise<Response>,
    ): HttpResponseResolver<Record<string, string>> =>
    async ({ request, params }) => {
      await latency();
      const user = state.userForToken(tokenOf(request));
      return user ? resolver(user, request, params) : unauthorized();
    };

  return [
    http.get('*/System/Info/Public', async () => {
      await latency();
      return HttpResponse.json(DEMO_SERVER);
    }),

    http.get('*/Users/Public', async () => {
      await latency();
      return HttpResponse.json(state.users.filter((user) => user.isPublic).map(userDto));
    }),

    http.post('*/Users/AuthenticateByName', async ({ request }) => {
      await latency();
      const body = (await request.json()) as { Username?: string; Pw?: string } | null;
      const user = state.findUserByName(body?.Username ?? '');
      const password = body?.Pw ?? '';
      if (!user || (user.password ?? '') !== password) return unauthorized();
      return HttpResponse.json(authResult(state, user));
    }),

    http.get('*/QuickConnect/Enabled', async () => {
      await latency();
      return HttpResponse.json(state.options.quickConnectEnabled);
    }),

    http.post('*/QuickConnect/Initiate', async () => {
      await latency();
      if (!state.options.quickConnectEnabled) return new HttpResponse(null, { status: 401 });
      const request = state.startQuickConnect();
      return HttpResponse.json({
        Authenticated: false,
        Secret: request.secret,
        Code: request.code,
        DateAdded: new Date(request.createdAt).toISOString(),
      });
    }),

    http.get('*/QuickConnect/Connect', async ({ request }) => {
      await latency();
      const secret = new URL(request.url).searchParams.get('secret') ?? '';
      const pending = state.quickConnectRequest(secret);
      if (!pending) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({
        Authenticated: pending.approvedBy !== null,
        Secret: pending.secret,
        Code: pending.code,
      });
    }),

    http.post('*/Users/AuthenticateWithQuickConnect', async ({ request }) => {
      await latency();
      const body = (await request.json()) as { Secret?: string } | null;
      const userId = state.consumeQuickConnect(body?.Secret ?? '');
      const user = state.users.find((candidate) => candidate.id === userId);
      if (!user) return new HttpResponse(null, { status: 400 });
      return HttpResponse.json(authResult(state, user));
    }),

    http.post('*/Sessions/Logout', async ({ request }) => {
      await latency();
      const token = tokenOf(request);
      if (token) state.revokeToken(token);
      return new HttpResponse(null, { status: 204 });
    }),

    http.get(
      '*/Users/Me',
      authed((user) => HttpResponse.json(userDto(user))),
    ),

    http.get(
      '*/UserViews',
      authed(() =>
        HttpResponse.json({
          Items: DEMO_VIEWS.map((view) => ({
            Name: view.name,
            ServerId: DEMO_SERVER.Id,
            Id: view.id,
            Type: 'CollectionFolder',
            IsFolder: true,
            CollectionType: view.collectionType ?? undefined,
            ImageTags: { Primary: `library-${view.id}` },
            PrimaryImageAspectRatio: 16 / 9,
          })),
          TotalRecordCount: DEMO_VIEWS.length,
          StartIndex: 0,
        }),
      ),
    ),

    http.get('*/UserImage', ({ request }) => {
      const userId = new URL(request.url).searchParams.get('userId');
      const user = state.users.find((candidate) => candidate.id === userId);
      if (!user?.imageTag) return new HttpResponse(null, { status: 404 });
      return new HttpResponse(avatarSvg(user.hue), svgResponseInit());
    }),

    ...createContentHandlers(state, authed),
  ];
}
