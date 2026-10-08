import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import { DEMO_SERVER, DEMO_VIEWS, type MockUser } from './fixtures';
import { createContentHandlers } from './content-handlers';
import { avatarSvg, svgResponseInit } from './images';
import { createPlaybackHandlers } from './playback-handlers';
import type { MockState } from './state';
import { tokenOf } from './token';

function userDto(state: MockState, user: MockUser) {
  return {
    Name: user.name,
    ServerId: DEMO_SERVER.Id,
    ServerName: DEMO_SERVER.ServerName,
    Id: user.id,
    PrimaryImageTag: user.imageTag ?? undefined,
    HasPassword: user.password !== null,
    HasConfiguredPassword: user.password !== null,
    EnableAutoLogin: false,
    Configuration: state.userConfiguration(user.id),
    Policy: { IsAdministrator: user.isAdministrator, IsDisabled: false },
  };
}

function authResult(state: MockState, user: MockUser) {
  return {
    User: userDto(state, user),
    AccessToken: state.issueToken(user.id),
    ServerId: DEMO_SERVER.Id,
    SessionInfo: { UserId: user.id, UserName: user.name },
  };
}

const unauthorized = () => new HttpResponse(null, { status: 401 });

export type Authed = (
  resolver: (
    user: MockUser,
    request: Request,
    params: Record<string, string>,
  ) => Response | Promise<Response>,
) => HttpResponseResolver<Record<string, string>>;

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
      return HttpResponse.json(
        state.users.filter((user) => user.isPublic).map((user) => userDto(state, user)),
      );
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
      authed((user) => HttpResponse.json(userDto(state, user))),
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

    http.post(
      '*/Users/Configuration',
      authed(async (user, request) => {
        const userId = new URL(request.url).searchParams.get('userId') ?? user.id;
        if (userId !== user.id && !user.isAdministrator)
          return new HttpResponse(null, { status: 403 });
        const body = (await request.json()) as Record<string, unknown> | null;
        state.setUserConfiguration(userId, { ...state.userConfiguration(userId), ...body });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.get(
      '*/DisplayPreferences/:id',
      authed((user, request, params) => {
        const search = new URL(request.url).searchParams;
        return HttpResponse.json(
          state.displayPreferences(
            search.get('userId') ?? user.id,
            params.id ?? '',
            search.get('client') ?? '',
          ),
        );
      }),
    ),

    http.post(
      '*/DisplayPreferences/:id',
      authed(async (user, request, params) => {
        if (state.hasFault('preferences')) return new HttpResponse(null, { status: 500 });
        const search = new URL(request.url).searchParams;
        const body = (await request.json()) as Record<string, unknown> | null;
        state.setDisplayPreferences(
          search.get('userId') ?? user.id,
          params.id ?? '',
          search.get('client') ?? '',
          body ?? {},
        );
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.get(
      '*/Localization/Cultures',
      authed(() =>
        HttpResponse.json(
          [
            ['Deutsch', 'German', 'de', 'ger'],
            ['English', 'English', 'en', 'eng'],
            ['Français', 'French', 'fr', 'fre'],
            ['Español', 'Spanish', 'es', 'spa'],
            ['Italiano', 'Italian', 'it', 'ita'],
            ['Nederlands', 'Dutch', 'nl', 'dut'],
            ['日本語', 'Japanese', 'ja', 'jpn'],
          ].map(([name, display, two, three]) => ({
            Name: name,
            DisplayName: display,
            TwoLetterISOLanguageName: two,
            ThreeLetterISOLanguageName: three,
            ThreeLetterISOLanguageNames: [three],
          })),
        ),
      ),
    ),

    ...createContentHandlers(state, authed),
    ...createPlaybackHandlers(state, authed),
  ];
}
