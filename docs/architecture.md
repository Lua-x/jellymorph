# Architecture

> As of: phase 0 (plan), 2026-10-07. The requirements are binding in `CLAUDE.md`. This document describes **how** they are implemented.
> Additions and deviations are marked with **[Decision]**. Points that need an answer are marked with **[Question n]** and collected in §19.
> Statements marked "verified" were checked against the installed packages (SDK types, npm metadata). Statements marked "check in phase n" rely on server behavior that only a real Jellyfin server can confirm.

## Contents

1. Starting point and verified facts
2. Dependencies
3. Layers, folders, import rules
4. Startup and runtime configuration
5. API layer and sign-in
6. Data layer (headless hooks)
7. Theme system
8. Navigation and input
9. Player
10. Settings and persistence
11. Internationalization
12. Accessibility
13. Performance and budgets
14. Security
15. Docker and operation (outlook to phase 5)
16. Tests and CI
17. Phase plan in detail
18. Risks
19. Open questions

---

## 1. Starting point and verified facts

### 1.1 Jellyfin server

| Version | Status                                                                      | Relevance                                |
| ------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| 10.10.x | Minimum version according to the spec and the SDK's `MINIMUM_VERSION`       | MediaSegments API is available from here |
| 10.11.x | widespread                                                                  | –                                        |
| 12.0.x  | current since 2026-09-07, new version scheme ("10.12" is now called "12.0") | see below                                |

What Jellyfin 12.0 changes for clients (from the release notes):

- Deprecated authentication methods are switched off by default. We only use the `Authorization: MediaBrowser …` header (SDK default) and, for media URLs, the `ApiKey` query parameter (SDK constant `AUTHORIZATION_PARAMETER`, verified).
- `/emby/` and `/mediabrowser/` prefixes removed: we do not use them.
- `GET /QuickConnect/Initiate` removed: the SDK uses `POST`, in 1.0.0 as well as in 0.11.0 (verified), so it works on 10.10 through 12.0.
- With `includeItemTypes` combined with filters, `GetItems` may return different result sets than 10.11. We therefore test library filters against 10.11 **and** 12.0 (phase 2, see [Question 2]).
- Version comparisons go exclusively through the SDK's `compareVersions()`, never through our own string parsing.

### 1.2 @jellyfin/sdk 1.0.0 (published 2026-09-11)

- Generated from the OpenAPI of Jellyfin 12.0. Many classes were renamed or moved. Relevant for us (verified):

  | Purpose                                        | SDK 1.0.0                                                                                                                                                   |
  | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Items, resume, latest, similar, local trailers | `getLibraryApi` → `getItems`, `getItem`, `getResumeItems`, `getLatestMedia`, `getSimilarItems`, `getLocalTrailers`                                          |
  | Favorite, played                               | `getUserDataApi` → `markFavoriteItem`, `unmarkFavoriteItem`, `markPlayedItem`, `markUnplayedItem`                                                           |
  | Series                                         | `getShowApi` → `getSeasons`, `getEpisodes` (with `startItemId`/`adjacentTo`), `getNextUp`                                                                   |
  | Libraries                                      | `getUserViewApi` → `getUserViews`                                                                                                                           |
  | Sign-in, Quick Connect                         | `getAuthenticationApi` → `authenticateUserByName`, `getQuickConnectEnabled`, `initiateQuickConnect`, `getQuickConnectState`, `authenticateWithQuickConnect` |
  | Users                                          | `getUserApi` → `getCurrentUser`, `getPublicUsers`, `updateUserConfiguration`                                                                                |
  | Playback                                       | `getMediaInfoApi` → `getPostedPlaybackInfo`, `getBitrateTestBytes`                                                                                          |
  | Reporting                                      | `getSessionApi` → `reportPlaybackStart`, `reportPlaybackProgress`, `reportPlaybackStopped`, `pingPlaybackSession`, `postFullCapabilities`                   |
  | Segments, trickplay                            | `getMediaSegmentApi` → `getItemSegments`; `getTrickPlayApi`                                                                                                 |
  | Settings                                       | `getDisplayPreferenceApi` → `getDisplayPreferences`, `updateDisplayPreferences`                                                                             |
  | Search, filters, genres                        | `getLibraryApi.getItems({ searchTerm })`, `getFilterApi.getQueryFilters`, `getGenreApi.getGenres`                                                           |
  | Server discovery                               | `jellyfin.discovery.getRecommendedServerCandidates()` / `findBestServer()`                                                                                  |
  | Image URLs                                     | `getImageApi(api)` returns `ImageUrlsApi` with `getItemImageUrl()`, `getItemImageUrlById()`, `getUserImageUrl()`                                            |
  | Live updates                                   | `api.subscribe()` over WebSocket (`UserDataChanged`, `LibraryChanged`, `UserUpdated` …)                                                                     |

- **Compatibility with 10.10, verified:** I extracted all endpoint paths from the generated client of 1.0.0 and compared them with SDK 0.11.0 (generated for 10.10). Only present in 1.0.0: `/Backup*`, `/Items/{id}/Collections`, `/SyncPlay/{id}`, `/System/Configuration/Branding`, `/System/Info/Storage`. We need none of them. All paths the client uses are identical in 10.10.
- **Missing in 1.0.0:** the dynamic HLS endpoints (`master.m3u8` …) and `DELETE /Videos/ActiveEncodings`. We do not need HLS directly, because the URL comes ready-made from the server as `MediaSourceInfo.TranscodingUrl`. We need `ActiveEncodings` when switching tracks (§9.7) and therefore call it through the SDK's Axios instance. **[Decision]**, documented in CLAUDE.md §12.
- The `Api` constructor accepts its own Axios instance. Every method takes Axios options, so also `signal` (cancellation by TanStack Query) and `fetchOptions: { keepalive: true }` (stop report when the tab closes; axios 1.20 supports `fetchOptions`, verified).
- `getBrowserDeviceProfile()` only creates subtitle profiles. We write the DeviceProfile generator ourselves (§9.3).
- **Findings from phase 1:**
  - `getImageApi(api).getUserImageUrl()` builds `/Users/{id}/Images/Primary`. This path exists in neither the 10.10 nor the 12.0 specification; both provide `/UserImage?userId=…&tag=…`.
  - The `ImageUrlsApi` helpers pull the complete generated `ImageApi` into the bundle (~48 KB minified). Image URLs are therefore built in `api/urls.ts` through `api.getUri()`.
  - `UserDto.HasPassword` and `HasConfiguredPassword` are marked deprecated in 12.0 without a replacement, but are returned from 10.10 through 12.0. We read `HasPassword` so we never have to try a sign-in with an empty password; such an attempt counts towards the account lockout.
  - `api.logout()` is deprecated. We use `getSessionApi(api).reportSessionEnded()` instead.
- `axios` is a peer dependency (`^1.12`) and therefore mandatory.

### 1.3 Tools (npm as of 2026-10-07)

| Package           | Version       | Note                                                                                                                             |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node              | 24.19 (local) | CI also Node 24                                                                                                                  |
| react / react-dom | 19.3.0        |                                                                                                                                  |
| vite              | 8.3.3         |                                                                                                                                  |
| typescript        | **~6.0**      | 7.0.2 exists, but typescript-eslint 8.71 requires `<6.1.0` (verified). **[Decision]**                                            |
| eslint            | 10.x          | `eslint-plugin-jsx-a11y` does not support ESLint 10; in the Crystal project `eslint-plugin-jsx-a11y-x` worked. Check in phase 1. |
| vitest            | 5.0           |                                                                                                                                  |
| msw               | 3.0           | Node ≥ 22.12                                                                                                                     |
| @playwright/test  | 1.63          |                                                                                                                                  |

### 1.4 Browser targets **[Decision, Question 3]**

Chrome/Edge ≥ 111, Firefox ≥ 128 (ESR), Safari/iOS ≥ 16.4. That makes container queries, `:has()`, `color-mix()`, `inert`, `dvh` and `aspect-ratio` available without polyfills. View transitions are only used as a progressive enhancement. TVs are supported through their browser if it meets the baseline (current Android/Google TV and Fire TV browsers, newer webOS/Tizen generations). Older TV engines (Chromium < 111) are not supported through polyfills.

---

## 2. Dependencies

### 2.1 Runtime (according to the spec)

| Package                                        | Purpose        | Reasoning                                                                                                                      | Loaded                    |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `react`, `react-dom` 19.3                      | UI             | Spec                                                                                                                           | Base                      |
| `react-router` 8.4                             | Routing        | Data router with `lazy` routes, modal routes through `state.backgroundLocation`                                                | Base                      |
| `@jellyfin/sdk` 1.0.0 + `axios` 1.20           | API            | Spec; axios is a peer dependency. Imports through subpaths (`@jellyfin/sdk/lib/utils/api/...`) so tree shaking works           | Base                      |
| `@tanstack/react-query` 5.104                  | Server state   | Caching, cancellation, background refresh, optimistic updates                                                                  | Base                      |
| `zustand` 5                                    | App state      | Session, settings, player state; ~1 KB                                                                                         | Base                      |
| `@tanstack/react-virtual` 3.14                 | Virtualization | Library grid                                                                                                                   | Lazy (library route)      |
| `hls.js` 1.7                                   | HLS            | Transcoded playback outside Safari                                                                                             | Lazy (player chunk)       |
| `motion` 14                                    | Animation      | Only through `LazyMotion` + `m.*`, features loaded asynchronously. Not installed yet, comes with the first theme that needs it | Base (small) + lazy       |
| ~~`@noriginmedia/norigin-spatial-navigation`~~ | Remote control | Replaced in phase 4 by our own DOM-based navigation (§8), no dependency                                                        | –                         |
| `i18next` 26 + `react-i18next` 17              | i18n           | Spec; `react-i18next` is the matching React binding                                                                            | Base; language files lazy |
| `@fontsource/*`                                | Fonts          | Spec; imported in the entry point of each theme                                                                                | Lazy (theme chunk)        |

### 2.2 Additionally proposed **[Question 4]**

| Package                                                                                                                                          | Kind                | Why                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blurhash` 2.0                                                                                                                                   | Runtime, ~1 KB gzip | BlurHash placeholders are mandatory. The reference implementation is smaller than any rebuild of our own, and tested. Encoder only in the fixture script. |
| `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`                                                                              | Dev                 | The usual companions of React Testing Library                                                                                                             |
| `@axe-core/playwright`                                                                                                                           | Dev                 | Automatic accessibility checks in E2E (WCAG AA is mandatory)                                                                                              |
| `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y-x`, `eslint-config-prettier`, `globals` | Dev                 | Basic ESLint setup for React + TS + a11y                                                                                                                  |
| `@vitejs/plugin-react` 6                                                                                                                         | Dev                 | Vite integration                                                                                                                                          |

### 2.3 Deliberately **not** used

UI component libraries, CSS-in-JS, Tailwind, date libraries (`Intl` is enough), `vite-plugin-pwa`/Workbox (manifest and icons are made by hand faster than configured; there is no service worker, §15.1), JASSUB/libass (ASS rendering in the browser, several MB of WASM, see [Question 9]), React Compiler (possible later, no need at the moment).

---

## 3. Layers, folders, import rules

### 3.1 Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│ themes/<id>/        presentation + motion (CSS Modules, tokens, m.*)   │
│   ▲ props (domain types, QueryResult, models)   ▲ shared hooks         │
├───┴───────────────────────────────────────────────┴────────────────────┤
│ app/routes/         containers: call hooks, build props, <ThemeSlot>   │
├────────────────────────────────────────────────────────────────────────┤
│ hooks/  player/  navigation/  settings/  ui/ (theme-neutral blocks)    │
├────────────────────────────────────────────────────────────────────────┤
│ domain/             types + mappers (BaseItemDto → MediaItem …)        │
├────────────────────────────────────────────────────────────────────────┤
│ api/                SDK instance, session, auth, URLs, error mapping   │
├────────────────────────────────────────────────────────────────────────┤
│ config/             window.__APP_CONFIG__ validated                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Folder structure (refined)

Compared with CLAUDE.md §4, `domain/`, `ui/` and `app/routes/` are added. **[Decision]**

```
src/
  app/
    main.tsx               # entry: config → (demo) → providers → router
    providers/             # QueryClient, I18n, Theme, Focus, MotionConfig
    router.tsx             # routes incl. modal routes, lazy
    routes/                # container per page (Home, Library, Item, Series, Search, …)
  config/                  # AppConfig type, validation, defaults
  api/
    client.ts              # Jellyfin and Api instance, Axios interceptors
    device.ts              # device ID and name, ClientInfo
    servers.ts             # store and check servers (discovery)
    session.ts             # token storage, sign-in, sign-out, 401 handling
    urls.ts                # image, stream, subtitle and trickplay URLs
    errors.ts              # AxiosError → AppError
  domain/
    types.ts               # MediaItem, ItemDetail, Episode, Season, Library, Person, …
    map.ts                 # BaseItemDto → domain (pure, tested)
    query-result.ts        # QueryResult<T> + adapter from TanStack Query
  hooks/                   # headless, see §6
  player/
    capabilities.ts        # detect browser capabilities (async, cached)
    device-profile.ts      # capabilities → DeviceProfile (pure, tested)
    playback-info.ts       # request PlaybackInfo, choose the source, build URLs
    controller.ts          # state machine of one playback
    engines/native.ts      # <video src> (direct play, Safari HLS)
    engines/hlsjs.ts       # hls.js (dynamic import)
    reporting.ts           # start/progress/pause/stop/ping
    segments.ts            # MediaSegments → active segments
    trickplay.ts           # tile/offset for a point in time (pure, tested)
    subtitles.ts           # load VTT, manage <track>
    next-episode.ts
    store.ts               # zustand: PlayerModel for the overlay
  navigation/              # spatial navigation setup, back stack, shortcuts, input mode
  settings/                # store, schema, sync with DisplayPreferences/UserConfiguration
  ui/                      # theme-neutral: JellyImage, BlurHashCanvas, Focusable, VirtualGrid,
                           #   AppLink, Portal, VisuallyHidden, RouteAnnouncer
  i18n/                    # setup, types; locales/de/*.json, locales/en/*.json
  themes/
    contract.ts  registry.ts  ThemeProvider.tsx  ThemeSlot.tsx  tokens.ts
    default/  neon-grid/  crimson/  glass/  horizon/  constellation/
  mocks/                   # MSW handlers, fixtures, generator scripts, demo media
docker/  e2e/  docs/  scripts/  .github/workflows/
```

### 3.3 Import rules (enforced by ESLint) **[Decision]**

| Area                                                           | must not import                                                                                                                                                                         | Purpose                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/themes/**`                                                | `@/api/**`, `@jellyfin/sdk*`, `axios`, `@tanstack/react-query`, `@/mocks/**`, `@/player/engines/**`, other themes (except `default`); globals `fetch`, `XMLHttpRequest`, `localStorage` | Themes stay pure presentation and never call the API |
| `src/hooks/**`, `src/api/**`, `src/domain/**`, `src/player/**` | `@/themes/**`                                                                                                                                                                           | Headless stays headless                              |
| everything except `src/app/main.tsx`                           | `@/mocks/**`                                                                                                                                                                            | MSW never ends up in the base bundle                 |

Implemented with `no-restricted-imports` and `no-restricted-globals` as overrides per file pattern. No additional plugin is needed for this.

---

## 4. Startup and runtime configuration

### 4.1 `config.js`

`index.html` loads `<script src="/config.js">` (no-cache, no inline script, CSP-compatible) before the module entry.

```ts
export interface AppConfig {
  jellyfinUrl: string | null; // JELLYFIN_URL
  lockServer: boolean; // LOCK_SERVER
  proxyPath: string | null; // '/jellyfin' when JELLYFIN_PROXY_TARGET is set, otherwise null
  defaultTheme: ThemeId; // DEFAULT_THEME, unknown IDs → 'default' + warning
  appTitle: string; // APP_TITLE
  demoMode: boolean; // DEMO_MODE – [Question 5]
}
```

`config/` validates `window.__APP_CONFIG__` with a type guard. Missing or invalid values lead to defaults and a console warning, never to a crash. If `proxyPath` is set, the server is `${location.origin}${proxyPath}`. Server selection is then dropped, as with `lockServer`.

In development a small Vite plugin serves `/config.js` from `.env.local`. `JELLYFIN_DEV_URL` set → dev proxy under `/jellyfin` (the same path as in production). Not set → `demoMode: true`.

### 4.2 Startup sequence

1. Read and validate `config.js`.
2. In demo mode, load `import('@/mocks/browser')` and start the MSW worker **before** the first request runs.
3. Read the theme ID synchronously from `localStorage` (otherwise `defaultTheme`). Immediately start `load()` of the active theme and the default theme in parallel.
4. Restore the session synchronously from `localStorage`. With a stored token the app renders the home page right away (fast LCP). `getCurrentUser` validates in the background; a 401 leads to the sign-in.
5. Render. Until the theme chunks have arrived, `index.html` shows a neutral CSS splash without a layout shift.

---

## 5. API layer and sign-in

### 5.1 Client and device

- One `Jellyfin` instance with `clientInfo { name: 'Jellymorph', version }` and `deviceInfo { name, id, languages }`. `languages` is the UI language and produces the `Accept-Language` header.
- **Device ID:** random (`crypto.getRandomValues`, also works in insecure HTTP contexts on the LAN), once per browser in `localStorage`. Device name from user agent data (e.g. "Chrome · Windows").
- **Risk R6:** Jellyfin binds tokens to the device ID. Whether a sign-in of user B on the same device ID invalidates A's token, I will check on a real server in phase 1. If so: a device ID per user with a suffix.

### 5.2 Server

- The input is checked with `discovery.getRecommendedServerCandidates(input)` (tries schemes and ports, calls `/System/Info/Public`) and rated with `findBestServer()`. Version < 10.10 → a clear message.
- Stored: `{ id (ServerId), name, url, version, lastUsed }`, several servers possible. With `lockServer` or the proxy, the selection is dropped.

### 5.3 Sign-in

- **Password:** `authenticateUserByName`. Only `{ serverId, userId, userName, accessToken }` is stored, never the password.
- **Quick Connect:** `getQuickConnectEnabled` → hidden when `false`. `initiateQuickConnect` → show the code → `getQuickConnectState` every 3 s (cancellable, timeout after 5 min with "Request a new code") → `authenticateWithQuickConnect`.
- **Profile picker:** `getPublicUsers`. Without a password (`HasPassword === false`) sign in directly, otherwise a password field or Quick Connect. If the server shows no public users, go straight to the sign-in form.
- **Remembered profiles:** **[Question 8]** For "Who's watching?" without entering the password again, I would store several sessions per device (one token per user). Each profile can be signed out on its own.
- **Sign-out:** `api.logout()` (`POST /Sessions/Logout`) ends the session on the server. Then delete the token, clear the query cache, stop the player.
- **401:** Axios interceptor → mark the session as expired → sign-in with a notice. Running requests are cancelled.

### 5.4 Errors

`api/errors.ts` maps errors to `AppError { kind: 'network' | 'auth' | 'forbidden' | 'notFound' | 'server' | 'unsupported' | 'aborted', status?, messageKey }`. Themes only see `AppError`. Texts come from i18n.

### 5.5 Cancellation and retries

Every query call passes `signal` through to the SDK. Retries: 2 on network or 5xx errors with backoff, none on 4xx.

axios uses the **fetch adapter** globally (`axios.defaults.adapter = 'fetch'`, which also applies to the SDK's internal server discovery). Reasons: `keepalive` for the stop report when the tab closes (§9.8) and the same behavior in the browser and in tests. MSW 3 intercepts `fetch` in the test DOM, but not `XMLHttpRequest`. **[Decision]**

### 5.6 URLs

| Target             | Construction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images             | `api/urls.ts` → `api.getUri('/Items/{id}/Images/{type}', { tag, maxWidth, quality: 85 })` (not `ImageUrlsApi`, see §1.2). Width = rendered width × DPR, rounded to a ladder of steps (240/360/480/720/960/1280/1920/2560/3840). `srcset` for hero/backdrops. Images need no token. Quality stays below 90 (backdrops 80 like jellyfin-web, everything else 85): from 90 up, Jellyfin sends the original file instead of its cached copy when the requested size covers the original, which wakes a hard disk holding the artwork (fixed in 1.2.1). |
| Direct play stream | `api.getUri('/Videos/{id}/stream', { static: true, mediaSourceId, PlaySessionId, Tag, ApiKey })`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Transcoding        | `TranscodingUrl` from PlaybackInfo, as delivered, appended to the base URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Subtitles          | Fetched through `getSubtitleApi` as text → blob URL for `<track>` (§9.6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Trickplay tiles    | `api.getUri('/Videos/{id}/Trickplay/{width}/{index}.jpg', { MediaSourceId, ApiKey })`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

`api.getUri()` belongs to the SDK. URLs for `<video>`/`<img>` are not fetches, so this does not violate "no hand-written fetch".

---

## 6. Data layer (headless hooks)

### 6.1 Domain types **[Decision]**

Themes work with lean, stable types instead of `BaseItemDto`:

```ts
export interface ImageRef {
  itemId: string;
  type: 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' | 'Banner';
  tag: string;
  blurHash?: string;
  aspectRatio?: number;
}

export interface MediaItem {
  id: string;
  kind: 'movie' | 'series' | 'season' | 'episode' | 'collection' | 'person' | 'video' | 'folder';
  name: string;
  year?: number;
  runtimeMinutes?: number;
  officialRating?: string;
  communityRating?: number;
  genres: string[];
  overview?: string;
  images: { primary?: ImageRef; backdrop?: ImageRef[]; thumb?: ImageRef; logo?: ImageRef };
  userData: {
    played: boolean;
    favorite: boolean;
    progress?: number /* 0..1 */;
    positionTicks?: number;
    unplayedCount?: number;
  };
  episode?: { seriesId: string; seriesName: string; seasonNumber?: number; episodeNumber?: number };
}
```

Plus `ItemDetail` (cast, studios, tracks, chapters, `localTrailerCount`, `mediaSources`), `Season`, `Episode`, `Library`, `Person`, `Profile`, `HomeSection`, `SearchGroup`, `FavoriteGroup`. The mappers are pure functions with unit tests. If a future SDK version changes fields, only `domain/map.ts` changes.

```ts
export type QueryResult<T> =
  | { status: 'pending' }
  | { status: 'error'; error: AppError; retry: () => void }
  | { status: 'success'; data: T; isRefreshing: boolean };
```

### 6.2 Hooks → SDK

| Hook                                           | SDK calls                                                                                                                                                                                                                                                                        | Notes                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useServerInfo(url)`                           | Discovery / `getPublicSystemInfo`                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                     |
| `useLoginFlow()`                               | Authentication API, `getPublicUsers`                                                                                                                                                                                                                                             | Model for LoginPage (steps: server, credentials, quickConnect)                                                                                                                                                                                                                      |
| `useCurrentUser()`                             | `getCurrentUser`                                                                                                                                                                                                                                                                 | contains `Configuration` (OrderedViews, excludes, languages)                                                                                                                                                                                                                        |
| `useUserViews()`                               | `getUserViews({ includeHidden: false })`                                                                                                                                                                                                                                         | The server applies the `OrderedViews` order and `MyMediaExcludes` (check in phase 2). Unsupported types are filtered, see [Question 10].                                                                                                                                            |
| `useFeatured(n)`                               | `getItems({ sortBy: Random, includeItemTypes: [Movie, Series], hasOverview, imageTypes: [Backdrop], limit: n, recursive })`                                                                                                                                                      | Result stable for 30 min (`staleTime`), so the hero does not jump                                                                                                                                                                                                                   |
| `useHomeSections()`                            | Continue watching `getResumeItems({ mediaTypes: [Video] })`, next up `getNextUp`, new per library `getLatestMedia({ parentId })` without `LatestItemsExcludes`, favorites `getItems({ isFavorite })`, genres `getGenres`, collections `getItems({ includeItemTypes: [BoxSet] })` | Every section has its own query and loads in parallel. Empty sections are hidden.                                                                                                                                                                                                   |
| `useLibraryBrowser(source)`                    | `getItems` page by page (`startIndex`, `limit: 100`, `enableTotalRecordCount`) + `getQueryFilters`                                                                                                                                                                               | Source: library, collection, genre or person. Jump bar: `getItems({ nameLessThan: x, limit: 0 })` with a lowercase letter → total count = index (still to be checked on a real server). Filter options through `getQueryFiltersLegacy` (the only endpoint that also returns years). |
| `useItem(id)`                                  | `getItem` with `fields`                                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                     |
| `useSimilar(id)`                               | `getSimilarItems`                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                     |
| `useLocalTrailers(id)`                         | `getLocalTrailers`                                                                                                                                                                                                                                                               | only when `LocalTrailerCount > 0`                                                                                                                                                                                                                                                   |
| `useSeasons`, `useEpisodes`, `useSeriesNextUp` | `getSeasons`, `getEpisodes({ seasonId })`, `getNextUp({ seriesId, enableResumable: true })` (`false` on the home page)                                                                                                                                                           |                                                                                                                                                                                                                                                                                     |
| `useSearch(term)`                              | `getItems({ searchTerm, includeItemTypes })` per group in parallel, people through `getPersonApi`                                                                                                                                                                                | Debounce 300 ms, from 2 characters, previous results stay visible until the new answer, outdated requests are cancelled                                                                                                                                                             |
| `useFavorites()`                               | `getItems({ isFavorite: true })` grouped by type                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                     |
| `useMediaActions()`                            | Favorite, played, play, open                                                                                                                                                                                                                                                     | Optimistic: `setQueriesData` updates the item in **all** cached lists. On error rollback + toast.                                                                                                                                                                                   |
| `useTrailerPreview(item)`                      | `getLocalTrailers` + player engine in preview mode                                                                                                                                                                                                                               | muted, desktop/TV only, only with the setting, not with `saveData`                                                                                                                                                                                                                  |

### 6.3 Query keys and cache

- Keys always start with `[serverId, userId, …]`. On sign-out or a profile switch, `queryClient.clear()` is called. That way data of another user can never become visible.
- `staleTime`: continue watching/next up 30 s (+ refetch on window focus and after every playback), item details 60 s, library pages 5 min, genres/filters 30 min. `gcTime` 10 min.
- **Live updates:** the SDK subscribes to `UserDataChanged`, `LibraryChanged` and `UserUpdated` over WebSocket. Targeted invalidations follow. This keeps "Continue watching" in sync when somebody watches on another device. If the WebSocket fails, there is no error message, only the focus refetch.

---

## 7. Theme system

### 7.1 Contract (final, version 1)

```ts
// src/themes/contract.ts
import type { ComponentType, ReactNode } from 'react';
import type {
  AppError,
  Episode,
  FavoriteGroup,
  HomeSection,
  HomeSectionKind,
  ItemDetail,
  Library,
  MediaItem,
  Profile,
  QueryResult,
  SearchGroup,
  Season,
} from '@/domain/types';
import type { LoginFlow } from '@/hooks/useLoginFlow';
import type { LibraryBrowser } from '@/hooks/useLibraryBrowser';
import type { NavModel } from '@/navigation/nav-model';
import type { PlayerModel } from '@/player/store';
import type { SettingsModel } from '@/settings/model';
import type { ThemeTextKey } from '@/i18n/types';

export const THEME_CONTRACT_VERSION = 1;

export type ThemeId = 'default' | 'neon-grid' | 'crimson' | 'glass' | 'horizon' | 'constellation';
export type ColorScheme = 'dark' | 'light';
export type Presentation = 'page' | 'modal';
export type CardVariant = 'poster' | 'landscape' | 'episode' | 'square' | 'tile';

export interface ThemeManifest {
  id: ThemeId;
  nameKey: ThemeTextKey;
  descriptionKey: ThemeTextKey;
  /** Preview images per color scheme (Vite asset URLs, loaded only on the settings page). */
  preview: Partial<Record<ColorScheme, string>>;
  colorSchemes: readonly [ColorScheme, ...ColorScheme[]];
  load: () => Promise<ThemeModule>;
}

export interface ThemeOptions {
  /** How item and series details open. 'modal' renders above the previous page (route state). */
  detailPresentation: Presentation;
  /** Number of featured items the hero should receive. */
  heroItemCount: number;
}

export interface ThemeModule {
  contractVersion: typeof THEME_CONTRACT_VERSION;
  components: Partial<ThemeComponents>;
  options?: Partial<ThemeOptions>;
}

export interface ThemeComponents {
  AppShell: ComponentType<AppShellProps>;
  LoginPage: ComponentType<LoginPageProps>;
  ProfileSelect: ComponentType<ProfileSelectProps>;
  HomePage: ComponentType<HomePageProps>;
  LibraryPage: ComponentType<LibraryPageProps>;
  ItemDetailPage: ComponentType<ItemDetailPageProps>;
  SeriesPage: ComponentType<SeriesPageProps>;
  SearchPage: ComponentType<SearchPageProps>;
  FavoritesPage: ComponentType<FavoritesPageProps>;
  SettingsPage: ComponentType<SettingsPageProps>;
  PlayerOverlay: ComponentType<PlayerOverlayProps>;
  ResumePrompt: ComponentType<ResumePromptProps>;
  Hero: ComponentType<HeroProps>;
  Row: ComponentType<RowProps>;
  MediaCard: ComponentType<MediaCardProps>;
  Toast: ComponentType<ToastProps>;
  LoadingState: ComponentType<LoadingStateProps>;
  EmptyState: ComponentType<EmptyStateProps>;
  ErrorState: ComponentType<ErrorStateProps>;
}

/** Context where a building block is rendered; 'preview' = settings live preview. */
export type RenderContext = 'page' | 'preview';

export interface AppShellProps {
  nav: NavModel;
  children: ReactNode;
}
export interface LoginPageProps {
  flow: LoginFlow;
}
export interface ProfileSelectProps {
  profiles: QueryResult<Profile[]>;
  onSelect: (profile: Profile) => void;
  onOtherUser: () => void;
  onChangeServer?: () => void; // undefined when the server is locked
}
export interface HomePageProps {
  hero: QueryResult<MediaItem[]>;
  libraries: QueryResult<Library[]>; // e.g. library tiles below the hero
  sections: readonly HomeSection[]; // each section carries its own QueryResult
}
export interface LibraryPageProps {
  browser: LibraryBrowser;
}
export interface ItemDetailPageProps {
  detail: QueryResult<ItemDetail>;
  similar: QueryResult<MediaItem[]>;
  presentation: Presentation;
  onClose: () => void;
}
export interface SeriesPageProps {
  series: QueryResult<ItemDetail>;
  seasons: QueryResult<Season[]>;
  selectedSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: QueryResult<Episode[]>;
  nextUp: QueryResult<Episode | null>;
  similar: QueryResult<MediaItem[]>;
  presentation: Presentation;
  onClose: () => void;
}
export interface SearchPageProps {
  term: string;
  onTermChange: (term: string) => void;
  results: QueryResult<SearchGroup[]> | null; // null = nothing searched yet
}
export interface FavoritesPageProps {
  groups: QueryResult<FavoriteGroup[]>;
}
export interface SettingsPageProps {
  settings: SettingsModel;
}
export interface PlayerOverlayProps {
  player: PlayerModel;
}
export interface ResumePromptProps {
  item: MediaItem;
  positionTicks: number;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
}
export interface HeroProps {
  items: QueryResult<MediaItem[]>;
  context: RenderContext;
}
export interface RowProps {
  title: string;
  kind: HomeSectionKind;
  items: QueryResult<MediaItem[]>;
  seeAll?: { to: string };
  context: RenderContext;
}
export interface MediaCardProps {
  item: MediaItem;
  variant: CardVariant;
  context: RenderContext;
}
export interface ToastProps {
  kind: 'info' | 'success' | 'error';
  message: string;
  onDismiss: () => void;
}
export interface LoadingStateProps {
  variant?: 'page' | 'section' | 'inline';
}
export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: { label: string; onAction: () => void };
}
export interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
}
```

Compared with the guideline in CLAUDE.md:

- `ResumePrompt` (the resume question) and `Toast` (feedback after actions) are new. Both are visible, theme-specific elements.
- `LoadingState` gets an optional `variant`.
- `ThemeModule.options` for differences that affect the data layer or the routing. Example: Crimson opens details as a modal above the home page (`detailPresentation: 'modal'`).
- `contractVersion`, so that later contract changes are noticed.
- Reusable **shared hooks and building blocks for themes** (all headless or theme-neutral): `<ThemeSlot>`, `useMediaActions()`, `useTrailerPreview()`, `useMotionPreference()`, `useAppearance()`, `<ThemePreview>`, `<JellyImage>`, `<VirtualGrid>`, `<AppLink>`, `useScrubber()`. Focus needs no hook of its own: the navigation works with real DOM focus (§8).
- Pages such as genre, collection and person need no component of their own. They are `LibraryPage` with another `source`.
- **As of phase 7:** `ThemeOptions.cardShape` (`'mixed' | 'landscape'`) controls the card shape of the Classic pages taken over. `presentation: 'modal'` is actually delivered since phase 7 (§7.9).
- **As of phase 4:** the block above is the plan from phase 0; `src/themes/contract.ts` is authoritative. There, among others, `HomePageProps.user`, `RowProps` (`variant`, `seeAll: string | null`), `ResumePromptProps.positionSeconds`, `ToastProps.action` and `ErrorStateProps.variant` are defined more precisely. `THEME_SLOTS` lists all slots at runtime; a compile check fails if a slot is missing from the list. Guide for theme authors: [themes.md](themes.md).

### 7.2 Registry and loading

- `registry.ts` only contains the manifests (small, part of the base bundle) with `load: () => import('./crimson')`. Every theme is its own JS and CSS chunk including fonts and theme texts.
- `ThemeProvider` loads the active theme + the default theme in parallel (`Promise.all`). The default theme is always needed because it provides the fallback. Inactive themes are never loaded. Exception: the live preview loads the theme being looked at (§7.6).
- New theme = folder `themes/<id>/` + one entry in `registry.ts` + text keys. A contract test checks every theme automatically.

```
themes/crimson/
  manifest.ts         # ThemeManifest (static)
  index.ts            # ThemeModule – imports tokens.css, global.css, fonts, components
  tokens.css          # [data-theme="crimson"] { --color-bg: … }
  global.css          # only [data-theme="crimson"] … selectors
  components/*.tsx + *.module.css
  i18n/de.json, en.json
  preview-dark.jpg    # npm run previews
  preview-light.jpg
```

As of phase 4: the IDs of all planned themes are in `config/theme-ids.ts` (also for `DEFAULT_THEME`), name and description in the `themes` namespace. A stored ID without a registry entry falls back to Classic. As of phase 6: `registry.ts` contains Classic and Neon Grid. New in the contract (both optional): `ThemeManifest.features` (e.g. `uiSounds`) and `ThemeModule.texts` (own texts, registered as the namespace `theme-<id>`, §11).

### 7.3 Fallback

`useThemeComponent('MediaCard')` returns `active.components.MediaCard ?? default.components.MediaCard`. The default theme is typed as `ThemeModule & { components: ThemeComponents }` and **must** provide every component. The compiler checks this. Every `<ThemeSlot>` has an error boundary: if a theme component throws, the slot renders the default component and logs the error. A broken theme therefore never takes down the app.

Default components only use the shared semantic tokens. When they run as the fallback in another theme, they automatically take on its colors, fonts and radii.

### 7.4 Tokens and scoping

- `<html>` carries `data-theme`, `data-color-scheme`, `data-motion` (`full`/`reduced`), `data-device` (`desktop`/`tv`/`touch`) and `data-input` (`pointer`/`keyboard`/`touch`).
- `contract.ts` exports `REQUIRED_TOKENS`. Minimum set: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-on-accent`, `--color-focus`, `--color-danger`, `--color-progress`, `--font-body`, `--font-display`, `--font-mono`, `--radius-card`, `--radius-control`, `--shadow-card`, `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-standard`, `--ease-emphasized`, `--focus-ring`.
- A Vitest test reads every `tokens.css`. It checks that all required tokens are defined per color scheme and recalculates the WCAG contrasts: text/background ≥ 4.5:1, focus/background ≥ 3:1.
- Global theme styles live exclusively under `[data-theme="<id>"]`. CSS Modules are isolated by hash anyway. Because theme CSS stays in the document after a switch, scoping is mandatory. A test checks that every rule in `global.css` starts with its own scope.
- Theme-neutral sizes (spacing, z-index, breakpoints, safe area) live in `app/base.css`, outside every theme.
- Building blocks that also run in the live preview (`Hero`, `Row`, `MediaCard`) use container queries and `cqi` instead of `vw`/`position: fixed`. That way they work in a scaled-down container.

### 7.5 Switching and cross-fade

`setTheme(id)` loads the chunk (if needed with a short loading indicator on the picker element) and then swaps with `document.startViewTransition()` and a cross-fade of about 250 ms. Without view transition support, an overlay cross-fades with `opacity`. With reduced motion, the switch happens immediately. There is no page reload; focus and scroll position are kept.

Implementation (`themes/loader.ts`, `themes/transition.ts`): the loader remembers every theme promise with its status and value. `use()` therefore only suspends on the first load, never when switching back. The `ThemeProvider` waits for the new chunk and only then swaps, inside `startViewTransition` with `flushSync` (duration 260 ms in `app/base.css`). Replacement without view transitions: an overlay that fades in over 140 ms and out over 220 ms. The same applies to switching the color scheme. The provider sets `data-theme`, `data-color-scheme` and `data-motion` on `<html>`.

### 7.6 Live preview in the settings **[Decision]**

- The tiles of the theme picker show preview pictures. They are created per theme phase with Playwright in demo mode, so they are real screenshots with placeholder pictures.
- The **live preview** renders `Hero`, `Row` and `MediaCard` of the focused theme with the user's **real data** in a container with its own `data-theme`/`data-color-scheme`, with `context: 'preview'`, `inert` and without focus of its own.
- "Apply" applies the theme globally (§7.5). The color scheme can be switched in the preview if the theme has several.
- Implementation (`themes/ThemePreview.tsx`): the preview shows `Hero` and a "Continue watching" row (without titles in progress, the hero titles). It has its own `ThemeContext`, is laid out 1280 px wide and scaled to the available space through a `ResizeObserver`. Classic's `Hero` and `Row` calculate in `cqi`; outside a container that equals the viewport width. If the theme shown is already active, "This theme is active." replaces the button.

### 7.7 Motion

- Only `transform`, `opacity` and `filter` are animated. A code review rule and an E2E test check that no animation touches layout properties.
- `MotionConfig reducedMotion` follows `data-motion`. `useMotionPreference()` gives themes `'full' | 'reduced'`. With `reduced`, glitch, Ken Burns, parallax, tilt and automatic carousels are dropped. Cross-fades stay, briefly.
- As of phase 4: `data-motion` results from the "Motion" setting (Like the system / Reduced / All animations) and `prefers-reduced-motion`. Classic gets by with CSS transitions, which is why `motion` is not installed yet. It follows with the first theme that needs spring animations.
- As of phase 8: `motion` 13.5 is installed and only loaded in the Glass chunk (base bundle unchanged). Glass uses `LazyMotion` with `domAnimation` (no layout animations), springs for card tilt and lift (`useLift`) and the text change in the hero. `MotionConfig reducedMotion` follows `useReducedMotion()` (component `GlassMotion`). The new major version 14 was one week old at the time and was therefore not taken. An E2E test reads all `transition` and `@keyframes` rules from the CSSOM and checks that only `transform`, `opacity` and `filter` (including `translate`, `scale`, `rotate`) are animated.
- Neon Grid: glitch effects flicker at most 3× per second (WCAG 2.3.1) and never run over body text.

### 7.8 Legal checklist per theme

Before finishing every theme phase: no brand names in code, file names, comments or texts; colors only in a similar mood (distance to known brand colors documented); fonts only freely licensed through `@fontsource`; icons drawn ourselves; no "in the style of" notes in the UI.

- Constellation: background `#0b1533` with a gradient `#13235a` → `#070d22` (deep night blue, ΔE76 ≈ 14 and 17 to the base tones of the model), accent `#2bb6c9` (starlight turquoise instead of brand blue, ΔE76 ≈ 80). No brand logo in the tiles: libraries and collections show their own picture and name. Font Nunito Sans (OFL) instead of the model's house font.
- Horizon: background `#13192a` (dark blue-gray, ΔE76 ≈ 8 to the model's background), accent `#2a63e6` (strong blue, ΔE76 ≥ 32 to the model's blue). Font Figtree (OFL) instead of the model's house font.
- Glass: accent `#4256cf` (dark) or `#2456c8` (light), ΔE76 ≥ 16 and ≥ 12 to the known system blues; the main actions are white or almost black instead of blue. No original font (Inter instead of the model's system font), icons drawn ourselves.
- Crimson: accent `#d31d34`, darker and bluer than the model's red (ΔE76 ≈ 21). No red lettering as a brand: logo and app title as in every theme, title in white. Rating stars `#f2c14e` instead of a known yellow. Font Inter (OFL).
- App icon (2026-10-15): a play symbol cut into three facets in the project's own purple (`#2a1466` square, facets `#d9c9ff`, `#b597ff`, `#8f63ff`); no shape or color of a known brand.

### 7.9 Details as an overlay (phase 7) **[Decision]**

Crimson shows details as a layer above the page they come from (`detailPresentation: 'modal'`). Implemented with react-router's "background location" pattern instead of a modal state of our own:

- **Routing:** the content pages are no longer individual data routes below the shell, but descendant `<Routes>` in `app/routes/ShellRoutes.tsx` (the shell is `path: '*'`, the player stays a data route of its own). An overlay link (`<AppLink overlay>`) writes the current location into the history as `state.backgroundLocation`. `ShellRoutes` then renders the pages with `<Routes location={background}>`, so the page stays mounted, and above it, in a second `<Routes>`, only `/item/:itemId` with `presentation="modal"`. The page below is `inert`.
- **Limits:** only `/item/:itemId` can be an overlay (`navigation/overlay.ts`: `opensAsOverlay`, `backgroundOf`). A background in the state of another route is ignored. Overlay links inside an overlay replace the entry (`replace`) and keep the original background, so Back and Close always land on the page. The season switch replaces the URL (`?season=`) and passes the state on; otherwise the overlay would turn into a page.
- **URL, reload, sharing:** the URL is always the normal detail URL. Without a background (opened directly, reloaded, shared) the same theme shows the details as a page.
- **Focus and page changes:** `useRouteKey()` returns the path of the background page. Opening and closing an overlay are therefore not a page change: no scroll to the top, no focus on `<main>`, no page transitions. The overlay manages the focus (dialog pattern, return to the opening card). `useDocumentTitle` restores the previous title on close.
- **Loading:** page chunks are loaded with `React.lazy`. The overlay has its own suspense boundary so the page below does not vanish while loading.
- **Verification:** `navigation/overlay.test.ts`, E2E `e2e/crimson.spec.ts` (opening, the mouse wheel scrolls only the overlay, Back and Esc with an unchanged scroll position and focus on the card, a title from "More like this" replaces the overlay, opened directly as a page, the season switch stays in the overlay).

---

## 8. Navigation and input

- **Spatial navigation** (norigin v3) with `shouldFocusDOMNode: true`: the library's focus is real DOM focus. That way `:focus-visible`, screen readers and focus = hover work uniformly. **Changed in phase 4:** our own implementation instead of norigin, see §8.1.
- **Focus = hover:** every theme rule for hover is written as `:is(:hover, :focus-visible)` (convention in the theme guide). An E2E test focuses by keyboard, hovers by mouse and compares the computed styles of selected elements.
- **Input mode:** `data-input` changes with the most recent kind of input. With mouse/touch use, spatial navigation stays active but only kicks in with the next arrow key press.
- **Virtualized grid:** the library cannot focus cards that are not rendered. `VirtualGrid` therefore handles the arrow keys itself (index arithmetic), scrolls the virtualizer and then focuses. High risk, built first in phase 2 (R7).
- **Back:** a central back stack. Esc, Backspace (outside input fields), browser back and the back key of TV remotes (e.g. `GoBack`/`BrowserBack`, webOS 461, Tizen 10009) first close an overlay/modal, then `history.back()`.
- **Input fields:** ←/→ move the cursor. Only at the start or end of the text does the focus leave the field.
- **TV mode** (`data-device="tv"`): automatic through a user agent heuristic or fixed by setting (Auto/Desktop/TV). The font size scales with the width (1920 px → 24 px rem, 3840 px → 48 px), an overscan margin of 0–5 % by setting (default 3 %), no hover requirement, larger focus rings.
- **Desktop 4K at DPR 1:** a fluid rem size from 1440 px (16 px → 32 px at 3840 px), so that 3840×2160 does not look tiny.
- **Page changes:** the focus jumps to the heading (keyboard/screen reader) or to the first sensible element (TV). The page title and a live region announce the change.

### 8.1 Implementation in phase 4 **[Decision]**

**Our own DOM-based navigation instead of norigin** (`navigation/spatial.ts`, just under 300 lines, no dependency). norigin requires every focusable component to register through `useFocusable()` and to know its focus keys and parent contexts. Every one of the six themes would have to wire up every card, every button and every menu, and a forgotten element would be unreachable with the remote control. Our solution works only with the geometry of the real DOM: everything reachable with Tab is also reachable with the arrows. Themes need no registration.

- **Choosing the target:** an arrow searches all visible focusable elements for the nearest one in that direction. Candidates have to start beyond the middle of the current element (otherwise a lifted card in the same row would count as "below"). Offset on the cross axis weighs three times as much as the distance, so the focus stays in its row or column. On a tie, the closer center wins. `score()` and `nearest()` are pure functions with unit tests.
- **Layers:** fixed and sticky bars (header, bottom navigation) always lie geometrically above or below the content. They therefore form a layer of their own, which the arrows only reach once the content has nothing left in that direction. From the bar, the arrows only go to elements currently on screen.
- **Scopes:** in open dialogs and menus (`role="dialog"`, `aria-modal`, `role="menu"`, `dialog[open]`) the focus stays inside.
- **Entry point:** without a focused element (or with the focus on `<main>` after a page change), the first arrow jumps to an element with `data-autofocus`, otherwise to the first visible element in the main area.
- **Conventions for themes:** `data-autofocus` marks the entry point of a page when needed; Classic does not need it, because the first visible element ("Play" in the hero) fits. `data-nav-ignore` excludes an element from the arrows; it stays reachable with Tab (skip link). Components with their own arrow logic (grids, tabs, radio groups, menus, timeline) call `preventDefault()`, then the global navigation stays quiet.
- **Fields:** text fields keep ←/→ for the cursor until it is at the start or end. `select` keeps ↑/↓, sliders keep ←/→.
- **Back:** Esc, Backspace outside text fields, `GoBack`/`BrowserBack`/`XF86Back` and the key codes 461 (webOS) and 10009 (Tizen) go back one page as long as there is a previous page in the app. Open overlays handle the key themselves first. In text fields, Backspace and Esc delete as usual.
- **Player:** `claimKeys()` switches the global handling off while the player needs its own keys.
- The handler hangs on `window` in the bubble phase, so it runs after all component handlers. Scrolling uses `scrollIntoView({ block: 'nearest' })`, without animation with reduced motion.

**TV mode** (`navigation/device.ts`, `app/Environment.tsx`): `data-device` is `tv` when the "Input mode" setting is set to TV, or, with "Automatic", when the user agent matches a smart TV or streaming stick (webOS, Tizen, Fire TV, Android/Google TV …). Otherwise `touch` for a coarse pointer without hover, else `desktop`. In TV mode, `font-size: clamp(16px, 100vw / 80, 48px)` applies (1920 px → 24 px, 3840 px → 48 px). The overscan margin (0–5 %, default 3 %) ends up as `--overscan-x`/`--overscan-y` in the page margin `--page-gutter` and in the spacing of the player overlay.

**Verification:** `navigation/navigation.test.ts` (geometry, fields, claimed keys, back key, device detection). E2E in `e2e/settings.spec.ts`: with arrow keys only from the hero through "Continue watching" to a title and back, TV mode at 1920 px, focus = hover for navigation links, buttons, cards, radio group and switch by comparing the computed styles. The layers need a real layout and are therefore only covered by E2E.

---

## 9. Player

### 9.1 Overview

The player consists of a headless engine (`player/`) and the `PlayerOverlay` designed by the theme. The overlay receives a `PlayerModel` (state + commands) and never sees hls.js, URLs or PlaybackInfo. Route: `/play/:itemId` as a full-screen layer above the previous page. The player chunk including hls.js is only loaded when it is needed. It is preloaded on focus of "Play".

### 9.2 Data flow

```mermaid
sequenceDiagram
  participant O as PlayerOverlay (theme)
  participant C as PlaybackController
  participant P as DeviceProfile
  participant S as Jellyfin
  participant E as Engine (native | hls.js)

  O->>C: play(itemId, { startTicks?, audioIndex?, subtitleIndex? })
  C->>P: getDeviceProfile() (detected once per session, cached)
  C->>S: POST /Items/{id}/PlaybackInfo (DeviceProfile, MaxStreamingBitrate, StartTimeTicks, Audio/SubtitleStreamIndex)
  S-->>C: MediaSources[], PlaySessionId
  C->>C: choose source → DirectPlay | TranscodingUrl
  C->>S: GET /MediaSegments/{id} (in parallel; only if available)
  C->>E: load(url, startSeconds)
  E-->>C: playing
  C->>S: POST /Sessions/Playing (start)
  loop every 10 s and on pause, resume, seek, track change
    C->>S: POST /Sessions/Playing/Progress
  end
  C->>S: POST /Sessions/Playing/Stopped (end, close, pagehide with keepalive)
```

### 9.3 DeviceProfile

`capabilities.ts` detects the capabilities once per session. `device-profile.ts` builds the profile from them as a pure function, with unit tests over capability fixtures for Chrome, Firefox, Safari and TV.

- **Video:** H.264 (profile/level through `canPlayType('video/mp4; codecs="avc1.640033"')` etc.), HEVC (`hvc1…`, Main/Main10), AV1 (`av01…`), VP9 (`vp09…`). Where available, `MediaCapabilities.decodingInfo()` adds details for resolution/frame rate (`smooth`) and HDR (`hdrMetadataType`, `transferFunction: 'pq' | 'hlg'`, `colorGamut: 'rec2020'`, plus `matchMedia('(dynamic-range: high)')`). Without HDR capability, HDR sources must not play directly (codec profile condition on `VideoRangeType`); the server then does tone mapping, if configured.
- **Audio:** AAC, MP3, Opus, FLAC, Vorbis, ALAC; AC3/E-AC3 only when `canPlayType` reports them (Safari, Edge). DTS/TrueHD are never played directly; only the audio track is transcoded, video by stream copy. `MaxAudioChannels` from `AudioContext.destination.maxChannelCount` (2 or 6).
- **Containers (direct play):** mp4/m4v, webm, mov (Safari); mkv only in Chromium browsers. `canPlayType` reports empty there although playback works. This is deliberately based on the user agent; the fallback chain catches errors (§9.11).
- **TranscodingProfile:** `Protocol: 'hls'`, `Context: 'Streaming'`, container `mp4` (fMP4) when HEVC is supported, otherwise `ts`; `VideoCodec: 'hevc,h264'` or `'h264'`; `AudioCodec: 'aac,mp3'` (+ac3/eac3 when possible); `BreakOnNonKeyFrames: true`; `MinSegments: 1`.
- **Subtitles:** `vtt` → External. Picture-based formats (`pgssub`, `dvdsub`, `dvbsub`) → Encode (burn-in). ASS/SSA → see [Question 9].
- **Bitrate:** `MaxStreamingBitrate` from the setting. "Automatic" measures once per session with `getBitrateTestBytes` (e.g. 1 MB) and takes 80 % of it, at most the server value.

### 9.4 Choosing the source

1. `SupportsDirectPlay` and no subtitles with burn-in → direct play through the static stream URL, `PlayMethod: DirectPlay`.
2. Otherwise `TranscodingUrl` (remux/transcode, decided by the server) → `PlayMethod: Transcode`. **Checked against jellyfin-web (phase 3):** `SupportsDirectStream` without `SupportsDirectPlay` also uses the static file, reported as `DirectStream`. From fallback level 1 on, the player always takes the `TranscodingUrl`.
3. `PlaybackInfo.ErrorCode` (`NotAllowed`, `NoCompatibleStream`, `RateLimitExceeded`) → an understandable message.

### 9.5 Engines

- **Native** (`<video src>`): direct play and HLS in Safari (`canPlayType('application/vnd.apple.mpegurl')`). The start position is set after `loadedmetadata`.
- **hls.js** (dynamic import, worker active): HLS in all other browsers, `startPosition` in seconds. Fatal errors first through `recoverMediaError()`, then to the controller.
- Both implement the same interface (`load`, `play`, `pause`, `seek`, `setRate`, `destroy`, events). The controller only knows the interface.

### 9.6 Subtitles

- Text subtitles (`DeliveryMethod: External`) are loaded through `getSubtitleApi` as WebVTT and attached to `<track>` as a blob URL. That avoids `crossorigin` on the `<video>`. This matters because direct play streams from another origin would otherwise need CORS headers. Presentation through `::cue` per theme (contrast, size; larger in TV mode).
- Picture subtitles trigger a new PlaybackInfo call with `SubtitleStreamIndex`. The server delivers a `TranscodingUrl` with burn-in.
- Initial selection: user configuration `SubtitleLanguagePreference`/`SubtitleMode` or the server default (`DefaultSubtitleStreamIndex`).

### 9.7 Switching track, quality and speed

- **Audio:** browsers can practically not switch audio tracks in MKV/MP4 (`audioTracks` only exists in Safari). So it is always: a new PlaybackInfo call with `AudioStreamIndex` and `StartTimeTicks` = current position, a new stream. The server then usually only remuxes.
- **Subtitles:** text → only swap the `<track>`, no new stream. Picture → a new stream with burn-in.
- **Quality:** a new PlaybackInfo call with `MaxStreamingBitrate`.
- **Ending the old transcode:** `DELETE /Videos/ActiveEncodings?deviceId=…&playSessionId=…` through `api.axiosInstance`. The endpoint is missing from the SDK 1.0 client because the `HlsSegmentController` is hidden from the OpenAPI through `IgnoreApi`. It exists in 10.10 through 12.x (checked in the Jellyfin source in phase 3). Fallback: the server ends orphaned transcodes by itself.
- **Speed** (0.5–2×): purely client-side through `playbackRate`.
- During the switch the last frame stays on screen and a loading indicator appears. The position does not jump back.

### 9.8 Progress reporting

- `reportPlaybackStart` on the first `playing`. `reportPlaybackProgress` every 10 s and on events (`EventName`: `pause`, `unpause`, `timeupdate`, `volumechange`, `audiotrackchange`, `subtitletrackchange`), each with `PositionTicks` (s × 10⁷), `IsPaused`, `IsMuted`, `VolumeLevel`, `PlayMethod`, `MediaSourceId`, `PlaySessionId`, `AudioStreamIndex`, `SubtitleStreamIndex`, `CanSeek`.
- `reportPlaybackStopped` on end, close, route change and `pagehide`. When the tab closes, the call goes through the SDK method with Axios `fetchOptions: { keepalive: true }`.
- With a paused transcode, `pingPlaybackSession` every 30 s so the server does not end the session.
- After the stop, "Continue watching", "Next up" and the item are invalidated.

### 9.9 Segments, trickplay, chapters

- **Segments:** `getItemSegments({ itemId, includeSegmentTypes: [Intro, Recap, Outro, Preview] })`. If the server returns no segments (no provider plugin), no button appears. Intro/recap → "Skip intro". Outro → the next episode overlay when there is a next episode, otherwise "Skip credits". The button is focused while the segment runs (Enter = skip).
- **Trickplay:** `item.Trickplay[mediaSourceId][width]` with `TileWidth`, `TileHeight`, `ThumbnailCount`, `Interval`. The width closest to 320 px × DPR is chosen. Tile index = `floor(thumb / (TileWidth × TileHeight))`, offset through CSS `object-position`. Tiles are preloaded on the first hover/focus of the timeline.
- **Chapters:** `item.Chapters` → markers on the timeline, chapter list in the overlay.

### 9.10 Resume and next episode

- **Resume question:** if "Play" starts without an explicit choice and there is `PlaybackPositionTicks > 0`, `ResumePrompt` appears (Resume from mm:ss / From the start). The detail page offers both buttons directly.
- **Next episode:** `getEpisodes({ seriesId, startItemId: current, limit: 2 })` → the second entry. The overlay appears when the outro starts, otherwise 30 s before the end, with a 10 s countdown. Cancelling is possible at any time. Whether playback continues automatically is controlled by the setting "Play next episode automatically".

### 9.11 Errors and the fallback chain

```
DirectPlay ──error──▶ PlaybackInfo(EnableDirectPlay=false)            (remux/DirectStream)
           ──error──▶ PlaybackInfo(EnableDirectStream=false,
                                   AllowVideoStreamCopy=false,
                                   AllowAudioStreamCopy=false)       (full transcoding)
           ──error──▶ ErrorState with an understandable message + "Try again"
```

Triggers are `MediaError` (code 3/4), fatal hls.js errors and a stall of more than 15 s without progress despite a buffer. The switch happens at the same position. The user sees a short notice ("Adjusting playback …"), not an error. Messages are distinguished by cause: network, format not supported, server refuses, permissions.

### 9.12 Controls and platform APIs

- **Keyboard:** Space/K play-pause, F full screen, M mute, ←/→ ±10 s, ↑/↓ volume, Esc closes the overlay or the player. With the overlay visible and the focus on a control, the arrow keys move between the controls. On the timeline, ←/→ seek. With the overlay hidden, the arrow keys seek or change the volume directly (the usual TV pattern).
- **Media keys / OS:** `keydown` for `MediaPlayPause`, `MediaPlay`, `MediaPause`, `MediaStop`, `MediaFastForward`, `MediaRewind`, `MediaTrackNext`, plus the Media Session API (metadata, artwork, actions) for system controls, Bluetooth headphones and the lock screen.
- **Full screen** on the player container (the overlay stays visible). On iOS Safari only natively on the `<video>`, then with the system controls.
- **Picture-in-picture:** `requestPictureInPicture`, button only with `document.pictureInPictureEnabled`.
- **Screen Wake Lock** during playback, if available.

### 9.13 Trailer preview in the hero

Uses the same engine, muted, at a low bitrate and without reporting. It only starts after 3 s of calm on the hero, when the "Trailer autoplay" setting is on, motion is not reduced, `saveData` is not set and the device is not a phone. It stops on scrolling, a focus change or a hidden tab.

Implementation (phase 4): `useTrailerPreview(itemId)` in `player/useTrailerPreview.ts` gives the theme `videoRef`, `playing` and `cancel()`. The trailer code (`player/trailer.ts`) is only loaded on start. It requests PlaybackInfo with at most 3 Mbit/s, uses the normal engines and reports nothing to the server. It stops after scrolling more than 120 px, with a hidden tab, when the hero title changes and through `cancel()` (Classic: when the focus leaves the hero). "Touch" is the criterion for phones and tablets (`data-device`). While the trailer runs, the automatic change of the hero carousel pauses. Errors (autoplay forbidden, no trailer) stay silent; the backdrop then stays.

### 9.14 Findings from phase 3

- **Route instead of layer:** `/play/:itemId?start=<s>` is a full-screen route of its own outside the app shell (`app/routes/PlayerRoute.tsx`). Without `start` it asks about resuming and resolves series to the next episode. `usePlayer` (`player/usePlayer.ts`) creates one `PlaybackController` per item; the stage with the `<video>` stays mounted when the episode changes.
- **Engine choice:** Safari → native HLS; otherwise hls.js (light build) as soon as MSE is available. Chrome has also reported native HLS since version 142; hls.js still stays the first choice there.
- **Duration:** `MediaSource.RunTimeTicks` applies. `video.duration` only serves as a substitute when the server returns no runtime.
- **Races:** every stream switch gets a token; older loads expire after every `await`. If the subtitle track is changed during a switch, a new switch starts with the current selection. Whether playback continues afterwards is remembered by the controller, because the element is paused during the switch.
- **Demo server:** range requests from `<video>` lose the range header in the MSW worker (no-cors request, new headers). The handler therefore answers them itself with 206. hls.js requests are not affected.
- **Tests:** `player/controller.test.ts` checks the controller with a test engine against the mock server (direct play, track change, fallback chain, errors, subtitles, stop report, next episode, intro). `e2e/player.spec.ts` plays the real clip in Chromium (direct play, hls.js, fallback, error panel, resume, accessibility).

---

## 10. Settings and persistence

| Setting                                | Storage on the server                                                                     | Across devices                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Theme, color scheme                    | DisplayPreferences                                                                        | yes                                                    |
| Language                               | DisplayPreferences                                                                        | yes                                                    |
| Reduced motion (system/on/off)         | DisplayPreferences                                                                        | yes                                                    |
| Trailer autoplay, UI sounds            | DisplayPreferences                                                                        | yes                                                    |
| Next episode automatically             | `UserConfiguration.EnableNextEpisodeAutoPlay`                                             | yes, also with other Jellyfin clients **[Question 6]** |
| Audio/subtitle language, subtitle mode | `UserConfiguration.AudioLanguagePreference`, `SubtitleLanguagePreference`, `SubtitleMode` | yes, also with other Jellyfin clients **[Question 6]** |
| Max. streaming quality                 | – (local only)                                                                            | no: depends on device and network **[Question 7]**     |
| Input mode (auto/desktop/TV), overscan | – (local only)                                                                            | no                                                     |
| Arrangement (phase 14, §10.1)          | DisplayPreferences (`jellymorph.layout`); default for everybody in `jellymorph-defaults`  | yes                                                    |

- **Local:** zustand with `persist` in `localStorage`, one key per `serverId:userId`. Writes immediately.
- **Server:** `DisplayPreferences` with `displayPreferencesId: 'settings'`, `client: 'jellymorph'`. Our own values as flat keys in `CustomPrefs` with a schema version. Read–modify–write, batched (1 s debounce). Errors while saving lead to a toast with a retry.
- **On sign-in the server value wins:** after sign-in the server values are loaded, overwrite the local ones and are applied (theme switch with a cross-fade if different).
- **Before sign-in:** the theme last used on this device, otherwise `DEFAULT_THEME`.
- Invalid values (e.g. an unknown theme ID from a newer version) are ignored, not applied.

**Implementation in phase 4:**

- **Device settings** (`settings/store.ts`, key `jellymorph.settings`): language and appearance before sign-in, input mode, overscan, player (quality, volume, mute, burn-in).
- **User settings** (`settings/user-settings.ts`, key `jellymorph.user.<serverId>:<userId>`): theme, color scheme, language, motion, trailer autoplay. The values and a `pending` flag are stored. The values used last are also taken over as the device appearance, so the sign-in page and profile picker appear in the same theme.
- **On the server** (`api/preferences.ts`, `hooks/useSettingsSync.ts`): DisplayPreferences `settings` / client `jellymorph`, flat keys `jellymorph.version` (schema 1), `jellymorph.theme`, `jellymorph.colorScheme`, `jellymorph.language`, `jellymorph.motion`, `jellymorph.trailerAutoplay`. Foreign keys in the DTO are kept, because the DTO read last always serves as the basis. Saving therefore needs no new GET.
- **Who wins:** after sign-in (and on every start) the values are read. The server values win, unless there is a local change that has not reached the server yet (`pending`: offline, error, page closed during the wait), or the user changed something while loading. Then the values are saved instead.
- **Saving:** 1 s after the last change. When the page closes (`pagehide`), an unsaved state is sent immediately with `keepalive`. An error shows a toast with "Try again"; the status is also shown at the top of the settings page.
- **Playback settings** (`hooks/usePlaybackPreferences.ts`): `UserConfiguration` is read and written as a whole (`POST /Users/Configuration`), shown immediately and rolled back on errors. The language list comes from `/Localization/Cultures`; `Intl.DisplayNames` translates the names into the UI language.

### 10.1 Arrangement (phase 14)

Four lists can be ordered and thinned out: home page areas, navigation entries, buttons and details of the detail pages (`src/domain/layout.ts`). Per list, the first available level applies: the user's own arrangement, the administrator's default, the theme's arrangement (`ThemeOptions.layout`). Per list, the order (or `null` for "as given") and the hidden entries are stored. Entries a stored order does not know (a new library) are placed behind the entry they follow in the default. The large title picture stays at the top, "Play" stays visible.

- **Own arrangement:** part of the user settings, as JSON in the key `jellymorph.layout`; synchronized as in §10 (the schema version stays 1, old states simply do not have the key).
- **Default for everybody:** Jellyfin has no storage that everybody reads and only administrators write. The app therefore copies the default into a DisplayPreferences document of its own, `jellymorph-defaults`, of every user (administrators may write other users' settings, `RequestHelpers.GetUserId`); everybody reads only their own copy. `jellymorph.layoutVersion` (ISO time) says which copy is newer. When an administrator opens Jellymorph, the app adds missing or older copies in the background (once per browser session and server), so users created later receive the default.
- **Themes** receive the result as props: `HomePageProps.sections` in order, with entries for the title picture and the library tiles; `ItemDetailPageProps.layout` or `SeriesPageProps.layout` with buttons and details; `NavModel.items`. Where a theme shows details in two places (Glass, Horizon, Constellation), the arrangement applies to both.

---

## 11. Internationalization

- i18next with namespaces (`common`, `auth`, `home`, `library`, `item`, `search`, `player`, `settings`, `errors`) plus one namespace per theme (`theme-neon-grid` …), loaded with the theme chunk. Implemented in phase 6: the theme brings `i18n/de.json` and `i18n/en.json` (both languages in the chunk, a few hundred bytes); `themes/loader.ts` registers them with `addResourceBundle` before the theme's first render.
- Only the active language is loaded (dynamic import). German is the default, English can be chosen.
- Typed keys through `CustomTypeOptions` with the German files as the source. A test checks that `en` has exactly the same keys as `de`.
- Date, runtime and numbers through `Intl`. Plurals through i18next plurals (`_one`/`_other`).
- Metadata (titles, overviews) comes in the server's language. The `Accept-Language` header follows the UI language.
- Form of address in German: the informal "du" (as in Crystal). **[Question 11]**

---

## 12. Accessibility

- Semantics: `header`/`nav`/`main`, a heading hierarchy, lists for rows, `button` instead of clickable `div`s. A skip link to the content.
- Focus management on page changes, modals with an `inert` background and a focus trap, focus returns on close.
- A live region for route changes, toasts and player states (e.g. "Subtitles: German").
- Contrast: token test (§7.4) and axe in E2E for every page × theme.
- Player controls with labels. The timeline as `role="slider"` with `aria-valuetext` ("12:34 of 1:45:00").
- Reduced motion as in §7.7. No content reachable only by hover: preview cards also open on focus, every action is also available on the detail page.

---

## 13. Performance and budgets

### 13.1 Base bundle < 250 KB gzip

Definition: everything `index.html` loads statically (entry chunk + static imports + CSS), **without** theme chunks, fonts and images.

| Item                                              | Estimate gzip |
| ------------------------------------------------- | ------------- |
| react + react-dom                                 | ~60 KB        |
| react-router                                      | ~25 KB        |
| axios + the SDK parts used                        | ~25 KB        |
| i18next + react-i18next                           | ~18 KB        |
| TanStack Query                                    | ~13 KB        |
| Spatial navigation (our own, §8.1)                | ~2 KB         |
| motion (`LazyMotion` + `m`, features async)       | ~6 KB         |
| zustand, blurhash                                 | ~2 KB         |
| App code (config, API, hooks, navigation, router) | ~40 KB        |
| **Total**                                         | **~200 KB**   |

Lazy: every theme, the player including hls.js (~140 KB gzip), the library (TanStack Virtual), settings, MSW, language files, Motion features. A CI script (`scripts/check-bundle.ts`, without an additional dependency) reads the Vite manifest, sums up the base graph with zlib gzip and fails above 250 KB. Theme chunks get a soft budget of 80 KB JS gzip (warning).

**Measured (phase 4):** base bundle 179.7 KB gzip, Classic 36.2 KB JS + 13.8 KB CSS gzip.

### 13.2 LCP < 2.5 s (desktop)

The theme and default chunks are loaded in parallel with restoring the session. The hero backdrop gets `fetchpriority="high"` and a fitting `srcset` size; all other images `loading="lazy"` + `decoding="async"`. Featured items are cached per session. Measured with Playwright in demo mode (PerformanceObserver) and, in phase 11, also with Lighthouse (`npx`, not in `package.json`).

**Measured (phase 11, 2026-10-14):** production build in demo mode, signed in, home page, 1920×1080, or Lighthouse 12 with the desktop profile. Lighthouse does not start its own Chromium in this environment; it attaches through `--port` to a Chromium started by Playwright with a signed-in profile (`--disable-storage-reset`).

| Theme         | LCP (Playwright) | CLS   | Lighthouse performance / accessibility / best practices |
| ------------- | ---------------- | ----- | ------------------------------------------------------- |
| Classic       | 1.2 s            | 0.002 | 100 / 100 / 100                                         |
| Neon Grid     | 1.0 s            | 0.003 | 99 / 100 / 100                                          |
| Crimson       | 0.8 s            | 0.001 | 100 / 100 / 100                                         |
| Glass         | 0.8 s            | 0.008 | 100 / 100 / 100                                         |
| Horizon       | 1.3 s            | 0.001 | 99 / 100 / 100                                          |
| Constellation | 1.3 s            | 0.000 | 99 / 100 / 100                                          |

Total blocking time 0 ms everywhere, no long tasks. Found and fixed: the hero placeholders of Horizon and Constellation were too short by the line with the dots (CLS 0.05), and Constellation's centered bar moved while the libraries loaded. The remaining Lighthouse notes only concern cache headers (set by nginx in the container, not by `vite preview`) and that the LCP image of an SPA is not in the first HTML.

### 13.3 60 fps and no layout shifts

- Card containers have a fixed `aspect-ratio`. The BlurHash is decoded on a 32×32 canvas, cached per hash, and scaled up underneath. The image fades in through `opacity`.
- Only `transform`/`opacity`/`filter` are animated. `will-change` only briefly. `content-visibility: auto` for rows outside the viewport.
- `backdrop-filter` (Glass) and SVG/filter effects (Neon Grid) have reduced variants in TV mode and on weak hardware (R9).

---

## 14. Security

- **Token:** `localStorage` (needed for persistence). The XSS risk is limited by a strict CSP without `unsafe-inline`/`unsafe-eval` and by rendering without `dangerouslySetInnerHTML`. Server texts (overviews) are always rendered as text.
- **CSP** (rendered by the entrypoint, phase 5):
  ```
  default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self';
  img-src 'self' data: blob: https: <JF>; media-src 'self' blob: <JF>;
  connect-src 'self' <JF> <JF-WS>; worker-src 'self' blob:; manifest-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```
  `<JF>`: with `LOCK_SERVER`+`JELLYFIN_URL` exactly that origin; in proxy mode nothing additional; otherwise `https: http:` or `wss: ws:`, because the user may add any server. `img-src https:` applies in every mode (since phase 13): the browser loads the picture suggestions of the metadata providers in the admin dialogs directly from their sites; Jellyfin only delivers the addresses and has no image proxy for them. The hls.js worker needs `worker-src blob:`. Inline styles through React's `style` prop set CSSOM properties and are allowed without `unsafe-inline`.
- No secrets in the repo. `.env.local` is in `.gitignore`. Demo data contains no real people or brands.
- `rel="noopener noreferrer"` for external links. `Referrer-Policy: strict-origin-when-cross-origin`. `Permissions-Policy` only allows `fullscreen`, `picture-in-picture`, `autoplay` and `screen-wake-lock` for `self`.
- **Implementation (phase 5):** the CSP is created in the entrypoint as above. Demo mode and proxy mode only allow the own origin, `LOCK_SERVER` exactly the origin from `JELLYFIN_URL` (plus `ws`/`wss` of the same address), otherwise `https: http:` or `wss: ws:`. Added are `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin` and a `Permissions-Policy` that explicitly blocks camera, microphone, location, payments and USB. The CSP is **verified** by the CI running the complete E2E suite against the running container in demo mode. A fixture (`e2e/fixtures.ts`) fails every test that triggers a CSP violation.

---

## 15. Docker and operation

Plan from phase 0, implemented in phase 5 (deviations and details in §15.1):

- **Build stage** `node:24-alpine` (through `mirror.gcr.io/library/node`, see below) on `$BUILDPLATFORM`: the static result is independent of the architecture; only the nginx stage is built per architecture. That saves QEMU time for arm64.
- **Runtime** `nginx-unprivileged:1.31-alpine` from the vendor NGINX, pulled from `ghcr.io/nginx/nginx-unprivileged` (the same image as `nginxinc/nginx-unprivileged` on Docker Hub), port 8080, non-root (UID 101).
- **Without Docker Hub (since 2026-10-13):** GitHub runners share IP addresses, so anonymous Docker Hub pulls run into the pull limit, and on 2026-10-09 Docker Hub's authentication failed as well (504, timeouts). Both made the Docker job fail although the code was green. Since then all images come from registries without this limit: Node, the Dockerfile frontend (`# syntax=`), BuildKit and QEMU (`tonistiigi/binfmt`) through Google's Docker Hub mirror `mirror.gcr.io`, nginx-unprivileged from the vendor on `ghcr.io`. Both registries provide tag lists, so Dependabot keeps proposing updates (the ignore rule for Node major versions applies through the pattern `*node`).
- **Entrypoint:** validates the variables (theme ID against the list, booleans, URL format), writes `config.js` with JSON escaping, renders the nginx site (CSP, optional `/jellyfin/` proxy with WebSocket upgrade) and `manifest.webmanifest` (name from `APP_TITLE`) to `/tmp/jellymorph`.
- **Read-only root FS:** the only write path is `/tmp` (tmpfs), documented in the README and Compose.
- `/healthz` → 200 from nginx. Docker `HEALTHCHECK` with `wget`.
- **PWA:** manifest and icons 192/512/maskable/Apple (created by `scripts/render-icons.ts` from the SVG logo through Playwright, no new dependency). No service worker (§15.1).
- **Local:** Docker is not installed on this machine. The CI checks the container (§15.1).

### 15.1 Implementation (phase 5)

**Files:** `Dockerfile`, `.dockerignore`, `docker/nginx.conf` (main configuration: PID, temp paths and logs to `/tmp` or stdout/stderr, gzip), `docker/nginx.conf.template` (site), `docker/proxy.conf.template` (proxy), `docker/entrypoint.sh`, `docker-compose.yml`, `public/manifest.webmanifest`, `public/icons/`.

**Entrypoint** (POSIX `sh`, BusyBox-compatible): replaces the base image's entrypoint so its scripts do not write to `/etc/nginx`. It reads and checks all variables and **stops on invalid values**, with a message naming the variable and the allowed values. The app itself would ignore invalid values (§4.1); but a container that silently runs with defaults because of a typo is only noticed much later. Then it writes to `/tmp/jellymorph`: `config.js`, `manifest.webmanifest` (from `public/manifest.webmanifest`, name and short name from `APP_TITLE`), `headers.conf` (security headers, §14), `site.conf` (through `envsubst` with a fixed list of variables, so nginx variables stay untouched) and `proxy.conf` (empty without the proxy). Control characters in `APP_TITLE` are removed, backslash and quotes are escaped for JSON. URLs may only contain characters that are safe without escaping in JSON, the CSP and the nginx configuration. A unit test compares the entrypoint's theme list with `config/theme-ids.ts`.

**Cache headers:** `/assets/*` (hash in the name) `public, max-age=31536000, immutable`, missing assets 404 (never the app shell, otherwise an outdated tab would get HTML instead of JavaScript). `index.html`, `config.js`, `manifest.webmanifest` and `mockServiceWorker.js` `no-cache`. Other public files (icons) one day. All other paths serve `index.html` (SPA fallback). Hidden files are 404; the build manifest (`.vite/`) is deleted in the image anyway.

**Proxy:** `proxy_pass` with a variable and `resolver` from `/etc/resolv.conf`. That way the container also starts when Jellyfin is not reachable yet (502 until then), and it follows a Jellyfin container that gets a new address. Path and query are passed on unchanged from `$request_uri`; encoded characters such as `%2F` are kept. WebSocket upgrade, `X-Forwarded-*` headers (an upstream TLS proxy keeps its `X-Forwarded-Proto`), no buffering, idle timeouts of one hour. Limitation: nginx does not use search domains, so Kubernetes needs the full DNS name.

**No service worker** (deviation from the plan above). Chrome offers "Install app" since version 108 (Android) and 112 (desktop) also without a service worker, and it ignores empty fetch handlers anyway. A real fetch handler would sit in front of every API and media request (range requests when seeking), without offline features, which the spec explicitly does not ask for. The demo mode would also need the same scope for MSW. Chrome's automatic install prompt is therefore dropped; installing goes through the browser menu (Safari: "Add to Home Screen").

**Checks in the CI** (`scripts/test-container.ts`, Docker job in `ci.yml`): build for amd64 and arm64, then with the amd64 image, each time `--read-only --tmpfs /tmp --cap-drop ALL`: health check and the `HEALTHCHECK` command, UID 101, `config.js` with default and special values (quotes, backslash, umlaut in the title), CSP per mode, cache headers, gzip, SPA fallback, 404 for missing assets and hidden files, manifest and icons, any UID (e.g. Kubernetes `runAsUser`), stopping on six invalid settings, the proxy against a small Node server standing in for Jellyfin (start before Jellyfin, then forwarding with path, query and headers, `/jellyfin` → `/jellyfin/`, WebSocket) and finally the complete E2E suite in demo mode under the real CSP.

**Publishing** (`release.yml`): on a push to `main` and on tags `v*`, the complete CI runs first (`ci.yml` through `workflow_call`; `ci.yml` itself reacts to pushes to other branches and to pull requests, so `main` is not checked twice). Then `docker/build-push-action` builds the multi-arch image and pushes it to `ghcr.io/lua-x/jellymorph`, tags through `docker/metadata-action`: `main` → `edge`; `v1.2.3` → `1.2.3`, `1.2`, `1` (not for 0.x) and `latest` (not for pre-releases such as `v1.0.0-rc.1`). Labels and annotations (also on the image index) link the package to the repository. For tags a GitHub release follows; `scripts/changelog.ts` generates the notes from the Conventional Commits since the last tag (breaking changes, new, fixed, faster). **Dependabot** checks npm (tooling grouped), Docker base images (without Node major versions) and Actions weekly.

### 15.2 Own styling (phase 14)

A mounted folder `/custom` (may be read-only) takes own stylesheets, fonts and pictures. On start, the entrypoint looks for `custom.css` (for every theme) and `<theme-id>.css` and writes the result as `customCss` into `config.js`; the app appends the files as `<link>` at the end of `<head>`, the theme file only while the theme is active (`themes/custom-styles.ts`). nginx serves only CSS, fonts (woff2, woff, ttf, otf) and pictures from `/custom/`, without caching, with the usual security headers; everything else is 404. Because they are files of the own origin, the CSP needs no exception (no injected CSS, `style-src 'self'` stays). The public interface for own CSS is the tokens (§7, docs/themes.md §4) and the attributes `data-theme`, `data-color-scheme`, `data-device` and `data-motion` on `<html>`; the components' classes carry generated names and change with every version. In the development and test server, `CUSTOM_DIR` plays the role of the folder (Playwright: `e2e/fixtures/custom`, also mounted in the container test).

---

## 16. Tests and CI

| Level       | Tool                                                         | Content                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                                                       | Mappers, DeviceProfile from capability fixtures, source choice, fallback chain, trickplay math, segments, reporting cadence (fake timers), settings merge, config validation, token contrasts, i18n key parity, contract test for every theme                       |
| Integration | Vitest + RTL + MSW (Node)                                    | Hooks against the mock Jellyfin, default pages with loading/empty/error state                                                                                                                                                                                       |
| E2E         | Playwright + MSW (browser, demo mode) against `vite preview` | Sign-in (password, Quick Connect, profiles), home, library (sorting, filters, jump bar), details, series, search, favorites, settings/theme switch, player (direct play, transcoding fallback, tracks, segments, next episode), **keyboard-only walkthroughs**, axe |
| Screenshots | Playwright script                                            | 1920×1080, 3840×2160, 1280×800, 390×844 × pages × active themes → `artifacts/screenshots/` (not in the repo). I look at them in every UI phase.                                                                                                                     |

**Mock Jellyfin:** MSW handlers for every endpoint used, with stateful fixtures (favorite, played and progress really change). A script generates the fixtures: about 60 movies, 12 series with seasons and episodes, an anime library, collections, genres, 3 public profiles, segments, trickplay, chapters. **Images** are generated SVG gradients with a made-up title. The BlurHashes are calculated from the same gradient data. **Demo video:** a self-made test pattern with sound. Without ffmpeg on this machine (§19, [Question 13]).

**CI (`ci.yml`, phase 1):** `npm ci` → lint → typecheck → test → build → bundle budget → Playwright (Chromium; WebKit and Firefox as a smoke test for codec differences) → artifacts (report, screenshots). From phase 5 also a Docker job (§15.1). As of phase 5: Playwright runs with Chromium (desktop and Pixel 7); WebKit and Firefox are not included yet.

---

## 17. Phase plan in detail

| Phase              | Result                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation       | Vite/TS/ESLint/Prettier/Vitest/Playwright, `ci.yml`, import rules, config + dev plugin, API layer (client, device, server, session, errors), sign-in (password, Quick Connect, profile picker, several servers), MSW mock with a fixture generator + demo mode, i18n (de/en), bundle budget script, a minimal shell of the default theme for the auth pages. Checking the device ID question (R6). |
| 2 Default theme    | Domain types + mappers, all hooks from §6.2, theme slot mechanics (default only at first), home, library (VirtualGrid including keyboard navigation first), details, series, search, favorites, toasts, all loading/empty/error states, WebSocket invalidation.                                                                                                                                    |
| 3 Player           | Capabilities, DeviceProfile, PlaybackInfo, engines, subtitles, track/quality switching, reporting, segments, trickplay, chapters, resume, next episode, fallback chain, Media Session, trailer preview engine.                                                                                                                                                                                     |
| 4 Theme system     | Registry with lazy loading, fallback + error boundary, token/scope tests, switching with a cross-fade, settings (everything from §10) with a live preview, persistence local + server, spatial navigation across all pages, TV mode.                                                                                                                                                               |
| 5 Docker & release | Dockerfile, nginx template, entrypoint, Compose, PWA, `release.yml`, Dependabot, Docker job in the CI.                                                                                                                                                                                                                                                                                             |
| 6–10 Themes        | Per theme: tokens, fonts, all deviating components, motion, reduced variant, TV variant, preview picture, legal checklist, screenshot review.                                                                                                                                                                                                                                                      |
| 11 Polish          | README with screenshots (German at the time, English since 2026-10-15), `docs/themes.md`, performance and a11y audit, changelog, release v1.0.0.                                                                                                                                                                                                                                                   |

---

## 18. Risks

| #   | Risk                                                                                                        | Impact                                                          | Countermeasure                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | SDK 1.0.0 is generated against 12.0; the behavior (not the paths) may differ on 10.10/10.11                 | wrong results, e.g. filters                                     | Paths verified (§1.2). Mappers tolerant of missing fields. Manual smoke tests against real 10.10/10.11/12.0 servers ([Question 2]). |
| R2  | `ActiveEncodings` is missing from the SDK                                                                   | orphaned transcodes when switching tracks                       | Hand-written call through the SDK's Axios (§9.7); confirmed in phase 3: the endpoint exists in 12.x                                 |
| R3  | Codec detection in the browser is imprecise (HEVC on Windows only with an extension, mkv special case, HDR) | direct play fails                                               | Fallback chain (§9.11), capability fixtures per browser                                                                             |
| R4  | Switching audio tracks with direct play is impossible                                                       | a track switch needs a new stream                               | Deliberately always a new stream at the same position (§9.7)                                                                        |
| R5  | CORS/mixed content without the proxy (HTTPS client + HTTP server, server without CORS permission)           | sign-in fails                                                   | A clear error message pointing to `JELLYFIN_PROXY_TARGET`; proxy mode recommended as the default in Compose                         |
| R6  | Device ID: several users on the same device push each other out                                             | switching profiles signs out others                             | Check on the server in phase 1, if needed a device ID per user                                                                      |
| R7  | Spatial navigation × virtualization                                                                         | the focus gets lost in the grid                                 | Own arrow key logic in `VirtualGrid`, secured early in phase 2 with E2E                                                             |
| R8  | The base budget of 250 KB is tight (~200 KB estimated)                                                      | budget exceeded                                                 | Budget check in the CI from phase 1, aggressive lazy loading                                                                        |
| R9  | `backdrop-filter`, glow, glitch, filters on TV hardware                                                     | stutter below 60 fps                                            | TV/low-power variants, effects on small areas, `@supports` fallbacks                                                                |
| R10 | Neon effects vs. readability/seizures                                                                       | a11y violation                                                  | ≤ 3 flashes/s, never over body text, reduced motion switches them off, contrast tests                                               |
| R11 | Insecure contexts (HTTP on the LAN)                                                                         | no service worker/PWA, no wake lock, MSW demo only on localhost | Hide features through feature detection, a note in the README                                                                       |
| R12 | Autoplay policies of the browsers                                                                           | trailers do not start                                           | Muted only, ignore errors silently and show Ken Burns                                                                               |
| R13 | Themes look too close to brand interfaces                                                                   | legal risk                                                      | Checklist §7.8, own names, own icons, no exact colors                                                                               |
| R14 | Docker not available locally                                                                                | container errors only visible in the CI                         | Docker job in the CI with runtime tests ([Question 12]); implemented in phase 5 (§15.1)                                             |
| R15 | No ffmpeg locally                                                                                           | no HLS test material for the demo mode                          | [Question 13]                                                                                                                       |

---

## 19. Open questions

**As of 2026-10-07:** all recommendations were accepted. Question 2 (own server) is still open. Details are in CLAUDE.md §12.

Every question has a recommendation. Without objection I would follow the recommendation.

1. ~~**Project name, repo, image.**~~ **Answered 2026-10-07:** _Jellymorph_, repo `Lua-x/jellymorph`, image `ghcr.io/lua-x/jellymorph`. The default theme is therefore called "Classic" (see CLAUDE.md §12).
2. **Test server.** Which Jellyfin version do you run, and is there an address for `JELLYFIN_DEV_URL` (stays in `.env.local`, never committed)? Ideally also one 10.10 and one 12.0 test server each. Recommendation: at least your server + a 12.0 test container in the CI for smoke tests.
3. **Browser/TV targets.** Does §1.4 fit? Which TVs or streaming sticks do you actually want to use? That decides how conservative I have to be with CSS and effects.
4. **Additional dependencies from §2.2** (`blurhash`, `@axe-core/playwright`, test and ESLint companions). Recommendation: approve.
5. **`DEMO_MODE` as an additional container variable** (default `false`). It would allow running a public demo, for example. The MSW chunk is in the build anyway, because E2E runs against the production build, but it is only loaded in demo mode. Recommendation: yes.
6. **Store language, subtitle and autoplay settings in the Jellyfin user configuration instead of our own DisplayPreferences?** Advantage: they also apply in jellyfin-web and the official apps; the server uses the values for default tracks anyway. Disadvantage: changes take effect there too. Recommendation: yes, user configuration.
7. **Max. streaming quality and input mode only locally per device** (not synchronized), because they depend on device and network. Recommendation: yes.
8. **Several remembered profiles per device** (one token per user) for "Who's watching?" without entering the password again? Each profile can be signed out on its own. On shared devices this means: whoever has the device can open every remembered profile. Recommendation: yes, with a switch "Remember profile on this device" at sign-in.
9. **ASS/SSA subtitles** (common with anime): by default let the server convert them to WebVTT (no transcoding, but without styling) plus a setting "Burn in styled subtitles" (styling stays, costs server transcoding). Real ASS rendering in the browser (JASSUB) would be a large WASM dependency. Recommendation: VTT + the burn-in option, no JASSUB.
10. **Unsupported library types** (music, books, photos, live TV, playlists): hide them in v1? Recommendation: hide, plus a discreet note in the settings.
11. **Form of address in German UI texts:** "du" as in Crystal? Recommendation: yes.
12. **Check Docker only in the CI** (as in Crystal, no local Docker)? Recommendation: yes.
13. **Demo video without ffmpeg:** record a test pattern + sound through Chromium's MediaRecorder with Playwright (WebM/MP4 for the direct play path; no new dependency). Unit tests with hls.js doubles plus your real server test the HLS path. Alternative: install ffmpeg once through `winget`; then there would also be an HLS variant in demo mode. Recommendation: MediaRecorder; ffmpeg only if you want to install it anyway.
14. **License** for the public repo: Crystal is AGPL-3.0. For a pure client, MIT or GPL-3.0 would also be common. I do not take over code from jellyfin-web (GPL-2.0). Recommendation: AGPL-3.0 like Crystal, unless you have another preference.
