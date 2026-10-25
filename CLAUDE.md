# CLAUDE.md – Jellyfin Theme Client

Project name: **Jellymorph** · Repo: `github.com/Lua-x/jellymorph` · Image: `ghcr.io/lua-x/jellymorph`

This file is the binding specification. Read it completely at the start of every session. Only deviate from it after asking. Keep section 11 (status) and 12 (decisions) up to date.

The user writes in German; summaries and questions to the user stay in German. This file, the README, the docs and everything else visible on GitHub are in English (user decision 2026-10-15).

## 1. Product goal

A standalone, self-hosted web client for Jellyfin, run as a Docker container. The user signs in to their Jellyfin server and chooses a theme in the settings.

A theme is not a color scheme but a complete way of using the app: layout, navigation, card shapes, detail pages, player overlay and animations. Six themes take their cues from the structure of large streaming services (four from the start, two more after 1.2), one is a cyberpunk design of our own.

Quality bar: the app should feel like a finished commercial product, not like a demo. Smooth animations (60 fps), no layout shifts, immediate feedback on every interaction, well-thought-out loading, empty and error states.

## 2. Legal guardrails (not negotiable)

- No logos, brand names, word marks, original fonts, icons or graphics of Netflix, Apple, Amazon, Disney or other providers – neither in code, assets, UI nor file names.
- Only layout principles and interaction patterns are taken over. Colors: a similar mood, no exact brand colors.
- Themes carry their own neutral names. No notes like "in the style of …" in the UI.
- README: only a general note that the themes take their cues from common streaming interfaces, plus a disclaimer (no affiliation with the providers, no trademark rights).
- Only fonts with a free license, self-hosted through @fontsource (no CDN dependency).
- Demo/mock data uses no real posters, but generated placeholder pictures.
- Title logos, posters and backdrops of the user's own media come exclusively from the Jellyfin server.

## 3. Tech stack

| Area         | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Framework    | React (current stable version) + TypeScript (strict) + Vite                           |
| API          | @jellyfin/sdk – no hand-written fetch where the SDK offers a method                   |
| Server state | TanStack Query (caching, background refresh, request cancellation)                    |
| App state    | zustand (session, settings, theme)                                                    |
| Routing      | react-router                                                                          |
| Lists        | TanStack Virtual for large libraries                                                  |
| Playback     | hls.js (Safari: native HLS)                                                           |
| Animation    | Motion (Framer Motion)                                                                |
| Navigation   | Spatial navigation for remote controls, e.g. @noriginmedia/norigin-spatial-navigation |
| Styling      | CSS Modules + design tokens as CSS custom properties per theme                        |
| i18n         | i18next – German (default), English                                                   |
| Tests        | Vitest + React Testing Library, MSW as mock Jellyfin, Playwright (E2E + screenshots)  |
| Code quality | ESLint, Prettier, Conventional Commits                                                |

No further major dependencies without asking.

## 4. Architecture

### Basic principle

Strict separation: the data layer and logic are theme-independent (headless). Themes only contain presentation and motion. A theme never makes API calls of its own, but uses the shared hooks exclusively.

### Folder structure

```
src/
  app/            # bootstrapping, router, providers
  config/         # runtime configuration (window.__APP_CONFIG__)
  api/            # SDK instance, auth, device/client info, image URL helpers
  hooks/          # headless: useHomeSections, useLibrary, useItem, useSeries,
                  #           useSearch, useFavorites, usePlayback …
  player/         # DeviceProfile, PlaybackInfo, hls.js, reporting, segments, trickplay
  navigation/     # focus/spatial navigation, keyboard shortcuts
  settings/       # settings store and persistence
  i18n/
  themes/
    contract.ts   # theme contract (types)
    registry.ts   # all themes, lazy loading
    ThemeProvider.tsx
    default/      # reference theme, fallback for every component
    neon-grid/
    crimson/
    glass/
    horizon/
    constellation/
    cobalt/
    onyx/
  mocks/          # MSW handlers + fixtures (demo mode)
docker/
  nginx.conf.template
  entrypoint.sh
e2e/              # Playwright
docs/             # architecture.md, themes.md
.github/workflows/
```

### Theme contract (guideline, refine in phase 0)

```ts
import type { ComponentType } from 'react';

export interface ThemeManifest {
  id: string; // 'neon-grid'
  nameKey: string; // i18n key of the display name
  descriptionKey: string; // i18n key of the short description
  preview: string; // preview picture for the settings
  colorSchemes: Array<'dark' | 'light'>;
  load: () => Promise<ThemeModule>; // its own lazy chunk
}

export interface ThemeModule {
  components: Partial<ThemeComponents>;
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
  Hero: ComponentType<HeroProps>;
  Row: ComponentType<RowProps>;
  MediaCard: ComponentType<MediaCardProps>;
  LoadingState: ComponentType;
  EmptyState: ComponentType<EmptyStateProps>;
  ErrorState: ComponentType<ErrorStateProps>;
}
```

Rules:

- If a theme lacks a component, the default theme's component is used automatically.
- All theme tokens and global theme styles are scoped under `[data-theme="<id>"]`, so themes do not affect each other when switching.
- Switching themes without reloading the page, with a short cross-fade.
- Inactive themes are not loaded.
- New theme = new folder + one registry entry. Documented in docs/themes.md.

### Runtime configuration

On start, the container writes `config.js` (`window.__APP_CONFIG__`). The app reads it before rendering. No configuration is baked in at build time.

## 5. Feature set (applies to every theme)

### Server & sign-in

- Enter the server URL, check reachability and version (`/System/Info/Public`), store several servers.
- Sign-in with user name/password and Quick Connect; profile picker through public users, if the server shows them.
- Only store the access token, never the password. Signing out ends the session on the server.
- Minimum version Jellyfin 10.10. Cleanly hide features the server does not support.

### Home page (same content, arrangement per theme)

- Hero/featured with backdrop and title logo
- Continue watching, next up, recently added per library, favorites, genres, collections
- Respect the user's library order and hidden libraries

### Libraries

- Virtualized grid, sorting (title, date added, release year, rating)
- Filters (genre, year, watched/unwatched, favorites), alphabetical jump bar
- Movies, series, anime depending on the library type, collections

### Detail pages

- Movie: backdrop, logo, metadata (year, runtime, rating, community rating, genres), overview, cast, available audio/subtitle tracks, play/resume/from the start, local trailer, favorite, mark as played, similar titles
- Series: season selection, episode list with progress, next episode highlighted

### Search

- Live search with debounce, results grouped by type, usable with a remote control

### Player

- Create the DeviceProfile from the real browser capabilities (canPlayType / MediaCapabilities) and pass it to PlaybackInfo. Direct play when possible, otherwise HLS transcoding.
- Audio and subtitle choice. Text subtitles as WebVTT, picture subtitles (PGS/VobSub) through burn-in transcoding. A track switch starts a new stream at the same position when needed.
- Quality choice (max. bitrate), speed, full screen, picture-in-picture
- Trickplay preview pictures on the timeline, if available
- "Skip intro" / "Skip credits" through the MediaSegments API, if available
- Next episode overlay with a countdown, autoplay can be switched off
- Resume question and progress reporting to Jellyfin (start, progress every 10 s, pause, stop), so "Continue watching" is right across devices
- Keyboard shortcuts: Space, F, M, ←/→ (±10 s), ↑/↓ (volume), Esc; media keys of the remote control
- On playback errors: an understandable message and an automatic fallback to transcoding

### Settings

- Theme choice with preview pictures and a live preview; color scheme if the theme has several
- Language, reduced motion, trailer autoplay, next episode automatically, default audio/subtitle language, max. streaming quality
- Change server, sign out
- Stored locally (immediately) and per user through the DisplayPreferences API (across devices). On sign-in the server value wins.

### Input & platforms

- Mouse, touch, keyboard and remote control (arrows, Enter, Back)
- Every interactive element is focusable. The focus state is at least as clear as the hover state – in every theme: focus = hover.
- Responsive: phones from 360 px, tablet, desktop, TV in 1080p and 4K (10-foot UI with larger type and an overscan margin)
- Installable as a PWA (manifest, icons; no offline caching of media)
- Pictures always with a BlurHash placeholder from Jellyfin

## 6. Themes

For all of them: `prefers-reduced-motion` and the "Reduced motion" setting are respected. Only `transform`, `opacity` and `filter` are animated.

### default – "Classic"

Plain and functional. Reference implementation of every component, fallback for other themes and template in the theme guide.

### neon-grid – "Neon Grid" (our own theme, the project's flagship)

Futuristic, cyberpunk. Should look by far the most distinctive.

- Colors: almost black background, neon magenta and cyan as the main accents, yellow for actions and warnings; glow through `text-shadow` / `box-shadow`
- Shapes: beveled corners (`clip-path`), HUD frames with corner marks, a perspective grid in the background
- Effects: glitch on focus and page change, chromatic aberration on pictures on focus, subtle scanlines, text scramble when titles appear
- Sign-in as a boot sequence (skippable, only once per session)
- Terminal-style search with a blinking cursor
- Progress bars as segmented energy bars, metadata as HUD data fields
- Player overlay as a HUD with time, chapters and tracks
- Fonts: e.g. Orbitron or Rajdhani for headings, Share Tech Mono or JetBrains Mono for data
- Optional UI sounds, off by default
- Readability comes first: text contrast at least WCAG AA, effects never over body text

### crimson – "Crimson"

Model: Netflix

- Profile picker "Who's watching?" with large avatars of the Jellyfin users
- Navigation at the top, transparent over the hero, opaque when scrolling
- Large hero with backdrop, title logo and a short overview; after about 3 s a muted local trailer (if available and allowed), otherwise a slow Ken Burns effect
- Horizontal rows with edge arrows and landscape cards; on hover/focus, after about 400 ms, an enlarged preview card with play, favorite, info and metadata
- Detail view as a modal above the home page, episodes directly in the modal
- Almost black background, deep red as the accent; font e.g. Inter

### glass – "Glass"

Model: Apple TV

- A centered pill-shaped tab bar at the top with a blurred background
- Full-screen hero carousel with automatic change and a page indicator
- tvOS focus effect: the card lifts, a slight 3D tilt towards the pointer, light reflection
- Frosted glass surfaces (`backdrop-filter`), lots of white space, large radii, calm spring animations
- Detail page: full-screen backdrop with a gradient, title logo instead of text, glass buttons
- Light and dark mode; font e.g. Inter

### horizon – "Horizon"

Model: Prime Video

- Navigation at the top with text links, profile on the right
- Hero carousel with side arrows
- Rows with 16:9 cards; on hover/focus the card unfolds downwards (overview, runtime, buttons)
- Detail page with tabs: episodes, related, details
- Dark blue-gray, a strong blue as the accent

### constellation – "Constellation"

Model: Disney+

- Below the hero a row of large tiles for libraries and collections, glow frame on focus
- Dark blue gradient background with a subtle star field
- On desktop/TV a narrow icon side bar that expands on focus
- Rounded cards with a soft shadow, slight scaling on focus

### cobalt – "Cobalt"

Model: Paramount+ (added 2026-10-25)

- Deep night blue as a gradient, a strong cobalt blue as the accent (deliberately not the brand blue), white main buttons
- Title stage over the full width under a transparent bar: title logo, short facts and buttons at the bottom left; along the bottom a filmstrip of small pictures of the next titles that can be chosen directly; the active one fills with a progress bar until the change
- Rows with portrait posters as the default, only "Continue watching" and "Next up" in landscape with progress; on focus a white frame, slight enlargement, title and year appear
- Libraries as a row of tiles like channel tiles (colored gradient with the library picture) directly below the stage
- Detail page: picture large on the right, logo, facts and buttons on the left; below it the season choice as a pill and the episodes as a list with still and overview, then "More like this" as a poster row
- Player: the Classic player in Cobalt colors (timeline in cobalt); a free font no other theme uses (e.g. Manrope)

### onyx – "Onyx"

Model: HBO Max (added 2026-10-25)

- Almost black with a cool blue shimmer at the top and behind the stage, white main buttons, plain editorial typography
- A fixed side panel on the left with text on desktop and TV, divided into areas (Home, Series, Movies, Libraries, My list); on phones a bar at the bottom
- A very tall "spotlight" stage (about four fifths of the window) with a large title logo and a blue light edge, changing with dots
- Rows of landscape cards with the title below; a ranked row "Top rated" with large numbers next to the posters (Jellyfin has no play counts across users)
- "New and coming soon": recently added titles and upcoming episodes (Jellyfin `/Shows/Upcoming`, a new shared hook)
- Detail page: stage over the full width, below it season chips and episodes as a sideways row of large stills, then "More like this" and "Extras" (local trailers)

## 7. Docker & operation

- Multi-stage Dockerfile: Node (build) → `nginxinc/nginx-unprivileged:alpine` (non-root, port 8080)
- nginx: SPA fallback, gzip, cache headers (hashed assets immutable, `index.html` and `config.js` no-cache), security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- The entrypoint writes `config.js` from environment variables and renders the nginx config through envsubst. Configuration changes need no rebuild.
- Health check endpoint `/healthz`; operation with a read-only root filesystem possible (document the needed write paths as tmpfs)
- Example `docker-compose.yml` in the repo

| Variable                | Purpose                                                                    | Default      |
| ----------------------- | -------------------------------------------------------------------------- | ------------ |
| `JELLYFIN_URL`          | Pre-fill the server URL                                                    | empty        |
| `LOCK_SERVER`           | Server URL fixed, cannot be changed in the UI                              | `false`      |
| `JELLYFIN_PROXY_TARGET` | nginx forwards `/jellyfin/` to this server (same origin, no CORS problems) | empty        |
| `DEFAULT_THEME`         | Theme for new users                                                        | `default`    |
| `APP_TITLE`             | Title in the browser                                                       | `Jellymorph` |

Local development: Vite dev proxy to `JELLYFIN_DEV_URL` from `.env.local` (in `.gitignore`). Without a server the app runs in demo mode with MSW.

## 8. CI/CD (GitHub Actions)

- `ci.yml` on push and PR: lint, typecheck, unit tests, build, Playwright against the mock server
- `release.yml`: multi-arch image (`linux/amd64`, `linux/arm64`) to ghcr.io through `docker/metadata-action` – push to `main` → tag `edge`; Git tag `v*` → semver tags and `latest`, plus a GitHub release with a changelog
- Dependabot for npm, Docker and Actions

## 9. Definition of done (per phase)

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run without errors
- No `any`, no commented-out leftovers, no placeholders for core features
- Loading, empty and error states implemented
- UI phases: create Playwright screenshots in demo mode at 1920×1080, 3840×2160, 1280×800 and 390×844, look at them yourself, check them against this specification and fix shortcomings
- Keyboard/remote control navigation through all new pages checked
- Status (section 11) updated, commits following Conventional Commits

Performance goals: base bundle without a theme < 250 KB gzip, LCP < 2.5 s on desktop. Pictures always through the Jellyfin image API in a fitting size (`maxWidth`, `quality`), lazy outside the viewport. Accessibility: semantic HTML, ARIA where needed, contrast WCAG AA.

## 10. Way of working

- Phases strictly one after another. At the end of every phase: a short summary (built, open, known limitations), then wait for my OK.
- If a requirement is unclear or technically bad: ask or make a reasoned counter-proposal, do not silently deviate.
- Check API details against the SDK types or the server's OpenAPI specification, do not guess.
- Do not commit secrets, tokens or private server URLs.
- Code and code comments in English, UI texts only through i18n. README, changelog, docs, release notes and this file in English (since 2026-10-15; before that the README was German). Summaries and questions to the user in German.
- Git tags are set by the user. Whenever the user has to push or tag something, give them the exact commands.

## 11. Phases & status

- [x] Phase 0 – Plan: architecture, final theme contract, dependencies with reasoning, player data flow, risks, open questions → docs/architecture.md. No implementation. _(approved 2026-10-07)_
- [x] Phase 1 – Foundation: setup, tooling, ci.yml, runtime config, API client, auth (server, sign-in, Quick Connect, profile picker), mock server + demo mode, i18n _(done 2026-10-07, v0.1.0, approved)_
- [x] Phase 2 – Default theme: all pages functional (home, library, details, series, search, favorites) _(done 2026-10-07, v0.2.0, approved 2026-10-07)_
- [x] Phase 3 – Player: complete incl. reporting, tracks, trickplay, segments, next episode _(done 2026-10-08, v0.3.0, approved 2026-10-08)_
- [x] Phase 4 – Theme system: registry, fallback, settings with live preview, persistence, spatial navigation _(done 2026-10-08, v0.4.0, approved 2026-10-08)_
- [x] Phase 5 – Docker & release: Dockerfile, nginx, entrypoint, Compose, release.yml _(done 2026-10-08, v0.5.0, approved 2026-10-08)_
- [x] Phase 6 – Theme neon-grid _(done 2026-10-08, v0.6.0, approved 2026-10-09)_
- [x] Phase 7 – Theme crimson _(done 2026-10-09, v0.7.0, approved 2026-10-09)_
- [x] Phase 8 – Theme glass _(done 2026-10-09, v0.8.0, approved 2026-10-13)_
- [x] Phase 9 – Theme horizon _(done 2026-10-13, v0.9.0, approved 2026-10-13)_
- [x] Phase 10 – Theme constellation _(done 2026-10-13, v0.10.0, approved 2026-10-14)_
- [x] Phase 11 – Polish: README with screenshots, docs/themes.md, performance and accessibility review, first release tag v1.0.0 _(done 2026-10-14, approved 2026-10-14; the tag `v1.0.0` follows after phase 12)_

### After 1.0 (decided 2026-10-14)

From here on: phase n → next minor version (1.x.0), bug fixes as a patch (1.x.y). Way of working as before: one phase after another, at the end a summary and wait for the OK.

- [x] Phase 12 – Real-world polish before the release: overview shortened with "Show more", audio and subtitle tracks shortened to 3 entries with "show more", HTML line breaks (`<br>`) from the metadata as paragraphs instead of text, navigation with many libraries (overflow into a "More" menu), test on the user's real server (pictures, jump bar, genre pages, playback direct and through transcoding, subtitles, settings on the server). Everything in every theme. → v1.0.0, then the user sets the tag `v1.0.0` _(done 2026-10-14, approved 2026-10-14; shipped with v1.1.0, because the tag `v1.0.0` sits on the state of phase 11, 697918c)_
- [x] Phase 13 – Admin functions per title (only visible to administrators): "Edit" menu on the detail pages with identify, edit metadata, pictures (choose from online sources, upload, delete), refresh metadata, search/download/upload/delete subtitles, delete item; scan library; "Open server administration" links to the Jellyfin dashboard (the dashboard itself is not rebuilt). → v1.1.0 _(done 2026-10-14, approved 2026-10-15, tag `v1.1.0` on e7243ee)_
- [x] Phase 14 – Make it your own: own colors, fonts and CSS per theme (files from a mounted folder, no injected CSS because of the CSP); arrangement by setting in every theme: order and visibility of the buttons on the detail page, details shown, home page areas, navigation entries; a default for everybody (admin) and per user, by drag and drop. No foreign code. → v1.2.0 _(done 2026-10-15, approved 2026-10-15)_
- [x] Phase 15 – Theme cobalt (§6) → v1.3.0 _(done 2026-10-25, approved 2026-10-25)_
- [x] Phase 16 – Theme onyx (§6) → v1.4.0 _(done 2026-10-25)_
- [ ] Phase 17 – Own themes as plugins: a public, versioned theme interface, loading at runtime from the mounted folder, a starter template for building, choosing installed themes in the settings. Security concept: plugin themes are code with access to the session; only the container admin may install them. → v1.5.0 (moved from phase 15 on 2026-10-25, see §12)

Not planned (user decision 2026-10-14): native apps for Android/iOS, SSO.

## 12. Decisions & notes

Claude Code records important architecture decisions and deviations here, with reasoning.

- **2026-10-07 – Name "Jellymorph"** (user decision). "Morph" stands for the core of the app: a theme transforms the whole interface. The name was free on GitHub; JellyStream, JellyFrame and JellyShift are already taken. The default theme is therefore called **"Classic"** instead of "Jelly", so app and theme are not confused. Identifier in code and for Jellyfin (`clientInfo.name`, DisplayPreferences client): `jellymorph`.
- **2026-10-07 – Answers to the open questions from docs/architecture.md §19** (user: "alles ja", i.e. the recommendation each time):
  - The additional packages `blurhash`, `@axe-core/playwright` and test and ESLint companions are approved.
  - New container variable `DEMO_MODE` (default `false`).
  - Audio/subtitle language, subtitle mode and "next episode automatically" live in the Jellyfin `UserConfiguration`. Streaming quality and input mode stay local per device.
  - Several remembered profiles per device, with a switch "Remember on this device" at sign-in.
  - ASS/SSA are shown as WebVTT by default, plus the option "burn in styled subtitles". No JASSUB.
  - Music, books, photos, live TV and playlists are hidden in v1.
  - German texts in the informal "du" form.
  - Docker is only checked in GitHub Actions.
  - The demo video is made by a browser recording (MediaRecorder), without ffmpeg.
  - License AGPL-3.0.
  - Browser baseline: Chrome/Edge ≥ 111, Firefox ≥ 128, Safari ≥ 16.4.
  - Still open (question 2): version and address of the user's own Jellyfin server. Until then, development happens only against the mock server.
- **2026-10-07 – Phase 1, implementation decisions:**
  - axios runs globally with the fetch adapter: because of `keepalive` for the later stop report and because MSW 3 only intercepts `fetch` in the test DOM.
  - Image URLs are built through `api.getUri()` in `src/api/urls.ts`. The SDK's `ImageUrlsApi` costs ~48 KB, and its `getUserImageUrl()` targets a route that does not exist.
  - `UserDto.HasPassword` is read despite the deprecation (see architecture.md §1.2).
  - The theme contract grows per phase. Phase 1 contains `AppShell`, `LoginPage`, `ProfileSelect`, `HomePage` (preliminary: greeting + libraries), `Toast` and the states. `LoginPage` gets a `LoginFlow` model with the steps server/credentials/quickConnect.
  - The demo server stores issued tokens in `localStorage`, so a session survives a reload, as with a real server.
  - Global theme rules live under `:where([data-theme='…'])`, so component styles always take precedence.
  - Before the first render, `index.html` shows a neutral splash. Errors on start (e.g. demo without a service worker) appear as a bilingual message in `app/boot-error.ts`.
  - Version per phase: phase n → 0.n.0 (as in Crystal).
- **2026-10-07 – Phase 2, implementation decisions:**
  - Theme contract v1 extended with `LibraryPage`, `ItemDetailPage`, `SeriesPage`, `SearchPage`, `FavoritesPage`, `Hero`, `Row` and `MediaCard`.
    - `SeriesPageProps.series` is a loaded `ItemDetail` instead of a `QueryResult`: whether an item is a series is only known after loading. Until then `ItemDetailPage` shows the loading state.
    - `CardVariant` is `poster | landscape | episode`.
    - Themes compose other slots through `<ThemeSlot>`, not through `useThemeComponent()` + JSX. That keeps the component identity stable (React Compiler rule), and every building block has its own error boundary.
  - "Play" buttons only appear with the player in phase 3. `useMediaActions().play` is `null` until then, so there are no dead buttons.
  - Favorite and played are updated immediately in the whole cache (optimistically) and confirmed after the server's answer, or rolled back on errors, with a toast.
  - Live updates come through the SDK WebSocket (`UserDataChanged`, `LibraryChanged`), batched after 1.5 s.
  - The library's sorting and filters are in the URL (shareable, the back key works).
  - The jump bar counts with `nameLessThan` (lowercase, because Jellyfin stores sort names in lowercase). This still has to be checked on a real server.
  - Years in the filter come from the legacy endpoint `/Items/Filters`, because `/Items/Filters2` returns no years.
  - "Next up" on the home page leaves out started episodes; they are under "Continue watching". On the series page, the started episode is the next one.
  - Content pages other than the home page are lazy loaded.
  - **Theme rule:** page grids need `grid-template-columns: minmax(0, 1fr)`. Otherwise the column grows with a long row of cards and the page scrolls sideways. An E2E test checks this.
  - The demo server also stores favorites and the played status per user in `localStorage`.
- **2026-10-08 – Phase 3, implementation decisions:**
  - The player is a full-screen route of its own, `/play/:itemId?start=<seconds>`, instead of a layer above the previous page. The start position is in the URL, so a reload resumes at the same spot. The previous page comes from the cache when going back. When switching to the next episode the screen stays mounted, and full screen is kept.
  - Without `start` the route asks (slot `ResumePrompt`) when a stored position exists. Series are resolved to the next episode.
  - Source choice as in jellyfin-web (checked in the source): `SupportsDirectPlay` or `SupportsDirectStream` → static file, otherwise `TranscodingUrl`. HLS starts at 0, the player seeks to the start position itself. With progressive transcoding a time offset applies, unless the URL contains `copytimestamps=true`.
  - DeviceProfile following the conventions of jellyfin-web: `IsSecondaryAudio = false` (audio track switches always through a new stream), MKV through `canPlayType` instead of the user agent (Chrome 153 reports `maybe`), subtitles only as external `vtt` (the server converts SRT and ASS), picture subtitles are burned in. "Burn in styled subtitles" uses `AlwaysBurnInSubtitleWhenTranscoding` without direct play and without video stream copy.
  - Outside Safari, HLS runs through `hls.js/light` (116 instead of 181 KB gzip, only loaded when needed). Chrome now reports native HLS; hls.js still stays the first choice there because it is more proven.
  - `DELETE /Videos/ActiveEncodings` still exists in Jellyfin 12 (`HlsSegmentController`, hidden from the OpenAPI through `IgnoreApi`, which is why it is missing from the SDK).
  - The runtime from the server counts as the duration. With fragmented files and running transcodes, browsers often only know the loaded part.
  - Quality, volume and "burn in" are device settings (local). The player reads "next episode automatically" from `UserConfiguration.EnableNextEpisodeAutoPlay`; the settings page for it comes in phase 4. The trailer preview in the hero (architecture.md §9.13) depends on "trailer autoplay" and therefore also follows in phase 4. Local trailers can already be played on the detail page.
  - Theme contract: new slots `PlayerOverlay` (receives a `PlayerModel`) and `ResumePrompt`. The `<video>` element belongs to the app, the overlay lies above it. Shared building blocks for every theme: `useScrubber` (timeline) and `formatClock` in `src/ui/`.
  - Player screens are dark in every color scheme: the stage sets the active theme again with `data-color-scheme="dark"` (the same mechanism as the later live preview).
  - Classic: primary buttons get darker instead of lighter on hover and focus. Before, white text on the focused button had only 3.99:1.
  - **Demo video:** in demo mode every title plays the same 60-second clip. `scripts/record-demo-clip.ts` records it through MediaRecorder in Chromium (VP9/Opus as fragmented MP4, 2.9 MB) and afterwards corrects the VP9 level and the duration in the header. The same file serves as the direct play file and, through byte ranges, as the HLS stream. In demo mode, stored positions refer to the clip.
  - The demo server answers range requests for direct play itself: the MSW service worker loses the range header when passing on `<video>` requests (no-cors), and the file would not be seekable otherwise. For tests, faults can be switched on (`localStorage["jellymorph.demo.faults"]`: `directPlay`, `transcode`, `playbackInfo`).
  - Known limitation in demo mode: on a page reload the stop report gets lost, because the mock server runs inside the tab itself. With a real server `keepalive` takes effect.
- **2026-10-08 – Phase 4, implementation decisions:**
  - **Own spatial navigation instead of norigin** (`src/navigation/spatial.ts`, no dependency). norigin requires every focusable element to register through `useFocusable()`. With six themes with their own components, every forgotten element would be unreachable with the remote control. Our solution looks for the nearest focusable DOM element in the arrow's direction (cross offset counts threefold). Fixed and sticky bars are a layer of their own. Components with their own arrow logic call `preventDefault()`. Conventions for themes: `data-autofocus` (entry point), `data-nav-ignore` (Tab only). Details: architecture.md §8.1.
  - **Back keys** (Esc, Backspace outside fields, `GoBack`/`BrowserBack`/`XF86Back`, webOS 461, Tizen 10009) only go back when there is a previous page in the app. That way nobody leaves the app by accident.
  - **TV mode:** `data-device` = `tv` through the "Input mode" setting (Automatic/Computer/TV) or user agent detection with "Automatic". Font `clamp(16px, 100vw / 80, 48px)`, screen margin 0–5 % (default 3 %) through `--overscan-x`/`-y` in `--page-gutter`.
  - **Storing the user settings:** locally immediately (`jellymorph.user.<serverId>:<userId>`), on the server in DisplayPreferences `settings`/`jellymorph` with flat `CustomPrefs` keys (`jellymorph.theme` …, schema version 1), batched over 1 s. The server wins on start, **unless** a local change has not reached it yet (flag `pending`) or was made while loading. Reason: without this exception a change got lost when the page was reloaded within the wait (found in the E2E test). Additionally, `pagehide` sends an unsaved state with `keepalive`. Saving is based on the DTO read last, without a new GET; foreign keys are kept.
  - **Live preview:** `ThemePreview` renders `Hero` and a row of the theme shown with real data in a 1280 px wide, scaled, `inert` container with its own `data-theme`/`data-color-scheme`. Classic calculates in `cqi` in `Hero` and `Row`. The preview pictures of the theme tiles are made with `npm run previews` (Playwright in demo mode).
  - **Theme switch:** preload the chunk, then `document.startViewTransition` + `flushSync` (260 ms), otherwise an overlay cross-fade, with reduced motion immediately. The loader remembers the status and value of every promise, so `use()` does not suspend when switching back.
  - **Motion (Framer Motion) not installed yet:** Classic gets by with CSS transitions. The library follows with the first theme that needs spring animations (a deviation only in timing, not in the choice).
  - **Trailer preview in the hero** (moved from phase 3): `useTrailerPreview` starts the local trailer muted after 3 s of calm at no more than 3 Mbit/s and without reporting. Only with trailer autoplay switched on, full motion, without data saver and not on touch devices. Stops on scrolling (> 120 px), a hidden tab, a title change and when the focus leaves the hero.
  - **"Next episode automatically"** is now in the settings (playback section), together with audio/subtitle language and subtitle mode. They are written into the `UserConfiguration` (as a whole, optimistically with rollback). The language list comes from `/Localization/Cultures`, translated through `Intl.DisplayNames`.
  - Theme contract: `SettingsPage` is now a slot, `ToastProps.action` for "Try again", `THEME_SLOTS` with a compile check for the contract test. If the theme shown is already active, the picker shows "This theme is active." instead of a disabled button.
  - Demo server: DisplayPreferences, `UserConfiguration` and `/Localization/Cultures` stored in `localStorage`; a new fault switch `preferences`. Long titles in the generated logo are fitted into the area.
- **2026-10-08 – Phase 5, implementation decisions** (details: docs/architecture.md §15.1):
  - Base images: `node:24-alpine` as the build stage on the build machine's platform (static result, arm64 needs no emulated Node build) and `nginxinc/nginx-unprivileged:1.31-alpine` (mainline like the `alpine` tag of the spec, but with a version number, so Dependabot can propose updates).
  - **Own entrypoint** instead of the base image's scripts: it checks every variable and **stops the container on invalid values** with a message naming the variable (e.g. a typo in `DEFAULT_THEME`). The app would silently ignore them; a container that runs unnoticed with defaults is only noticed much later. All runtime files live in `/tmp/jellymorph`, nginx only writes to `/tmp`: runs with `--read-only`, `--cap-drop ALL` and any UID.
  - **Proxy** (`JELLYFIN_PROXY_TARGET`) with a variable in `proxy_pass` and `resolver` from `/etc/resolv.conf`: the container also starts when Jellyfin is not running yet, and it follows a new container address. Path and query are passed on unchanged from `$request_uri`. Limitation: Kubernetes needs the full DNS name (nginx does not know search domains).
  - **CSP per mode** (demo/proxy: only the own origin; `LOCK_SERVER`: exactly one origin; otherwise `https: http:`). Verified by the CI running the complete E2E suite against the container in demo mode; the fixture `e2e/fixtures.ts` fails every test on a CSP violation.
  - **PWA without a service worker** (deviation from architecture.md §15, plan from phase 0): manifest and icons are enough for "Install app" in the browser menu (Chrome from 108/112). Without offline features a service worker would only bring risk to media requests and would compete with MSW for the scope in demo mode. Chrome's automatic install prompt is therefore dropped. `APP_TITLE` also sets the name in the manifest.
  - **Workflows:** on a push to `main` and on tags `v*`, `release.yml` first calls the whole CI (`workflow_call`) and only publishes after that: `main` → `edge`, `v1.2.3` → `1.2.3`, `1.2`, `1` (not for 0.x), `latest` (not for pre-releases). `ci.yml` therefore only runs directly for other branches and pull requests; `main` is not checked twice. GitHub releases get notes from the Conventional Commits (`scripts/changelog.ts`, headings in German at the time, in English since 2026-10-15). The user still sets the tags.
  - The CI's Docker job builds amd64 and arm64 and checks the amd64 image with `scripts/test-container.ts` (headers, caching, fallback, invalid values, proxy including WebSocket against a Node stand-in server, E2E under the CSP). Errors also appear as annotations, because job logs cannot be read without signing in.
  - Dependabot weekly: npm (tooling as one group), Docker (without Node major versions, they follow `.node-version`), Actions (one group).
  - The package on ghcr.io is public (inherits the repository's visibility); an anonymous pull of `edge` with amd64 and arm64 was checked after the first release run.
- **2026-10-08 – Phase 6, Neon Grid:**
  - **Own components** for everything that shapes the theme: AppShell (HUD bar with system time and operator menu over a perspective grid), LoginPage and ProfileSelect (boot sequence, then an access terminal), HomePage ("sectors", genre tags), Hero, Row, MediaCard, ItemDetailPage and SeriesPage (dossier with HUD data fields, episode log), SearchPage (terminal with a block cursor that follows the caret), PlayerOverlay (HUD with readouts for system time, chapters and tracks, segmented timeline), ResumePrompt, Toast and the states. Library, favorites and settings are the Classic pages in neon colors and fonts (headings globally get uppercase and glow).
  - **Fonts** (OFL, `@fontsource`): Orbitron (headings), Rajdhani (text, with `font-size-adjust` because of the small x-height), Share Tech Mono (data, terminal). Latin and Latin Extended only.
  - **Colors:** almost black, magenta `#ff3bdc`, cyan `#3ff2ff`, yellow `#ffd23f` for actions (deliberately not the yellow of known gaming brands). The token test checks contrasts.
  - **Effects** only with transform, opacity and filter: glitch on focus of cards and on the heading on page change, chromatic aberration through an SVG filter on focused pictures, scanlines only over pictures, text scramble for titles (the real text keeps its space and accessibility, the characters are a decorative layer above it), grid with a travel animation. Reduced motion switches everything off, TVs get the calm variant (no SVG filter, no jitter, no blur).
  - **Boot sequence** once per browser session (new shared hook `useSessionFlag`, because themes may not use storage), skippable with any key, click or the button; not at all with reduced motion.
  - **UI sounds:** created through Web Audio (no files), off by default. New user setting `uiSounds` (DisplayPreferences `jellymorph.uiSounds`, schema stays version 1, old states simply lack the value). The switch only appears for themes with `features.uiSounds`.
  - **Contract:** `ThemeModule.texts` (own texts as the namespace `theme-<id>`) and `ThemeManifest.features`. Classic's `PlayerTimeline` and `PlayerMenu` take a `classes` object, so themes can use the tested interaction logic with their own look. `AppLink` passes anchor attributes through; `useRouteKey()` returns a key for page transitions.
  - **Tests:** E2E `e2e/neon-grid.spec.ts` (switch, boot once per session, terminal search, dossier, HUD player, arrow keys, focus = hover, axe, animation properties, reduced motion). The CSSOM check of the animations is now the helper `layoutAnimations`. Screenshots `30-…41-neon-*`, preview picture through `npm run previews` with theme selection.
- **2026-10-09 – Phase 7, Crimson:**
  - **Own components:** AppShell (bar at the top, transparent over the hero, opaque from 8 px of scrolling; profile menu with a square avatar), ProfileSelect ("Who's watching?" with large square tiles, language choice), HomePage (one hero, rows reach into its lower edge, library tiles after the first two rows, genres at the end), Hero, Row (landscape, edge arrows, page indicator, ←/→), MediaCard with a preview card, ItemDetailPage and SeriesPage as an overlay, SearchPage, PlayerOverlay. Sign-in, library, favorites, settings, states, toast and resume question are Classic in Crimson colors.
  - **Colors and font:** almost black `#0f0f10`, accent `#d31d34` (ΔE76 ≈ 21 to the model's red), Inter (OFL, already loaded by Classic). App title in white instead of a red word mark.
  - **Details as an overlay** above the page they come from (architecture.md §7.9): descendant routes with `state.backgroundLocation`, the page stays mounted and `inert`, Back restores it unchanged. Opened directly, details are a normal page. Only `/item/:id` can be an overlay; overlay links in the overlay replace the history entry, so closing always leads to the page. A bug found along the way: the season switch (`?season=`) lost the history state and turned the overlay into a page; fixed for every theme. Episodes are directly in the overlay (season as a native `select`, the whole row plays the episode, next episode highlighted).
  - **Preview card:** opens 400 ms after hover or keyboard/remote focus, not on touch devices and not in the overlay. It lies as a portal in document coordinates above the card: rows do not clip it, and it belongs to the content layer of the arrow navigation. Play, favorite, played, "More" (opens the details), rating, year, runtime, community rating, genres. Esc closes it, the focus stays on the card. Because it covers the card, it carries the white focus outline while the card is focused (WCAG 2.4.11), and likewise on hover.
  - **Hero:** one title, Ken Burns drift (26 s, TV 40 s) until the muted trailer takes over after 3 s (shared `useTrailerPreview`); the logo then gets smaller, the overview fades out. The picture ends 4 px before the bottom edge; otherwise it shines through as a light line at the anti-aliased fractional pixel edge.
  - **Player:** back arrow at the top, red timeline with remaining time, title centered in the control bar; after 6 s of pause without input the controls give way to a "You're watching" with the overview over a darkened picture. Timeline and menus are the Classic building blocks with Crimson classes.
  - **Contract:** `ThemeOptions.cardShape` (`'mixed' | 'landscape'`) for the Classic pages taken over. `AppLink` has `overlay` and `ref`.
  - **Tests:** `e2e/crimson.spec.ts` (12 tests: switch, overlay with Back/Esc/scroll/focus, replacing from "More like this", page when opened directly, preview card by mouse and keyboard, season switch, profiles, player with the pause view, arrow keys, focus = hover, axe, animation properties, reduced motion), `navigation/overlay.test.ts`. Screenshots `50-…63-crimson-*`.
- **2026-10-09 – Phase 8, Glass:**
  - **Motion now installed** (`motion` 13.5, as planned in §3 and announced in phase 4), only in the Glass chunk: base bundle unchanged at 183 KB, Glass 50 KB JS. Version 14 was one week old at the time (a new major version), hence 13.x.
  - **Own components:** AppShell (three floating pieces of glass: brand on the left, a centered pill with search and sections, profile on the right; the active section as a solid pill; on phones a floating tab bar at the bottom), Hero (full-screen carousel, 8 s per title, cross-fade with a slow fade-out of the picture, text change with a spring, progress in the page indicator, pause button according to WCAG 2.2.2, stops on hover, focus, trailer and reduced motion), Row (shelves with room for lifted cards, glass arrows only under the pointer), MediaCard (focus effect `useLift`: lift, tilt towards the pointer under the mouse, light reflection; the title below makes way), HomePage (library tiles with a glass strip, genre chips), ItemDetailPage and SeriesPage (full-screen stage with a gradient, title logo instead of text, glass buttons; below it the cast as round portraits, related titles, an info panel; seasons as a segmented pill, episodes as a shelf, the next episode is scrolled to; every episode has an info button to its own page), SearchPage, PlayerOverlay (glass panel with title, timeline between watched and remaining time, playback in the middle). Sign-in, library, favorites, settings and states are Classic in Glass colors.
  - **Light and dark:** text over pictures (hero, stage, player) is light on a dark gradient in both schemes. Bars with text have a denser glass level (`--gl-bar`), so the contrast is enough over white or black pictures too. No blur on TVs (expensive for their graphics chips), denser glass instead. Focus rings in `rem`, so 1.5 times as thick in TV mode; solid buttons get a dark gap before the ring.
  - **Colors:** accent `#4256cf`/`#2456c8` (ΔE76 ≥ 16 and ≥ 12 to known system blues), main actions white or almost black.
  - **Tests:** `e2e/glass.spec.ts` (11 tests: switch, the carousel rotates and stops with the pause button, the card lifts and only tilts under the mouse, detail page, season tabs and episodes, player, light scheme with axe, arrow keys, focus = hover after the springs settle, axe, animation properties, reduced motion). The helper `waitForAnimations` now also ignores slow background motion from 5 s, otherwise it waits forever in the Glass hero. Neon Grid's arrow key test now presses until the focus arrives (was flaky under load). Screenshots `70-…80-glass-*` in both schemes.
  - **README:** until the first release tag there is only `edge`; the README now says so.
- **2026-10-13 – Images without Docker Hub** (architecture.md §15.1): the release run for the tag `v0.8.0` and the run after it failed in the Docker job, because Docker Hub did not answer and GitHub runners run into the anonymous pull limit. Node, the Dockerfile frontend, BuildKit and QEMU now come through `mirror.gcr.io`, nginx-unprivileged through `ghcr.io/nginx/nginx-unprivileged` (the same vendor image as `nginxinc/nginx-unprivileged` from §7, just another registry). The README got a header with logo and status badges (CI on `main`, release, image, license).
- **2026-10-13 – Phase 9, Horizon:**
  - **Own components:** AppShell (opaque, sticky bar with text links, a white bar on hover and focus, a blue one for the current page; search and profile with the name on the right; on phones a bar at the bottom), Hero (wide carousel below the bar: picture on the right with a gradient, text on the left; the titles slide sideways, large arrows at both edges, dots and a pause button below, 10 s per title, titles outside the picture are `inert`), Row (16:9 cards, "See all" on the right, round arrows), MediaCard (unfolds downwards 250 ms after hover or focus: the picture stays in place, below it title, play, favorite, details, facts and overview; a portal as in Crimson, its own focus outline), HomePage, ItemDetailPage and SeriesPage (header with the picture on the right, below it the tabs "Episodes" (series only), "Related", "Details" following the WAI-ARIA tab pattern; episodes as a list with a still to play and a title link to the episode page, season through `select`; episode pages show the details without tabs), SearchPage, PlayerOverlay (title at the top left, tools at the top right, back/play/forward large in the middle of the picture on dark discs, at the bottom a blue timeline between watched and remaining time). Sign-in, library (landscape through `cardShape`), favorites, settings and states are Classic in Horizon colors.
  - **Colors and font:** background `#13192a` (ΔE76 ≈ 8 to the model's background), accent `#2a63e6` (ΔE76 ≥ 32), Figtree (OFL, `@fontsource-variable/figtree`, a new font dependency like Neon Grid's).
  - **Tests:** `e2e/horizon.spec.ts` (10 tests: switch, arrows and dots in the hero including `inert`, the card unfolds downwards (geometry checked) by mouse and keyboard with Esc, tabs with arrow keys, season choice and episode link, player, arrow keys, focus = hover, axe, animation properties, reduced motion). Screenshots `81-…91-horizon-*`.
- **2026-10-13 – Phase 10, Constellation:**
  - **Own components:** AppShell (narrow icon rail on the left, on desktop and TV; expands over the page on hover, keyboard or remote focus and with an open profile menu: a dark shadow fades in, labels appear next to the icons, the current page with a glowing mark; profile at the bottom; on phones a small bar at the top and the main areas at the bottom), Hero (rounded banners in a carousel, the neighbors reach into the picture at the edges and only show their picture; the whole banner opens the title, glow frame on focus; arrows over the neighbors only for pointer and Tab, dots and a pause button below, 8 s per title), a row of tiles directly below the hero for libraries and collections (16:9, name in the middle, glow frame and slight enlargement on focus), Row and MediaCard (rounded 16:9 cards with a soft shadow, 5 % larger on focus with a white frame and glow), HomePage (hero, tiles, rows, genres as pills; the collections row is in the tiles), ItemDetailPage and SeriesPage (picture across the whole window width behind the bar, fading into the starry sky at the bottom; below it sections instead of tabs: "Episodes" as a sideways row with season choice, the next episode is scrolled into the visible part, "Suggestions", "Details" with overview, facts and cast), SearchPage (large translucent search field), PlayerOverlay (back arrow at the top left, title centered, at the bottom a turquoise timeline with remaining time, below it playback on the left and tools on the right). Sign-in, library (landscape), favorites, settings and states are Classic in Constellation colors.
  - **Background:** dark blue gradient with two faint nebula spots, fixed while scrolling. Star field made of small `radial-gradient`s in tiles of different sizes (no visible pattern, no image file, no DOM); the calm field lies behind every page, a few brighter stars of the AppShell twinkle slowly (opacity only, not with reduced motion and not on TVs).
  - **Colors and font:** background `#0b1533` (ΔE76 ≈ 14 and 17 to the model's base tones), accent `#2bb6c9` (ΔE76 ≈ 80 to the brand blue), Nunito Sans (OFL, `@fontsource-variable/nunito-sans`, a new font dependency like Neon Grid's and Horizon's).
  - **Navigation:** the rail is fixed, so it is a layer of its own for the arrow navigation: ← at the left edge leads in, → out again. Found and fixed: without `data-nav-ignore`, ← jumped from the first card to the invisible hero arrow instead of into the rail.
  - **Tests:** `e2e/constellation.spec.ts` (12 tests: switch including font and star field, the rail expands by mouse and keyboard and collapses again while keeping its narrow measured width, banners with arrows and dots including `inert` and opening, tiles with glow open library and collection, movie page with sections, episode row with the next episode in the visible part and season choice, player structure, arrow keys, focus = hover, axe, animation properties, reduced motion). Screenshots `92-…99-constellation-*` including TV with the expanded rail.
- **2026-10-14 – Phase 11, polish:**
  - **Accessibility:** new check `e2e/accessibility.spec.ts`: every page in every theme with axe (library, collection, genre, person, favorites, search, settings, player paused and with an open menu), Classic and Glass also light. Plus Lighthouse per theme. Found and fixed: WCAG 2.5.3 (visible label in the name) on Neon Grid's profile button ("OPERATOR" was missing from the name) and on Constellation's banners (the name was only the title). The avatar initials now come through CSS (`attr()`), so as decoration they do not count as a label.
  - **Performance** (measurements in architecture.md §13.2): LCP 0.8–1.3 s, TBT 0 ms, Lighthouse 99–100 in every theme. Fixed: the hero placeholders of Horizon and Constellation were too short by the line with the dots (CLS 0.05 → ≤ 0.001); Constellation's rail now sits at the top instead of the middle, so libraries loaded later move nothing. Lighthouse runs through `npx` (as planned in §13.2) and attaches to a Chromium started by Playwright, because it cannot start its own here.
  - **Bugs found:** Horizon: the unfolded card was too narrow in smaller windows (1280 px), the details button and rating stuck out (panel now `minmax(0, 1fr)`, buttons more compact). Demo server: genres could not be loaded by ID, the genre page showed "Not found" (still to be checked on a real server). The TV screenshots of the detail pages showed no focus ring, because the test waited for an h1 that the home page also has and pressed ↓ while still loading (test corrected, the app was fine).
  - **README** with pictures of every theme (`npm run readme-shots`, `e2e/readme.spec.ts`, JPEG 1280×800 in `docs/screenshots/`, together below 1 MB), a feature list and version 1.0; new `CHANGELOG.md`. docs/themes.md has an overview of the bundled themes.
- **2026-10-14 – Phase 12, real-world polish** (occasion: the user's screenshot from the real server, a long overview with literal `<br>`, very long track lists, navigation with nine libraries ran over the edge):
  - **Texts from the server:** `plainText()` (`src/domain/text.ts`) turns HTML in overviews into plain text with line breaks: `<br>` and paragraphs become line breaks, other tags are dropped, entities are decoded once. Still only text is rendered, never HTML from the server. Previews (hero, cards) show the line breaks as spaces, detail pages as paragraphs (`white-space: pre-line`).
  - **Shared building blocks** in `default/components/Expandable.tsx`: `ExpandableText` (4 lines, "Show more" only when really shortened, measured with a ResizeObserver) and `TrackList` (tracks one below the other, from the fourth entry "+ n more"; if only one is too many, it is simply shown). Themes only pass classes. Built into the detail pages of all six themes.
  - **`OverflowNav`** (`default/components/OverflowNav.tsx`): libraries that do not fit into the bar move into a "More" menu; home, search and favorites always stay. Measured live (window width, TV font, language); folded entries stay invisible in the list so they can be measured again. The bars no longer secretly scroll sideways. Built into Classic, Neon Grid, Crimson, Glass and Horizon; Glass measures the space around the centered pill (`available`). Constellation does not need it (vertical rail). Neon Grid already shows "More" at 1280 px, because its HUD bar is not wide enough for every entry there; before, the last entries were silently clipped.
  - **Demo:** "Kupferherz" now has a long overview with `<br>` and entities and seven audio and six subtitle tracks (set after generation, all other demo data stays the same).
  - **Test on the real server** (the user's Jellyfin 12.2.0; the user signed in themselves in the browser pane, the address only in `.env.local`): home, libraries, pictures (`srcset` loads fitting sizes), search, series, genre pages (`/Items/{id}` returns genres), settings on the server (DisplayPreferences) all fine. Playback direct (MP4 H.264/AAC, `static=true`) and through HLS transcoding (DTS-HD), switching to burned-in PGS subtitles at the same spot, progress and stop reports (204); no stored position, because below 5 %. The jump bar with `nameLessThan` is right (lowercase sort names confirmed).
  - **Fixed as a result:** the jump bar now puts the letter's row at the top (before, it landed at the bottom edge; `focusIndex(…, 'start')`, `scroll-margin-top` against the sticky bar). Jellyfin writes the name into the generated library pictures; the themes no longer lay it over them a second time (it stays for screen readers); in Constellation it otherwise sat exactly on the text of the picture. The demo library pictures therefore now carry their name as in Jellyfin. Studios and directors are shortened like the tracks (`ShortList`; for one series 28 networks stood in one line). The "More" button stays highlighted while its menu is open.
  - **Tests:** `e2e/long-content.spec.ts` (per theme: overview shortened and expandable, no `<br>` in the text, tracks shortened and expandable; per theme with a bar: entries that are too wide fold into "More", no sideways overflow, Esc closes the menu, focus returns, links lead to the library), `src/domain/text.test.ts`.
- **2026-10-14 – Phase 13, admin functions** (details: architecture.md §14 for the CSP):
  - **One shared menu for every theme:** `ItemAdmin` (`default/components/admin/`) with the menu and all dialogs; themes only provide their button through `renderTrigger` (Classic and Neon Grid with text, the others round with `aria-label`). Visible only to administrators (`useIsAdmin()`), "Delete" only with `CanDelete` on the item (Jellyfin requires `EnableContentDeletion` for it, admin alone is not enough). Identify only for movies and series, subtitles only for videos. The dialogs are native `<dialog>` elements in a chunk of their own (13 KB gzip) that only administrators load when opening the menu; the API clients for them are in it too (`useItemAdmin`), only `useIsAdmin` and the library scan live in small modules of their own (`useAdminAccess`, `api/refresh.ts`).
  - **Menu in the top layer (Popover API, `popover="manual"`):** in Horizon's header, `overflow: hidden` clipped the menu; in Constellation the cards below lay above it. A portal into `<body>` solved that but broke two things: React passes events from portals on to the component parents (Esc in the menu would have closed Crimson's detail overlay), and outside the `aria-modal` overlay the menu is invisible to screen readers. The popover stays in the DOM next to its button and still appears above everything. Browsers without the Popover API (Chrome < 114, Safari < 17) show it in place as before. The menu (like the dialogs) catches Esc, Backspace and the remote's back keys in the capture phase on `window`; before, Esc closed a dialog **and** went back a page when the focus had left the dialog (found on the real server).
  - **Saving metadata like jellyfin-web:** `UpdateItem` clears every scalar field that is missing (title, overview, dates, ratings); lists are kept with `null`. The editor therefore sends back the whole loaded DTO and only replaces the edited fields (unit test). Overviews are edited raw (with `<br>`), as Jellyfin stores them.
  - **Picture upload by hand:** `SetItemImage` expects the body as Base64 text with an image content type; the SDK types it as a binary file. The call therefore goes through the SDK's Axios instance (the third hand-written call after `ActiveEncodings` and the media URLs).
  - **Refresh with the three modes of jellyfin-web** (checked in the source): "scan for new and updated files" = `Default`, "search for missing metadata" = `FullRefresh` without replacing, "replace all metadata" = `FullRefresh` with replacing; pictures can only be replaced with the full fetch. "Scan library" is the mode `scan` on the library folder.
  - **CSP `img-src https:` in every mode:** for picture suggestions and identify, Jellyfin only returns the providers' addresses (e.g. TMDB) and has no image proxy for them. Other sources (scripts, connections, media) stay as they were.
  - **Server administration:** an entry in the profile menu of every theme, opens `<server>/web/#/dashboard` in a new tab (in proxy mode `/jellyfin/web/`, same origin; checked on the real server). jellyfin-web has its own session; you sign in there once yourself. The entry does not exist in demo mode.
  - **External IDs:** for a movie, Jellyfin also returns the ID of its collection under the same provider name ("TheMovieDb" twice); duplicate names therefore get the media type added ("TheMovieDb (Collection)"). Subtitle languages come from the server's culture list (Jellyfin 12 calls German `deu`, older servers `ger`); the interface language is preselected.
  - **Demo server:** every admin endpoint, with changes kept in memory until the reload (made-up providers "Demo-Archiv", "Kinoregister", "Plakatwand", picture suggestions as color variants of the generated pictures, same origin because of the CSP). Picture tags carry a version number, so changed pictures do not come from the browser cache.
  - **Checked on the real server** (read-only, nothing saved): menu, metadata editor with real data, pictures with suggestions from Fanart and TMDB, identify with TMDB matches, subtitle dialog, scan button, dashboard link through the proxy. Fixed as a result: the dialog content did not scroll (a `1fr` row without a fixed height takes the content height; now a flex column), posters were cropped sideways, the subtitle language was not preselected, the duplicate TMDB label, Esc additionally went back.
  - **Fixed along the way:** Glass on phones: the logo lost its name for screen readers (the text was hidden with `display: none`; the axe check of all pages only runs on desktop, the new admin check also on mobile). When Intl knows no name for a language (`aa`), the name from the server stays. Crimson: after closing the details, the focus occasionally returned to another link with the same address (hero instead of the card; made the release run fail, about 1 in 60 under load, already in phase 12). Cause: the overlay only read the trigger from `document.activeElement` when mounting and otherwise searched by address. Now `AppLink` remembers the link on click (`rememberOverlayOpener` in `navigation/overlay.ts`); 160 repetitions under load without a failure.
  - **Tests:** `e2e/admin.spec.ts` (desktop and mobile: menu per kind of title and by keyboard, metadata including a required field and kept fields, identify, pictures choose/upload/delete, subtitles download/upload/delete, refresh, delete with the jump back, Esc without focus, Esc in the menu does not close Crimson's overlay, scrolling in the dialog, scan library, all six themes with axe and the check that nothing covers the menu, non-admins see nothing), `src/api/admin.test.ts`. Screenshots `a1-…a9-admin-*`.
- **2026-10-15 – Phase 14, make it your own** (details: architecture.md §10.1 and §15.2):
  - **Default for everybody distributed in Jellyfin** (user decision 2026-10-15, the recommendation): Jellyfin has no storage that everybody reads and only administrators write, and Jellymorph has no backend. The default is therefore copied into a DisplayPreferences document of its own, `jellymorph-defaults`, of every user (administrators may write other users' settings, checked in the source: `RequestHelpers.GetUserId`). A version stamp (ISO time) says which copy is newer; when an administrator opens the app, it adds missing or older copies in the background. Rejected: a file `layout.json` in the container folder (cumbersome) and jellyfin-web's custom CSS field as storage (a foreign field). The users' own settings live in another document and are never touched.
  - **One model for four lists** (`src/domain/layout.ts`): home page, navigation, buttons and details of the detail pages; per list the own arrangement, otherwise the default, otherwise the theme. Stored are the order (or `null`) and the hidden entries, so hiding does not freeze the order. New entries (a new library) are placed behind their predecessor from the default. The title picture stays at the top, "Play" always visible, only administrators see "Edit" in the list.
  - **Themes draw what they get:** `HomePageProps.sections` now also contains the title picture and the library tiles in their place, detail pages get `layout` with buttons and details, `NavModel.items` is arranged. Every theme keeps its previous arrangement as `options.layout` (Classic: `default/layout.ts`). Constellation attaches the collections to the tiles as long as they follow directly, otherwise they are a row of their own. Crimson only pulls the rows into the hero when there is one. Classic and Neon Grid used to reorder the navigation by groups; now the model's order applies.
  - **Dragging without a library:** `SortableList` (Classic) with pointer events on the handle and arrow buttons for keyboard and remote control (`aria-disabled` instead of `disabled` at the end of the list, so the focus is not lost), announcements through a live region. Found while testing: the preview moves the DOM node of the dragged row, and that releases the pointer capture; the movement is therefore tracked on `window`.
  - **Own CSS from `/custom`:** the entrypoint finds `custom.css` and `<theme>.css` and writes `customCss` into `config.js`; the app appends them as `<link>` at the end of `<head>` (the theme file only while the theme is active). nginx serves only CSS, fonts and pictures there, without caching. No CSP exception needed. Public are the tokens and the `data-` attributes on `<html>`, not the generated class names. Development and tests: `CUSTOM_DIR` (Playwright: `e2e/fixtures/custom`, mounted in the container test).
  - **Demo server:** `GET /Users` for administrators, and as in Jellyfin only administrators may read and write other users' DisplayPreferences (403 otherwise).
  - **Tests:** `e2e/layout.spec.ts` (hide a home area, move it, it stays after a reload, reset; navigation; buttons and details; dragging with the mouse; applies in every theme; axe; the default for everybody with its effect on another user, whose own arrangement takes precedence), `e2e/customization.spec.ts`, `src/domain/layout.test.ts`, container test for `/custom`. Screenshots `b1-…b3-*`.
- **2026-10-15 – GitHub in English and a new app icon** (user decisions, between phase 14 and 15; shipped with v1.2.0, because its tag was not set yet, so the 1.2.0 release notes are already in English):
  - README, CHANGELOG, docs/architecture.md, docs/themes.md, this file and the headings of the generated release notes (`scripts/lib/changelog.ts`: "Breaking changes", "New", "Fixed", "Faster") are in English. The app itself stays bilingual with German as the default. The README pictures still show the German interface. Repository description and topics are set by the user on GitHub (no `gh` here).
  - **App icon "faceted play"** (chosen from three drafts): a play symbol cut into three facets on a rounded square, in a purple of our own: square `#2a1466`, facets `#d9c9ff` (light), `#b597ff` (mid), `#8f63ff` (deep). Same shape in `public/favicon.svg`, `src/ui/Logo.tsx`, the boot splash in `index.html` and the PNG icons (`scripts/render-icons.ts`, background `#2a1466`). Themes tint the mark with `--logo-shape` and `--logo-dot`; the facets are mixed from those two in oklab, or set exactly with `--logo-facet-mid` and `--logo-facet-deep`. The deep facet spans the whole triangle, so no background shows at the seams.
- **2026-10-25 – 1.2.1, detail pages woke the hard disk** (reported by the user: opening a movie in Jellymorph woke the disk, in jellyfin-web it did not; mostly the backdrop). Cause, checked in the Jellyfin source (`ImageProcessingOptions.HasDefaultOptions`, `ImageProcessor.ProcessImage`): with `quality` ≥ 90 and a `maxWidth` at least as large as the original, Jellyfin skips its cache of resized images and sends the original file, which on the user's server lies on the hard disk. Jellymorph asked for quality 90; jellyfin-web asks for 80 on backdrops (`getDefaultImageQuality`). `src/ui/image-url.ts` now uses 80 for backdrops (so both clients can share cache entries) and 85 for everything else, as planned in architecture.md §5.6; the Media Session artwork uses the same helper. The first request per image and size still reads the original once, as in jellyfin-web. Not checked on the real server (session expired); the user tests it.
- **2026-10-25 – Two more themes before the plugins** (user decisions): a theme modeled on Paramount+ named **Cobalt** (phase 15, v1.3.0) and one modeled on HBO Max named **Onyx**, dark with a blue shimmer rather than the earlier purple (phase 16, v1.4.0). The plugin phase moves to 17 (v1.5.0); its open questions (an opt-in variable `THEME_PLUGINS=true`, the starter template in the repo plus a ZIP at each release) are asked again then. Both concepts in §6 were approved as proposed; only layout principles and interaction patterns are taken over (§2).
- **2026-10-25 – Phase 15, Cobalt:**
  - **Own components:** AppShell (Crimson's bar adapted: transparent over the stage, night blue after scrolling, a white bar under hovered or focused links and a light blue one under the current page, round avatar), Hero (title stage over the full width with a filmstrip, see below), HomePage (channel tiles right after the stage, poster rows, genres as pills), Row (posters by default, `rowVariant` keeps continue watching and next up in landscape; slim full-height arrows under the pointer), MediaCard (white frame and 5 % enlargement on hover and focus; a poster's title and year sit below the picture and fade in, the space is kept so nothing moves), ItemDetailPage and SeriesPage (picture large on the right, logo, facts, tagline, overview and buttons on the left; then the episodes with a season pill, "More like this" as a poster row and a details panel). Sign-in, library, search, favorites, settings, the player and the states are Classic in Cobalt colors.
  - **Filmstrip:** all featured titles as small pictures below the stage; the current one carries a progress bar. The bar is a CSS animation (`transform: scaleX`, 9 s), and its `animationend` brings the next title, so bar and change can never drift apart; hovering or focusing the stage and a playing trailer pause it (`animation-play-state`), the pause button stops it (WCAG 2.2.2), reduced motion and the live preview never start it. Slides cross-fade in one grid cell; titles not shown are `inert`. Layers: pictures, trailer, shade, text, filmstrip.
  - **Colors and font:** night blue `#070e22` with a cobalt glow at the top of the page, accent `#0047ab` (ΔE76 ≈ 32 to the brand blue), white main buttons; Manrope (OFL, `@fontsource-variable/manrope`, a new font dependency like the other themes' fonts).
  - **Found while checking the screenshots:** grids without `grid-template-columns: minmax(0, 1fr)` grew with the filmstrip on phones, and the text left the screen (the page-grid rule of phase 2, again). Poster titles laid over the picture collided with the title in the artwork, so they moved below it. In the details panels of Horizon and Constellation (and first Cobalt), a short fact next to a long one sat in the middle of its row; facts now start at the top (`align-content: start`).
  - **Tests:** `e2e/cobalt.spec.ts` (14 runs on desktop and mobile: switch with font and channel tiles, filmstrip chooses titles, pauses under the pointer, moves on when the bar is full, pause button; posters with captions on hover; film details; season pill and episodes; arrow keys; focus = hover; axe; animation properties; reduced motion), Cobalt added to the accessibility, admin, long-content and arrangement tests. Screenshots `c1-…c9-cobalt-*`, preview picture, README pictures.
- **2026-10-25 – Phase 16, Onyx:**
  - **Own components:** AppShell (a fixed side panel with text from 48rem: brand, search as a field, the navigation in the model's order with a "Libraries" label where the libraries begin and a divider where the main entries return, the profile at the foot with its menu opening upwards; on phones a bar at the top and the main areas at the bottom), Hero (the spotlight, see below), HomePage (ranked row, library cards, genres), Row and MediaCard (landscape cards with the title below; upcoming episodes show "Airs <date>" and a "Soon" badge instead of progress), ItemDetailPage and SeriesPage (a stage over the full width with the light edge; below it season chips, the episodes as a sideways row of large stills with the next one scrolled into view, "More like this", "Extras" with the local trailer, and the details with the cast). Sign-in, library, search, favorites, settings, the player and the states are Classic in Onyx colors.
  - **Spotlight:** about four fifths of the window high (`clamp(30rem, 80vh, 62rem)`), six titles that cross-fade every 10 s, dots as a group "Featured titles" and a pause button (WCAG 2.2.2); titles not shown are `inert`; reduced motion and the live preview never rotate. A blue light line along the bottom edge (`--ox-edge`), the same on the detail stage.
  - **New shared home areas `topRated` and `upcoming`:** Jellyfin has no play counts across users, so the ranked row counts by community rating (movies and series, `minCommunityRating: 1`, ten titles). "Coming soon" uses `/Shows/Upcoming` (`getUpcomingEpisodes`, checked in the SDK). Both are only loaded and only offered in the arrangement when the theme's `layout.home` lists them; Classic's list is therefore explicit now instead of `HOME_AREAS`. `MediaItem.available` (`LocationType !== 'Virtual'`) keeps the play buttons away from episodes without a file, in every theme. The demo server has upcoming episodes for up to five continuing series.
  - **Colors and font:** almost black `#05070d` with a blue shimmer, accent `#6e9cf5` with dark text on it (ΔE76 ≈ 75 to the model's brand blue, ≈ 36 to Cobalt), white main buttons; Instrument Sans (OFL, `@fontsource-variable/instrument-sans`, a new font dependency like the other themes' fonts).
  - **Found while testing:** on phones the page became 1648 px wide and the browser zoomed out: the `visually-hidden` text in the card captions was positioned relative to an ancestor outside the sideways row and escaped its clipping. Every entry of a sideways row is now `position: relative` (Onyx; Cobalt as a precaution, it was not affected), and a new test checks the home and series pages of every theme on a phone (themes.md §4). The season chips first drew their focus ring as a `box-shadow`, so focus and hover differed; focus rings are outlines now. Cobalt's container test failed because Vite inlined a small Manrope file as a `data:` URL, which the CSP (`font-src 'self'`) blocks; fonts are never inlined now, and `check:bundle` fails on `data:font`. The demo logo of "Der Uhrmacher" was cut off, because its width estimate was too small (factor 0.6 now). On the series page the buttons wrapped at 1280 px; the text column is wider.
  - **Tests:** `e2e/onyx.spec.ts` (18 runs on desktop and mobile: switch with font, the side panel, spotlight with dots and pause, ranked row in rating order, upcoming episodes without a play button, season chips and episodes, film details with extras, arrow keys into the panel, focus = hover, axe, animation properties, reduced motion), Onyx added to the accessibility, admin, long-content and arrangement tests. Screenshots `d1-…d9-onyx-*`, preview picture, README pictures.
- **2026-10-07 – MSW 3 through the Vite plugin `msw/vite` in `worker-only` mode.** It serves `mockServiceWorker.js` in the dev server and puts it into `dist/` on build. The file is therefore not in the repo and always matches the installed MSW version. It is started through the stable `setupWorker` API, not the experimental `virtual:msw`.

- **2026-10-07 – SDK 1.0.0 despite the minimum version 10.10.** `@jellyfin/sdk` 1.0.0 is generated against the OpenAPI of Jellyfin 12.0 (classes renamed, e.g. `ItemsApi` → `LibraryApi`, `PlaystateApi` → `SessionApi`). A comparison of all endpoint paths with SDK 0.11.0 (= Jellyfin 10.10) shows: every path the client needs exists unchanged in 10.10. The SDK's `MINIMUM_VERSION` is still 10.10.0. Details: docs/architecture.md §1.2.
- **2026-10-07 – Two hand-written calls through the SDK's Axios instance.** `DELETE /Videos/ActiveEncodings` (ending a transcode on a track switch) is missing from the generated client of SDK 1.0.0. Stream, subtitle and trickplay URLs for `<video>`/`<img>` are built with `api.getUri()` and the query parameter `ApiKey`, because media elements cannot send headers. Details: §5.6 and §9.7.
- **2026-10-07 – TypeScript ~6.0 instead of 7.0.** typescript-eslint 8.71 only supports TypeScript < 6.1.
- **2026-10-07 – Own DeviceProfile generator.** `getBrowserDeviceProfile()` from the SDK only creates subtitle profiles.
- **2026-10-07 – Themes depend on domain types, not on SDK types.** Hooks map `BaseItemDto` to lean types (`MediaItem` …). ESLint forbids imports from `@/api`, the SDK, axios and TanStack Query in `src/themes/**` (§3.3).
- **2026-10-07 – Additions to the theme contract:** `ResumePrompt` and `Toast` as additional components, optional props for `LoadingState`, `ThemeModule.options` (e.g. `detailPresentation: 'page' | 'modal'` for Crimson), `contractVersion` (§7.1).
