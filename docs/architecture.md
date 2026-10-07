# Architektur

> Stand: Phase 0 (Plan), 2026-10-07. Die Anforderungen stehen verbindlich in `CLAUDE.md`. Dieses Dokument beschreibt, **wie** sie umgesetzt werden.
> Ergänzungen und Abweichungen sind mit **[Entscheidung]** markiert. Punkte, die eine Antwort brauchen, sind mit **[Frage n]** markiert und in §19 gesammelt.
> Mit „verifiziert“ markierte Aussagen wurden gegen die installierten Pakete geprüft (SDK-Typen, npm-Metadaten). Mit „in Phase n prüfen“ markierte Aussagen beruhen auf Server-Verhalten, das nur ein echter Jellyfin-Server bestätigen kann.

## Inhalt

1. Ausgangslage und geprüfte Fakten
2. Abhängigkeiten
3. Schichten, Ordner, Importregeln
4. Start und Laufzeit-Konfiguration
5. API-Schicht und Anmeldung
6. Datenschicht (headless Hooks)
7. Theme-System
8. Navigation und Eingabe
9. Player
10. Einstellungen und Persistenz
11. Internationalisierung
12. Barrierefreiheit
13. Performance und Budgets
14. Sicherheit
15. Docker und Betrieb (Ausblick Phase 5)
16. Tests und CI
17. Phasenplan im Detail
18. Risiken
19. Offene Fragen

---

## 1. Ausgangslage und geprüfte Fakten

### 1.1 Jellyfin-Server

| Version | Status | Relevanz |
| --- | --- | --- |
| 10.10.x | Mindestversion laut Spezifikation und `MINIMUM_VERSION` des SDK | MediaSegments-API ist ab hier verfügbar |
| 10.11.x | verbreitet | – |
| 12.0.x | seit 07.09.2026 aktuell, neues Versionsschema („10.12“ heißt jetzt „12.0“) | siehe unten |

Was Jellyfin 12.0 für Clients ändert (aus den Release Notes):

- Veraltete Authentifizierungswege sind standardmäßig abgeschaltet. Wir nutzen ausschließlich den Header `Authorization: MediaBrowser …` (SDK-Standard) und für Medien-URLs den Query-Parameter `ApiKey` (SDK-Konstante `AUTHORIZATION_PARAMETER`, verifiziert).
- `/emby/`- und `/mediabrowser/`-Präfixe entfernt: Wir verwenden sie nicht.
- `GET /QuickConnect/Initiate` entfernt: Das SDK nutzt `POST`, sowohl in 1.0.0 als auch in 0.11.0 (verifiziert), funktioniert also auf 10.10 bis 12.0.
- `GetItems` liefert bei `includeItemTypes` zusammen mit Filtern unter Umständen andere Ergebnismengen als 10.11. Bibliotheksfilter testen wir daher gegen 10.11 **und** 12.0 (Phase 2, siehe [Frage 2]).
- Versionsvergleiche laufen ausschließlich über `compareVersions()` aus dem SDK, nie über eigenes String-Parsing.

### 1.2 @jellyfin/sdk 1.0.0 (veröffentlicht 11.09.2026)

- Generiert aus der OpenAPI von Jellyfin 12.0. Viele Klassen wurden umbenannt oder verschoben. Für uns relevant (verifiziert):

  | Zweck | SDK 1.0.0 |
  | --- | --- |
  | Items, Resume, Latest, Similar, lokale Trailer | `getLibraryApi` → `getItems`, `getItem`, `getResumeItems`, `getLatestMedia`, `getSimilarItems`, `getLocalTrailers` |
  | Favorit, gesehen | `getUserDataApi` → `markFavoriteItem`, `unmarkFavoriteItem`, `markPlayedItem`, `markUnplayedItem` |
  | Serien | `getShowApi` → `getSeasons`, `getEpisodes` (mit `startItemId`/`adjacentTo`), `getNextUp` |
  | Bibliotheken | `getUserViewApi` → `getUserViews` |
  | Login, Quick Connect | `getAuthenticationApi` → `authenticateUserByName`, `getQuickConnectEnabled`, `initiateQuickConnect`, `getQuickConnectState`, `authenticateWithQuickConnect` |
  | Benutzer | `getUserApi` → `getCurrentUser`, `getPublicUsers`, `updateUserConfiguration` |
  | Wiedergabe | `getMediaInfoApi` → `getPostedPlaybackInfo`, `getBitrateTestBytes` |
  | Reporting | `getSessionApi` → `reportPlaybackStart`, `reportPlaybackProgress`, `reportPlaybackStopped`, `pingPlaybackSession`, `postFullCapabilities` |
  | Segmente, Trickplay | `getMediaSegmentApi` → `getItemSegments`; `getTrickPlayApi` |
  | Einstellungen | `getDisplayPreferenceApi` → `getDisplayPreferences`, `updateDisplayPreferences` |
  | Suche, Filter, Genres | `getLibraryApi.getItems({ searchTerm })`, `getFilterApi.getQueryFilters`, `getGenreApi.getGenres` |
  | Server-Erkennung | `jellyfin.discovery.getRecommendedServerCandidates()` / `findBestServer()` |
  | Bild-URLs | `getImageApi(api)` liefert `ImageUrlsApi` mit `getItemImageUrl()`, `getItemImageUrlById()`, `getUserImageUrl()` |
  | Live-Updates | `api.subscribe()` über WebSocket (`UserDataChanged`, `LibraryChanged`, `UserUpdated` …) |

- **Kompatibilität mit 10.10, verifiziert:** Ich habe alle Endpunkt-Pfade aus dem generierten Client von 1.0.0 extrahiert und mit SDK 0.11.0 (generiert für 10.10) verglichen. Nur in 1.0.0 vorhanden: `/Backup*`, `/Items/{id}/Collections`, `/SyncPlay/{id}`, `/System/Configuration/Branding`, `/System/Info/Storage`. Keinen davon brauchen wir. Alle Pfade, die der Client nutzt, sind in 10.10 identisch.
- **Fehlt in 1.0.0:** die dynamischen HLS-Endpunkte (`master.m3u8` …) und `DELETE /Videos/ActiveEncodings`. HLS brauchen wir nicht direkt, denn die URL kommt fertig als `MediaSourceInfo.TranscodingUrl` vom Server. `ActiveEncodings` brauchen wir beim Spurwechsel (§9.7) und rufen es deshalb über die SDK-Axios-Instanz auf. **[Entscheidung]**, dokumentiert in CLAUDE.md §12.
- Der `Api`-Konstruktor akzeptiert eine eigene Axios-Instanz. Jede Methode nimmt Axios-Optionen an, also auch `signal` (Abbruch durch TanStack Query) und `fetchOptions: { keepalive: true }` (Stop-Meldung beim Schließen des Tabs; axios 1.20 unterstützt `fetchOptions`, verifiziert).
- `getBrowserDeviceProfile()` erzeugt nur Untertitelprofile. Den DeviceProfile-Generator schreiben wir selbst (§9.3).
- `axios` ist Peer-Dependency (`^1.12`) und damit zwingend.

### 1.3 Werkzeuge (npm-Stand 07.10.2026)

| Paket | Version | Anmerkung |
| --- | --- | --- |
| Node | 24.19 (lokal) | CI ebenfalls Node 24 |
| react / react-dom | 19.3.0 | |
| vite | 8.3.3 | |
| typescript | **~6.0** | 7.0.2 existiert, aber typescript-eslint 8.71 verlangt `<6.1.0` (verifiziert). **[Entscheidung]** |
| eslint | 10.x | `eslint-plugin-jsx-a11y` unterstützt ESLint 10 nicht; im Projekt Crystal hat `eslint-plugin-jsx-a11y-x` funktioniert. In Phase 1 prüfen. |
| vitest | 5.0 | |
| msw | 3.0 | Node ≥ 22.12 |
| @playwright/test | 1.63 | |

### 1.4 Browser-Ziele **[Entscheidung, Frage 3]**

Chrome/Edge ≥ 111, Firefox ≥ 128 (ESR), Safari/iOS ≥ 16.4. Damit stehen Container Queries, `:has()`, `color-mix()`, `inert`, `dvh` und `aspect-ratio` ohne Polyfills zur Verfügung. View Transitions setzen wir nur als progressive Verbesserung ein. Fernseher werden über ihren Browser unterstützt, wenn dieser die Basis erfüllt (aktuelle Android-/Google-TV- und Fire-TV-Browser, neuere webOS-/Tizen-Generationen). Ältere TV-Engines (Chromium < 111) werden nicht per Polyfill unterstützt.

---

## 2. Abhängigkeiten

### 2.1 Laufzeit (laut Spezifikation)

| Paket | Zweck | Begründung | Geladen |
| --- | --- | --- | --- |
| `react`, `react-dom` 19.3 | UI | Spezifikation | Basis |
| `react-router` 8.4 | Routing | Data Router mit `lazy`-Routen, Modal-Routen über `state.backgroundLocation` | Basis |
| `@jellyfin/sdk` 1.0.0 + `axios` 1.20 | API | Spezifikation; axios ist Peer-Dependency. Importe über Unterpfade (`@jellyfin/sdk/lib/utils/api/...`), damit Tree-Shaking greift | Basis |
| `@tanstack/react-query` 5.104 | Server-State | Caching, Abbruch, Hintergrund-Refresh, optimistische Updates | Basis |
| `zustand` 5 | App-State | Session, Einstellungen, Player-Zustand; ~1 KB | Basis |
| `@tanstack/react-virtual` 3.14 | Virtualisierung | Bibliotheksraster | Lazy (Bibliotheksroute) |
| `hls.js` 1.7 | HLS | Transcoding-Wiedergabe außerhalb von Safari | Lazy (Player-Chunk) |
| `motion` 14 | Animation | Nur über `LazyMotion` + `m.*`, Features asynchron nachladen | Basis (klein) + Lazy |
| `@noriginmedia/norigin-spatial-navigation` 3.3 | Fernbedienung | Jetzt aufgeteilt in `-core` und `-react`; zieht `lodash-es` (tree-shakebar) | Basis |
| `i18next` 26 + `react-i18next` 17 | i18n | Spezifikation; `react-i18next` ist die zugehörige React-Bindung | Basis; Sprachdateien Lazy |
| `@fontsource/*` | Schriften | Spezifikation; Import im jeweiligen Theme-Einstieg | Lazy (Theme-Chunk) |

### 2.2 Zusätzlich vorgeschlagen **[Frage 4]**

| Paket | Art | Warum |
| --- | --- | --- |
| `blurhash` 2.0 | Laufzeit, ~1 KB gzip | BlurHash-Platzhalter sind Pflicht. Die Referenzimplementierung ist kleiner als jeder eigene Nachbau und getestet. Encoder nur im Fixture-Skript. |
| `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` | Dev | Übliches Zubehör zu React Testing Library |
| `@axe-core/playwright` | Dev | Automatische Barrierefreiheitsprüfung in E2E (WCAG AA ist Pflicht) |
| `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y-x`, `eslint-config-prettier`, `globals` | Dev | ESLint-Grundausstattung für React + TS + a11y |
| `@vitejs/plugin-react` 6 | Dev | Vite-Integration |

### 2.3 Bewusst **nicht** verwendet

UI-Komponentenbibliotheken, CSS-in-JS, Tailwind, Datums-Bibliotheken (`Intl` reicht), `vite-plugin-pwa`/Workbox (Manifest und minimaler Service Worker sind von Hand schneller geschrieben als konfiguriert), JASSUB/libass (ASS-Rendering im Browser, mehrere MB WASM, siehe [Frage 9]), React Compiler (später möglich, aktuell kein Bedarf).

---

## 3. Schichten, Ordner, Importregeln

### 3.1 Schichten

```
┌────────────────────────────────────────────────────────────────────────┐
│ themes/<id>/        Darstellung + Bewegung (CSS Modules, Tokens, m.*)  │
│   ▲ Props (Domänentypen, QueryResult, Modelle)  ▲ gemeinsame Hooks     │
├───┴───────────────────────────────────────────────┴────────────────────┤
│ app/routes/         Container: rufen Hooks, bauen Props, <ThemeSlot>   │
├────────────────────────────────────────────────────────────────────────┤
│ hooks/  player/  navigation/  settings/  ui/ (theme-neutrale Bausteine)│
├────────────────────────────────────────────────────────────────────────┤
│ domain/             Typen + Mapper (BaseItemDto → MediaItem …)         │
├────────────────────────────────────────────────────────────────────────┤
│ api/                SDK-Instanz, Session, Auth, URLs, Fehlerabbildung  │
├────────────────────────────────────────────────────────────────────────┤
│ config/             window.__APP_CONFIG__ validiert                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Ordnerstruktur (verfeinert)

Gegenüber CLAUDE.md §4 kommen `domain/`, `ui/` und `app/routes/` dazu. **[Entscheidung]**

```
src/
  app/
    main.tsx               # Einstieg: Config → (Demo) → Provider → Router
    providers/             # QueryClient, I18n, Theme, Focus, MotionConfig
    router.tsx             # Routen inkl. Modal-Routen, lazy
    routes/                # Container je Seite (Home, Library, Item, Series, Search, …)
  config/                  # AppConfig-Typ, Validierung, Defaults
  api/
    client.ts              # Jellyfin- und Api-Instanz, Axios-Interceptors
    device.ts              # Device-ID und -Name, ClientInfo
    servers.ts             # Server speichern, prüfen (Discovery)
    session.ts             # Token-Speicher, Login, Logout, 401-Handling
    urls.ts                # Bild-, Stream-, Untertitel- und Trickplay-URLs
    errors.ts              # AxiosError → AppError
  domain/
    types.ts               # MediaItem, ItemDetail, Episode, Season, Library, Person, …
    map.ts                 # BaseItemDto → Domäne (rein, getestet)
    query-result.ts        # QueryResult<T> + Adapter von TanStack Query
  hooks/                   # headless, siehe §6
  player/
    capabilities.ts        # Browser-Fähigkeiten erkennen (async, gecacht)
    device-profile.ts      # Fähigkeiten → DeviceProfile (rein, getestet)
    playback-info.ts       # PlaybackInfo anfordern, Quelle wählen, URLs bauen
    controller.ts          # Zustandsautomat einer Wiedergabe
    engines/native.ts      # <video src> (Direct Play, Safari-HLS)
    engines/hlsjs.ts       # hls.js (dynamischer Import)
    reporting.ts           # Start/Progress/Pause/Stop/Ping
    segments.ts            # MediaSegments → aktive Segmente
    trickplay.ts           # Kachel/Offset für Zeitpunkt (rein, getestet)
    subtitles.ts           # VTT laden, <track> verwalten
    next-episode.ts
    store.ts               # zustand: PlayerModel für das Overlay
  navigation/              # Spatial-Navigation-Setup, Back-Stack, Tastenkürzel, Eingabemodus
  settings/                # Store, Schema, Sync mit DisplayPreferences/UserConfiguration
  ui/                      # theme-neutral: JellyImage, BlurHashCanvas, Focusable, VirtualGrid,
                           #   AppLink, Portal, VisuallyHidden, RouteAnnouncer
  i18n/                    # Setup, Typen; locales/de/*.json, locales/en/*.json
  themes/
    contract.ts  registry.ts  ThemeProvider.tsx  ThemeSlot.tsx  tokens.ts
    default/  neon-grid/  crimson/  glass/  horizon/  constellation/
  mocks/                   # MSW-Handler, Fixtures, Generator-Skripte, Demo-Medien
docker/  e2e/  docs/  scripts/  .github/workflows/
```

### 3.3 Importregeln (per ESLint erzwungen) **[Entscheidung]**

| Bereich | darf nicht importieren | Zweck |
| --- | --- | --- |
| `src/themes/**` | `@/api/**`, `@jellyfin/sdk*`, `axios`, `@tanstack/react-query`, `@/mocks/**`, `@/player/engines/**`, andere Themes (außer `default`); Globals `fetch`, `XMLHttpRequest`, `localStorage` | Themes bleiben reine Darstellung und rufen keine API auf |
| `src/hooks/**`, `src/api/**`, `src/domain/**`, `src/player/**` | `@/themes/**` | Headless bleibt headless |
| alles außer `src/app/main.tsx` | `@/mocks/**` | MSW landet nie im Basis-Bundle |

Umgesetzt mit `no-restricted-imports` und `no-restricted-globals` als Overrides je Dateimuster. Dafür braucht es kein zusätzliches Plugin.

---

## 4. Start und Laufzeit-Konfiguration

### 4.1 `config.js`

`index.html` lädt `<script src="/config.js">` (no-cache, kein Inline-Skript, CSP-kompatibel) vor dem Modul-Einstieg.

```ts
export interface AppConfig {
  jellyfinUrl: string | null;   // JELLYFIN_URL
  lockServer: boolean;          // LOCK_SERVER
  proxyPath: string | null;     // '/jellyfin' wenn JELLYFIN_PROXY_TARGET gesetzt ist, sonst null
  defaultTheme: ThemeId;        // DEFAULT_THEME, unbekannte IDs → 'default' + Warnung
  appTitle: string;             // APP_TITLE
  demoMode: boolean;            // DEMO_MODE – [Frage 5]
}
```

`config/` validiert `window.__APP_CONFIG__` per Type Guard. Fehlende oder ungültige Werte führen zu Defaults und einer Konsolenwarnung, nie zum Absturz. Ist `proxyPath` gesetzt, ist der Server `${location.origin}${proxyPath}`. Die Server-Auswahl entfällt dann, wie bei `lockServer`.

In der Entwicklung liefert ein kleines Vite-Plugin `/config.js` aus `.env.local`. `JELLYFIN_DEV_URL` gesetzt → Dev-Proxy unter `/jellyfin` (gleicher Weg wie in Produktion). Nicht gesetzt → `demoMode: true`.

### 4.2 Startablauf

1. `config.js` lesen und validieren.
2. Im Demo-Modus `import('@/mocks/browser')` laden und den MSW-Worker starten, **bevor** die erste Anfrage läuft.
3. Theme-ID synchron aus `localStorage` lesen (sonst `defaultTheme`). Sofort parallel `load()` des aktiven Themes und des Default-Themes anstoßen.
4. Session synchron aus `localStorage` wiederherstellen. Die App rendert mit gespeichertem Token sofort die Startseite (schnelles LCP). `getCurrentUser` validiert im Hintergrund, ein 401 führt zum Login.
5. Rendern. Bis die Theme-Chunks da sind, zeigt `index.html` einen neutralen CSS-Splash ohne Layout-Sprung.

---

## 5. API-Schicht und Anmeldung

### 5.1 Client und Gerät

- Eine `Jellyfin`-Instanz mit `clientInfo { name: 'Jellymorph', version }` und `deviceInfo { name, id, languages }`. `languages` ist die UI-Sprache und erzeugt den `Accept-Language`-Header.
- **Device-ID:** zufällig (`crypto.getRandomValues`, funktioniert auch in unsicheren HTTP-Kontexten im LAN), einmalig pro Browser in `localStorage`. Gerätename aus User-Agent-Daten (z. B. „Chrome · Windows“).
- **Risiko R6:** Jellyfin bindet Tokens an die Device-ID. Ob ein Login von Benutzer B auf derselben Device-ID das Token von A ungültig macht, prüfe ich in Phase 1 am echten Server. Falls ja: Device-ID pro Benutzer mit Suffix.

### 5.2 Server

- Eingabe wird mit `discovery.getRecommendedServerCandidates(input)` geprüft (probiert Schema und Ports, ruft `/System/Info/Public` ab) und mit `findBestServer()` bewertet. Version < 10.10 → klare Meldung.
- Gespeichert werden: `{ id (ServerId), name, url, version, lastUsed }`, mehrere Server möglich. Bei `lockServer` oder Proxy entfällt die Auswahl.

### 5.3 Anmeldung

- **Passwort:** `authenticateUserByName`. Gespeichert wird nur `{ serverId, userId, userName, accessToken }`, nie das Passwort.
- **Quick Connect:** `getQuickConnectEnabled` → bei `false` ausgeblendet. `initiateQuickConnect` → Code anzeigen → `getQuickConnectState` alle 3 s (abbrechbar, Timeout nach 5 min mit „Neuen Code anfordern“) → `authenticateWithQuickConnect`.
- **Profilauswahl:** `getPublicUsers`. Ohne Passwort (`HasPassword === false`) direkt anmelden, sonst Passwortfeld bzw. Quick Connect. Zeigt der Server keine öffentlichen Benutzer, geht es direkt zum Login-Formular.
- **Gemerkte Profile:** **[Frage 8]** Für „Wer schaut?“ ohne erneute Passworteingabe würde ich pro Gerät mehrere Sessions (Token je Benutzer) speichern. Jedes Profil lässt sich einzeln abmelden.
- **Abmelden:** `api.logout()` (`POST /Sessions/Logout`) beendet die Session am Server. Danach Token löschen, Query-Cache leeren, Player stoppen.
- **401:** Axios-Interceptor → Session als abgelaufen markieren → Login mit Hinweis. Laufende Anfragen werden abgebrochen.

### 5.4 Fehler

`api/errors.ts` bildet Fehler auf `AppError { kind: 'network' | 'auth' | 'forbidden' | 'notFound' | 'server' | 'unsupported' | 'aborted', status?, messageKey }` ab. Themes sehen nur `AppError`. Texte kommen aus i18n.

### 5.5 Abbruch und Wiederholung

Jeder Query-Aufruf reicht `signal` an das SDK durch. Retries: 2 bei Netzwerk- oder 5xx-Fehlern mit Backoff, keine bei 4xx.

### 5.6 URLs

| Ziel | Aufbau |
| --- | --- |
| Bilder | `ImageUrlsApi.getItemImageUrl(item, type, { maxWidth, quality: 85, tag })`. Breite = gerenderte Breite × DPR, gerundet auf eine Stufenleiter (240/360/480/720/960/1280/1920/2560/3840). `srcset` für Hero/Backdrops. Bilder brauchen kein Token. |
| Direct-Play-Stream | `api.getUri('/Videos/{id}/stream', { static: true, mediaSourceId, PlaySessionId, Tag, ApiKey })` |
| Transcoding | `TranscodingUrl` aus PlaybackInfo, wie geliefert, an Basis-URL gehängt |
| Untertitel | Abruf über `getSubtitleApi` als Text → Blob-URL für `<track>` (§9.6) |
| Trickplay-Kacheln | `api.getUri('/Videos/{id}/Trickplay/{width}/{index}.jpg', { MediaSourceId, ApiKey })` |

`api.getUri()` gehört zum SDK. URLs für `<video>`/`<img>` sind keine Fetches, deshalb ist das kein Verstoß gegen „kein handgeschriebener Fetch“.

---

## 6. Datenschicht (headless Hooks)

### 6.1 Domänentypen **[Entscheidung]**

Themes arbeiten mit schlanken, stabilen Typen statt mit `BaseItemDto`:

```ts
export interface ImageRef { itemId: string; type: 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' | 'Banner'; tag: string; blurHash?: string; aspectRatio?: number }

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
  userData: { played: boolean; favorite: boolean; progress?: number /* 0..1 */; positionTicks?: number; unplayedCount?: number };
  episode?: { seriesId: string; seriesName: string; seasonNumber?: number; episodeNumber?: number };
}
```

Dazu `ItemDetail` (Besetzung, Studios, Spuren, Kapitel, `localTrailerCount`, `mediaSources`), `Season`, `Episode`, `Library`, `Person`, `Profile`, `HomeSection`, `SearchGroup`, `FavoriteGroup`. Die Mapper sind reine Funktionen mit Unit-Tests. Wenn eine künftige SDK-Version Felder ändert, ändert sich nur `domain/map.ts`.

```ts
export type QueryResult<T> =
  | { status: 'pending' }
  | { status: 'error'; error: AppError; retry: () => void }
  | { status: 'success'; data: T; isRefreshing: boolean };
```

### 6.2 Hooks → SDK

| Hook | SDK-Aufrufe | Hinweise |
| --- | --- | --- |
| `useServerInfo(url)` | Discovery / `getPublicSystemInfo` | |
| `useLoginFlow()` | Authentication-API, `getPublicUsers` | Modell für LoginPage (Schritte: server, credentials, quickConnect) |
| `useCurrentUser()` | `getCurrentUser` | enthält `Configuration` (OrderedViews, Excludes, Sprachen) |
| `useUserViews()` | `getUserViews({ includeHidden: false })` | Reihenfolge `OrderedViews` und `MyMediaExcludes` wendet der Server an (Phase 2 prüfen). Nicht unterstützte Typen werden gefiltert, siehe [Frage 10]. |
| `useFeatured(n)` | `getItems({ sortBy: Random, includeItemTypes: [Movie, Series], hasOverview, imageTypes: [Backdrop], limit: n, recursive })` | Ergebnis 30 min stabil (`staleTime`), damit das Hero nicht springt |
| `useHomeSections()` | Weiterschauen `getResumeItems({ mediaTypes: [Video] })`, Nächste Folgen `getNextUp`, Neu je Bibliothek `getLatestMedia({ parentId })` ohne `LatestItemsExcludes`, Favoriten `getItems({ isFavorite })`, Genres `getGenres`, Sammlungen `getItems({ includeItemTypes: [BoxSet] })` | Jede Sektion hat ihre eigene Query und lädt parallel. Leere Sektionen werden ausgeblendet. |
| `useLibraryBrowser(source)` | `getItems` seitenweise (`startIndex`, `limit: 100`, `enableTotalRecordCount`) + `getQueryFilters` | Quelle: Bibliothek, Sammlung, Genre oder Person. Sprungleiste: `getItems({ nameLessThan: X, limit: 0 })` → Gesamtzahl = Index (Phase 2 prüfen). |
| `useItem(id)` | `getItem` mit `fields` | |
| `useSimilar(id)` | `getSimilarItems` | |
| `useLocalTrailers(id)` | `getLocalTrailers` | nur wenn `LocalTrailerCount > 0` |
| `useSeasons`, `useEpisodes`, `useSeriesNextUp` | `getSeasons`, `getEpisodes({ seasonId })`, `getNextUp({ seriesId })` | |
| `useSearch(term)` | `getItems({ searchTerm, includeItemTypes })` je Gruppe parallel, Personen über `getPersonApi` | Debounce 300 ms, ab 2 Zeichen, vorherige Ergebnisse bleiben bis zur neuen Antwort sichtbar, veraltete Anfragen werden abgebrochen |
| `useFavorites()` | `getItems({ isFavorite: true })` nach Typ gruppiert | |
| `useMediaActions()` | Favorit, gesehen, abspielen, öffnen | Optimistisch: `setQueriesData` aktualisiert das Item in **allen** gecachten Listen. Bei Fehler Rollback + Toast. |
| `useTrailerPreview(item)` | `getLocalTrailers` + Player-Engine im Vorschaumodus | stumm, nur Desktop/TV, nur mit Einstellung, nicht bei `saveData` |

### 6.3 Query-Keys und Cache

- Keys beginnen immer mit `[serverId, userId, …]`. Beim Abmelden oder Profilwechsel wird `queryClient.clear()` aufgerufen. So können nie Daten eines anderen Benutzers sichtbar werden.
- `staleTime`: Weiterschauen/Nächste Folgen 30 s (+ Refetch bei Fensterfokus und nach jeder Wiedergabe), Item-Details 60 s, Bibliotheksseiten 5 min, Genres/Filter 30 min. `gcTime` 10 min.
- **Live-Updates:** Das SDK abonniert `UserDataChanged`, `LibraryChanged` und `UserUpdated` über WebSocket. Darauf folgen gezielte Invalidierungen. Das hält „Weiterschauen“ synchron, wenn auf einem anderen Gerät geschaut wird. Fällt der WebSocket aus, gibt es keine Fehlermeldung, sondern nur Fokus-Refetch.

---

## 7. Theme-System

### 7.1 Vertrag (final, Version 1)

```ts
// src/themes/contract.ts
import type { ComponentType, ReactNode } from 'react';
import type {
  AppError, Episode, FavoriteGroup, HomeSection, HomeSectionKind, ItemDetail, Library,
  MediaItem, Profile, QueryResult, SearchGroup, Season,
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

export interface AppShellProps { nav: NavModel; children: ReactNode }
export interface LoginPageProps { flow: LoginFlow }
export interface ProfileSelectProps {
  profiles: QueryResult<Profile[]>;
  onSelect: (profile: Profile) => void;
  onOtherUser: () => void;
  onChangeServer?: () => void;          // undefined when the server is locked
}
export interface HomePageProps {
  hero: QueryResult<MediaItem[]>;
  libraries: QueryResult<Library[]>;    // e.g. library tiles below the hero
  sections: readonly HomeSection[];     // each section carries its own QueryResult
}
export interface LibraryPageProps { browser: LibraryBrowser }
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
  results: QueryResult<SearchGroup[]> | null;   // null = nothing searched yet
}
export interface FavoritesPageProps { groups: QueryResult<FavoriteGroup[]> }
export interface SettingsPageProps { settings: SettingsModel }
export interface PlayerOverlayProps { player: PlayerModel }
export interface ResumePromptProps {
  item: MediaItem;
  positionTicks: number;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
}
export interface HeroProps { items: QueryResult<MediaItem[]>; context: RenderContext }
export interface RowProps {
  title: string;
  kind: HomeSectionKind;
  items: QueryResult<MediaItem[]>;
  seeAll?: { to: string };
  context: RenderContext;
}
export interface MediaCardProps { item: MediaItem; variant: CardVariant; context: RenderContext }
export interface ToastProps { kind: 'info' | 'success' | 'error'; message: string; onDismiss: () => void }
export interface LoadingStateProps { variant?: 'page' | 'section' | 'inline' }
export interface EmptyStateProps { title: string; message?: string; action?: { label: string; onAction: () => void } }
export interface ErrorStateProps { error: AppError; onRetry?: () => void }
```

Gegenüber dem Richtwert in CLAUDE.md:

- `ResumePrompt` (Fortsetzen-Abfrage) und `Toast` (Rückmeldung nach Aktionen) sind neu. Beide sind sichtbare, theme-spezifische Elemente.
- `LoadingState` bekommt eine optionale `variant`.
- `ThemeModule.options` für Unterschiede, die die Datenschicht oder das Routing betreffen. Beispiel: Crimson öffnet Details als Modal über der Startseite (`detailPresentation: 'modal'`).
- `contractVersion`, damit spätere Vertragsänderungen auffallen.
- Wiederverwendbare **gemeinsame Hooks und Bausteine für Themes** (alle headless oder theme-neutral): `useThemeComponent(name)`, `useMediaActions()`, `useTrailerPreview()`, `useFocusable()`, `useMotionPreference()`, `useSettings()` (lesend), `useT()`, `<JellyImage>`, `<VirtualGrid>`, `<AppLink>`.
- Seiten wie Genre, Sammlung und Person brauchen keine eigene Komponente. Sie sind `LibraryPage` mit einer anderen `source`.

### 7.2 Registry und Laden

- `registry.ts` enthält nur die Manifeste (klein, Teil des Basis-Bundles) mit `load: () => import('./crimson')`. Jedes Theme ist ein eigener JS- und CSS-Chunk inklusive Schriften und Theme-Texten.
- `ThemeProvider` lädt aktives Theme + Default-Theme parallel (`Promise.all`). Das Default-Theme ist immer nötig, weil es den Fallback stellt. Nicht aktive Themes werden nie geladen. Ausnahme: die Live-Vorschau lädt das angesehene Theme (§7.6).
- Neues Theme = Ordner `themes/<id>/` + ein Eintrag in `registry.ts` + Textschlüssel. Ein Vertragstest prüft jedes Theme automatisch.

```
themes/crimson/
  manifest.ts         # ThemeManifest (statisch)
  index.ts            # ThemeModule – importiert tokens.css, global.css, Schriften, Komponenten
  tokens.css          # [data-theme="crimson"] { --color-bg: … }
  global.css          # nur [data-theme="crimson"] …-Selektoren
  components/*.tsx + *.module.css
  i18n/de.json, en.json
  preview-dark.webp
```

### 7.3 Fallback

`useThemeComponent('MediaCard')` gibt `active.components.MediaCard ?? default.components.MediaCard` zurück. Das Default-Theme ist als `ThemeModule & { components: ThemeComponents }` typisiert und **muss** jede Komponente liefern. Das prüft der Compiler. Jeder `<ThemeSlot>` hat eine Error Boundary: Wirft eine Theme-Komponente, rendert der Slot die Default-Komponente und protokolliert den Fehler. Ein fehlerhaftes Theme legt also nie die App lahm.

Default-Komponenten benutzen nur die gemeinsamen semantischen Tokens. Wenn sie als Fallback in einem anderen Theme laufen, übernehmen sie automatisch dessen Farben, Schriften und Radien.

### 7.4 Tokens und Scoping

- Auf `<html>` sitzen `data-theme`, `data-color-scheme`, `data-motion` (`full`/`reduced`), `data-device` (`desktop`/`tv`/`touch`) und `data-input` (`pointer`/`keyboard`/`touch`).
- `contract.ts` exportiert `REQUIRED_TOKENS`. Mindestumfang: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-on-accent`, `--color-focus`, `--color-danger`, `--color-progress`, `--font-body`, `--font-display`, `--font-mono`, `--radius-card`, `--radius-control`, `--shadow-card`, `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-standard`, `--ease-emphasized`, `--focus-ring`.
- Ein Vitest-Test liest jede `tokens.css`. Er prüft, dass alle Pflicht-Tokens je Farbschema definiert sind, und rechnet die WCAG-Kontraste nach: Text/Hintergrund ≥ 4,5:1, Fokus/Hintergrund ≥ 3:1.
- Globale Theme-Styles stehen ausschließlich unter `[data-theme="<id>"]`. CSS Modules sind ohnehin per Hash isoliert. Weil Theme-CSS nach einem Wechsel im Dokument bleibt, ist das Scoping zwingend. Ein Test prüft, dass jede Regel in `global.css` mit dem eigenen Scope beginnt.
- Theme-neutrale Größen (Abstände, z-Index, Breakpoints, Safe-Area) liegen in `app/base.css` außerhalb jedes Themes.
- Bausteine, die auch in der Live-Vorschau laufen (`Hero`, `Row`, `MediaCard`), verwenden Container Queries und `cqi` statt `vw`/`position: fixed`. So funktionieren sie in einem verkleinerten Container.

### 7.5 Wechsel und Überblendung

`setTheme(id)` lädt den Chunk (bei Bedarf kurzer Ladeindikator am Auswahlelement) und tauscht dann mit `document.startViewTransition()` und einer Überblendung von etwa 250 ms. Ohne View-Transitions-Unterstützung blendet ein Overlay mit `opacity` über. Bei reduzierter Bewegung erfolgt der Wechsel sofort. Es gibt kein Neuladen der Seite, Fokus und Scrollposition bleiben erhalten.

### 7.6 Live-Vorschau in den Einstellungen **[Entscheidung]**

- Die Kacheln der Theme-Auswahl zeigen Vorschaubilder. Diese werden je Theme-Phase per Playwright im Demo-Modus erzeugt, sind also echte Screenshots mit Platzhalterbildern.
- Die **Live-Vorschau** rendert `Hero`, `Row` und `MediaCard` des fokussierten Themes mit **echten Daten** des Benutzers in einem Container mit eigenem `data-theme`/`data-color-scheme`, mit `context: 'preview'`, `inert` und ohne eigenen Fokus.
- „Übernehmen“ wendet das Theme global an (§7.5). Das Farbschema lässt sich in der Vorschau umschalten, wenn das Theme mehrere hat.

### 7.7 Bewegung

- Animiert werden nur `transform`, `opacity` und `filter`. Eine Code-Review-Regel und ein E2E-Test prüfen, dass keine Animation Layout-Eigenschaften anfasst.
- `MotionConfig reducedMotion` folgt `data-motion`. `useMotionPreference()` liefert Themes `'full' | 'reduced'`. Bei `reduced` entfallen Glitch, Ken Burns, Parallax, Neigung und automatische Karussells. Überblendungen bleiben kurz erhalten.
- Neon Grid: Glitch-Effekte flackern maximal 3× pro Sekunde (WCAG 2.3.1) und laufen nie über Fließtext.

### 7.8 Rechtliche Prüfliste je Theme

Vor dem Abschluss jeder Theme-Phase: keine Markennamen in Code, Dateinamen, Kommentaren oder Texten; Farben nur in ähnlicher Stimmung (Abstand zu bekannten Markenfarben dokumentiert); Schriften nur frei lizenziert über `@fontsource`; Icons selbst gezeichnet; keine „im Stil von“-Hinweise im UI.

---

## 8. Navigation und Eingabe

- **Spatial Navigation** (norigin v3) mit `shouldFocusDOMNode: true`: Der Fokus der Bibliothek ist echter DOM-Fokus. Dadurch greifen `:focus-visible`, Screenreader und Fokus = Hover einheitlich.
- **Fokus = Hover:** Jede Theme-Regel für Hover wird als `:is(:hover, :focus-visible)` geschrieben (Konvention im Theme-Guide). Ein E2E-Test fokussiert per Tastatur, hovert per Maus und vergleicht die berechneten Stile ausgewählter Elemente.
- **Eingabemodus:** `data-input` wechselt bei der jeweils letzten Eingabeart. Bei Maus-/Touch-Bedienung bleibt die Spatial Navigation aktiv, springt aber erst beim nächsten Pfeiltastendruck an.
- **Virtualisiertes Raster:** Nicht gerenderte Karten kann die Bibliothek nicht fokussieren. `VirtualGrid` behandelt Pfeiltasten daher selbst (Index-Arithmetik), scrollt den Virtualizer und fokussiert danach. Hohes Risiko, wird in Phase 2 zuerst gebaut (R7).
- **Zurück:** Zentraler Back-Stack. Esc, Backspace (außerhalb von Eingabefeldern), Browser-Zurück und die Zurück-Taste von TV-Fernbedienungen (z. B. `GoBack`/`BrowserBack`, webOS 461, Tizen 10009) schließen zuerst Overlay/Modal, danach `history.back()`.
- **Eingabefelder:** ←/→ bewegen den Cursor. Erst am Textanfang bzw. -ende verlässt der Fokus das Feld.
- **TV-Modus** (`data-device="tv"`): automatisch per User-Agent-Heuristik oder fest per Einstellung (Auto/Desktop/TV). Die Schriftgröße skaliert mit der Breite (1920 px → 24 px rem, 3840 px → 48 px), Overscan-Rand per Einstellung 0–5 % (Standard 3 %), kein Hover-Zwang, größere Fokusringe.
- **Desktop 4K bei DPR 1:** fließende Rem-Größe ab 1440 px (16 px → 32 px bei 3840 px), damit 3840×2160 nicht winzig wirkt.
- **Seitenwechsel:** Fokus springt auf die Überschrift (Tastatur/Screenreader) bzw. auf das erste sinnvolle Element (TV). Seitentitel und Live-Region kündigen den Wechsel an.

---

## 9. Player

### 9.1 Überblick

Der Player besteht aus einer headless Engine (`player/`) und dem vom Theme gestalteten `PlayerOverlay`. Das Overlay bekommt ein `PlayerModel` (Zustand + Befehle) und sieht nie hls.js, URLs oder PlaybackInfo. Route: `/play/:itemId` als Vollbildebene über der vorherigen Seite. Der Player-Chunk inklusive hls.js wird erst geladen, wenn er gebraucht wird. Beim Fokus auf „Abspielen“ wird er vorgeladen.

### 9.2 Datenfluss

```mermaid
sequenceDiagram
  participant O as PlayerOverlay (Theme)
  participant C as PlaybackController
  participant P as DeviceProfile
  participant S as Jellyfin
  participant E as Engine (native | hls.js)

  O->>C: play(itemId, { startTicks?, audioIndex?, subtitleIndex? })
  C->>P: getDeviceProfile() (einmal pro Sitzung erkannt, gecacht)
  C->>S: POST /Items/{id}/PlaybackInfo (DeviceProfile, MaxStreamingBitrate, StartTimeTicks, Audio/SubtitleStreamIndex)
  S-->>C: MediaSources[], PlaySessionId
  C->>C: Quelle wählen → DirectPlay | TranscodingUrl
  C->>S: GET /MediaSegments/{id} (parallel; nur falls vorhanden)
  C->>E: load(url, startSeconds)
  E-->>C: playing
  C->>S: POST /Sessions/Playing (Start)
  loop alle 10 s und bei Pause, Fortsetzen, Sprung, Spurwechsel
    C->>S: POST /Sessions/Playing/Progress
  end
  C->>S: POST /Sessions/Playing/Stopped (Ende, Schließen, pagehide mit keepalive)
```

### 9.3 DeviceProfile

`capabilities.ts` erkennt die Fähigkeiten einmal pro Sitzung. `device-profile.ts` baut daraus das Profil als reine Funktion, mit Unit-Tests über Fähigkeits-Fixtures für Chrome, Firefox, Safari und TV.

- **Video:** H.264 (Profile/Level per `canPlayType('video/mp4; codecs="avc1.640033"')` usw.), HEVC (`hvc1…`, Main/Main10), AV1 (`av01…`), VP9 (`vp09…`). Wo verfügbar, ergänzt `MediaCapabilities.decodingInfo()` die Angaben für Auflösung/Framerate (`smooth`) und HDR (`hdrMetadataType`, `transferFunction: 'pq' | 'hlg'`, `colorGamut: 'rec2020'`, zusätzlich `matchMedia('(dynamic-range: high)')`). Ohne HDR-Fähigkeit dürfen HDR-Quellen nicht direkt laufen (CodecProfile-Bedingung auf `VideoRangeType`), dann übernimmt der Server Tone-Mapping, sofern konfiguriert.
- **Audio:** AAC, MP3, Opus, FLAC, Vorbis, ALAC; AC3/E-AC3 nur, wenn `canPlayType` sie meldet (Safari, Edge). DTS/TrueHD werden nie direkt abgespielt, nur die Audiospur wird transkodiert, Video per Stream-Copy. `MaxAudioChannels` aus `AudioContext.destination.maxChannelCount` (2 oder 6).
- **Container (Direct Play):** mp4/m4v, webm, mov (Safari); mkv nur in Chromium-Browsern. `canPlayType` meldet dort leer, obwohl die Wiedergabe funktioniert. Das ist bewusst User-Agent-basiert; Fehler fängt die Fallback-Kette ab (§9.11).
- **TranscodingProfile:** `Protocol: 'hls'`, `Context: 'Streaming'`, Container `mp4` (fMP4), wenn HEVC unterstützt wird, sonst `ts`; `VideoCodec: 'hevc,h264'` bzw. `'h264'`; `AudioCodec: 'aac,mp3'` (+ac3/eac3 wenn möglich); `BreakOnNonKeyFrames: true`; `MinSegments: 1`.
- **Untertitel:** `vtt` → External. Bildbasierte Formate (`pgssub`, `dvdsub`, `dvbsub`) → Encode (Burn-in). ASS/SSA → siehe [Frage 9].
- **Bitrate:** `MaxStreamingBitrate` aus der Einstellung. „Automatisch“ misst einmal pro Sitzung mit `getBitrateTestBytes` (z. B. 1 MB) und nimmt 80 % davon, höchstens den Serverwert.

### 9.4 Quelle wählen

1. `SupportsDirectPlay` und keine Untertitel mit Burn-in → Direct Play über statische Stream-URL, `PlayMethod: DirectPlay`.
2. Sonst `TranscodingUrl` (Remux/Transcode, vom Server entschieden) → `PlayMethod: Transcode` bzw. `DirectStream`. Die genaue Zuordnung prüfe ich in Phase 3 gegen das Verhalten von jellyfin-web.
3. `PlaybackInfo.ErrorCode` (`NotAllowed`, `NoCompatibleStream`, `RateLimitExceeded`) → verständliche Meldung.

### 9.5 Engines

- **Native** (`<video src>`): Direct Play sowie HLS in Safari (`canPlayType('application/vnd.apple.mpegurl')`). Startposition wird nach `loadedmetadata` gesetzt.
- **hls.js** (dynamischer Import, Worker aktiv): HLS in allen anderen Browsern, `startPosition` in Sekunden. Fatale Fehler erst per `recoverMediaError()`, dann an den Controller.
- Beide implementieren dasselbe Interface (`load`, `play`, `pause`, `seek`, `setRate`, `destroy`, Ereignisse). Der Controller kennt nur das Interface.

### 9.6 Untertitel

- Textuntertitel (`DeliveryMethod: External`) werden über `getSubtitleApi` als WebVTT geladen und als Blob-URL in `<track>` eingehängt. Das vermeidet `crossorigin` am `<video>`. Das ist wichtig, weil Direct-Play-Streams von einem anderen Ursprung sonst CORS-Header bräuchten. Darstellung über `::cue` je Theme (Kontrast, Größe; im TV-Modus größer).
- Bilduntertitel lösen einen neuen PlaybackInfo-Aufruf mit `SubtitleStreamIndex` aus. Der Server liefert eine `TranscodingUrl` mit Burn-in.
- Ausgangsauswahl: Benutzerkonfiguration `SubtitleLanguagePreference`/`SubtitleMode` bzw. Server-Default (`DefaultSubtitleStreamIndex`).

### 9.7 Spur-, Qualitäts- und Geschwindigkeitswechsel

- **Audio:** Browser können Audiospuren in MKV/MP4 praktisch nicht umschalten (`audioTracks` gibt es nur in Safari). Deshalb gilt immer: neuer PlaybackInfo-Aufruf mit `AudioStreamIndex` und `StartTimeTicks` = aktuelle Position, neuer Stream. Der Server remuxt dann in der Regel nur.
- **Untertitel:** Text → nur `<track>` tauschen, kein neuer Stream. Bild → neuer Stream mit Burn-in.
- **Qualität:** neuer PlaybackInfo-Aufruf mit `MaxStreamingBitrate`.
- **Alten Transcode beenden:** `DELETE /Videos/ActiveEncodings?deviceId=…&playSessionId=…` über `api.axiosInstance`. Der Endpunkt fehlt im SDK-1.0-Client, existiert in 10.10/10.11 und wird in Phase 3 auf 12.0 geprüft. Fallback: Der Server beendet verwaiste Transcodes von selbst.
- **Geschwindigkeit** (0,5–2×): rein clientseitig über `playbackRate`.
- Während des Wechsels bleibt das letzte Bild stehen und ein Ladeindikator erscheint. Die Position springt nicht zurück.

### 9.8 Fortschrittsmeldung

- `reportPlaybackStart` beim ersten `playing`. `reportPlaybackProgress` alle 10 s und bei Ereignissen (`EventName`: `pause`, `unpause`, `timeupdate`, `volumechange`, `audiotrackchange`, `subtitletrackchange`), jeweils mit `PositionTicks` (s × 10⁷), `IsPaused`, `IsMuted`, `VolumeLevel`, `PlayMethod`, `MediaSourceId`, `PlaySessionId`, `AudioStreamIndex`, `SubtitleStreamIndex`, `CanSeek`.
- `reportPlaybackStopped` bei Ende, Schließen, Routenwechsel und `pagehide`. Beim Schließen des Tabs läuft der Aufruf über die SDK-Methode mit Axios-`fetchOptions: { keepalive: true }`.
- Bei pausiertem Transcode `pingPlaybackSession` alle 30 s, damit der Server die Sitzung nicht beendet.
- Nach dem Stop werden „Weiterschauen“, „Nächste Folgen“ und das Item invalidiert.

### 9.9 Segmente, Trickplay, Kapitel

- **Segmente:** `getItemSegments({ itemId, includeSegmentTypes: [Intro, Recap, Outro, Preview] })`. Liefert der Server keine Segmente (kein Provider-Plugin), erscheint kein Button. Intro/Recap → „Intro überspringen“. Outro → bei vorhandener nächster Folge das Nächste-Folge-Overlay, sonst „Abspann überspringen“. Der Button ist fokussiert, solange das Segment läuft (Enter = überspringen).
- **Trickplay:** `item.Trickplay[mediaSourceId][width]` mit `TileWidth`, `TileHeight`, `ThumbnailCount`, `Interval`. Gewählt wird die Breite, die 320 px × DPR am nächsten kommt. Kachelindex = `floor(thumb / (TileWidth × TileHeight))`, Offset per CSS `object-position`. Kacheln werden beim ersten Hover/Fokus der Zeitleiste vorgeladen.
- **Kapitel:** `item.Chapters` → Marker auf der Zeitleiste, Kapitelliste im Overlay.

### 9.10 Fortsetzen und nächste Folge

- **Fortsetzen-Abfrage:** Startet „Abspielen“ ohne explizite Wahl und es gibt `PlaybackPositionTicks > 0`, erscheint `ResumePrompt` (Fortsetzen ab mm:ss / Von vorne). Die Detailseite bietet beide Buttons direkt an.
- **Nächste Folge:** `getEpisodes({ seriesId, startItemId: current, limit: 2 })` → zweiter Eintrag. Das Overlay erscheint bei Outro-Beginn, sonst 30 s vor Ende, mit 10-s-Countdown. Abbrechen ist jederzeit möglich. Ob automatisch weitergespielt wird, steuert die Einstellung „nächste Folge automatisch“.

### 9.11 Fehler und Fallback-Kette

```
DirectPlay ──Fehler──▶ PlaybackInfo(EnableDirectPlay=false)            (Remux/DirectStream)
           ──Fehler──▶ PlaybackInfo(EnableDirectStream=false,
                                    AllowVideoStreamCopy=false,
                                    AllowAudioStreamCopy=false)       (volles Transcoding)
           ──Fehler──▶ ErrorState mit verständlicher Meldung + „Erneut versuchen“
```

Auslöser sind `MediaError` (Code 3/4), fatale hls.js-Fehler und ein Stillstand über 15 s ohne Fortschritt trotz Puffer. Der Wechsel geschieht an derselben Position. Der Benutzer sieht einen kurzen Hinweis („Wiedergabe wird angepasst …“), keinen Fehler. Meldungen sind nach Ursache unterschieden: Netzwerk, Format nicht unterstützt, Server verweigert, Rechte.

### 9.12 Steuerung und Plattform-APIs

- **Tastatur:** Leertaste/K Play-Pause, F Vollbild, M Stumm, ←/→ ±10 s, ↑/↓ Lautstärke, Esc schließt das Overlay bzw. den Player. Bei sichtbarem Overlay mit Fokus auf einem Bedienelement navigieren Pfeiltasten zwischen den Elementen. Auf der Zeitleiste spulen ←/→. Bei ausgeblendetem Overlay spulen bzw. regeln die Pfeiltasten direkt (übliches TV-Muster).
- **Medientasten / OS:** `keydown` für `MediaPlayPause`, `MediaPlay`, `MediaPause`, `MediaStop`, `MediaFastForward`, `MediaRewind`, `MediaTrackNext` sowie die Media Session API (Metadaten, Artwork, Aktionen) für Systemsteuerung, Bluetooth-Kopfhörer und Sperrbildschirm.
- **Vollbild** am Player-Container (Overlay bleibt sichtbar). Auf iOS-Safari nur nativ am `<video>`, dann mit Systemsteuerung.
- **Bild-in-Bild:** `requestPictureInPicture`, Button nur bei `document.pictureInPictureEnabled`.
- **Screen Wake Lock** während der Wiedergabe, falls verfügbar.

### 9.13 Trailer-Vorschau im Hero

Nutzt dieselbe Engine stumm, mit niedriger Bitrate und ohne Reporting. Sie startet nur nach 3 s Ruhe auf dem Hero, wenn die Einstellung „Trailer-Autoplay“ an ist, die Bewegung nicht reduziert ist, `saveData` nicht gesetzt ist und das Gerät kein Smartphone ist. Sie stoppt bei Scrollen, Fokuswechsel oder verborgenem Tab.

---

## 10. Einstellungen und Persistenz

| Einstellung | Speicherort am Server | geräteübergreifend |
| --- | --- | --- |
| Theme, Farbschema | DisplayPreferences | ja |
| Sprache | DisplayPreferences | ja |
| Reduzierte Bewegung (System/An/Aus) | DisplayPreferences | ja |
| Trailer-Autoplay, UI-Sounds | DisplayPreferences | ja |
| Nächste Folge automatisch | `UserConfiguration.EnableNextEpisodeAutoPlay` | ja, auch mit anderen Jellyfin-Clients **[Frage 6]** |
| Audio-/Untertitelsprache, Untertitelmodus | `UserConfiguration.AudioLanguagePreference`, `SubtitleLanguagePreference`, `SubtitleMode` | ja, auch mit anderen Jellyfin-Clients **[Frage 6]** |
| Max. Streaming-Qualität | – (nur lokal) | nein: hängt von Gerät und Netz ab **[Frage 7]** |
| Bedienmodus (Auto/Desktop/TV), Overscan | – (nur lokal) | nein |

- **Lokal:** zustand mit `persist` in `localStorage`, Schlüssel je `serverId:userId`. Schreibt sofort.
- **Server:** `DisplayPreferences` mit `displayPreferencesId: 'settings'`, `client: 'jellymorph'`. Eigene Werte als flache Schlüssel in `CustomPrefs` mit Schema-Version. Lesen–Ändern–Schreiben, gebündelt (1 s Debounce). Fehler beim Speichern führen zu einem Toast mit erneutem Versuch.
- **Beim Login gewinnt der Server-Wert:** Nach dem Login werden die Server-Werte geladen, überschreiben die lokalen und werden angewendet (Theme-Wechsel mit Überblendung, falls abweichend).
- **Vor dem Login:** zuletzt auf diesem Gerät benutztes Theme, sonst `DEFAULT_THEME`.
- Ungültige Werte (z. B. unbekannte Theme-ID von einer neueren Version) werden ignoriert, nicht übernommen.

---

## 11. Internationalisierung

- i18next mit Namespaces (`common`, `auth`, `home`, `library`, `item`, `search`, `player`, `settings`, `errors`) plus einem Namespace je Theme (`theme-neon-grid` …), der mit dem Theme-Chunk geladen wird.
- Nur die aktive Sprache wird geladen (dynamischer Import). Deutsch ist Standard, Englisch ist wählbar.
- Typisierte Schlüssel über `CustomTypeOptions` mit den deutschen Dateien als Quelle. Ein Test prüft, dass `en` genau dieselben Schlüssel wie `de` hat.
- Datum, Laufzeit und Zahlen über `Intl`. Mehrzahl über i18next-Plural (`_one`/`_other`).
- Metadaten (Titel, Beschreibungen) kommen in der Server-Sprache. Der `Accept-Language`-Header folgt der UI-Sprache.
- Anrede im Deutschen: „du“ (wie bei Crystal). **[Frage 11]**

---

## 12. Barrierefreiheit

- Semantik: `header`/`nav`/`main`, Überschriften-Hierarchie, Listen für Reihen, `button` statt klickbarer `div`. Skip-Link zum Inhalt.
- Fokusführung bei Seitenwechsel, Modals mit `inert`-Hintergrund und Fokusfalle, Rückkehr des Fokus beim Schließen.
- Live-Region für Routenwechsel, Toasts und Player-Zustände (z. B. „Untertitel: Deutsch“).
- Kontrast: Token-Test (§7.4) und axe in E2E für jede Seite × Theme.
- Bedienelemente des Players mit Beschriftung. Zeitleiste als `role="slider"` mit `aria-valuetext` („12:34 von 1:45:00“).
- Reduzierte Bewegung wie §7.7. Keine Inhalte, die nur per Hover erreichbar sind: Vorschaukarten öffnen sich auch per Fokus, alle Aktionen gibt es zusätzlich auf der Detailseite.

---

## 13. Performance und Budgets

### 13.1 Basis-Bundle < 250 KB gzip

Definition: alles, was `index.html` statisch lädt (Entry-Chunk + statische Importe + CSS), **ohne** Theme-Chunks, Schriften und Bilder.

| Posten | Schätzung gzip |
| --- | --- |
| react + react-dom | ~60 KB |
| react-router | ~25 KB |
| axios + genutzte SDK-Teile | ~25 KB |
| i18next + react-i18next | ~18 KB |
| TanStack Query | ~13 KB |
| Spatial Navigation (+ lodash-es-Teile) | ~8 KB |
| motion (`LazyMotion` + `m`, Features asynchron) | ~6 KB |
| zustand, blurhash | ~2 KB |
| App-Code (Config, API, Hooks, Navigation, Router) | ~40 KB |
| **Summe** | **~200 KB** |

Lazy: jedes Theme, Player inkl. hls.js (~140 KB gzip), Bibliothek (TanStack Virtual), Einstellungen, MSW, Sprachdateien, Motion-Features. Ein CI-Skript (`scripts/check-bundle.mjs`, ohne zusätzliche Abhängigkeit) liest das Vite-Manifest, summiert den Basis-Graphen per zlib-gzip und bricht über 250 KB ab. Theme-Chunks bekommen ein weiches Budget von 80 KB JS gzip (Warnung).

### 13.2 LCP < 2,5 s (Desktop)

Theme- und Default-Chunk werden parallel zur Session-Wiederherstellung geladen. Das Hero-Backdrop bekommt `fetchpriority="high"` und eine passende `srcset`-Größe; alle anderen Bilder `loading="lazy"` + `decoding="async"`. Featured-Items werden pro Sitzung gecacht. Gemessen per Playwright im Demo-Modus (PerformanceObserver) und in Phase 11 zusätzlich per Lighthouse (`npx`, nicht im `package.json`).

### 13.3 60 fps und keine Layout-Sprünge

- Kartencontainer haben feste `aspect-ratio`. Der BlurHash wird auf einem 32×32-Canvas dekodiert, mit Cache je Hash, und darunter skaliert. Das Bild blendet per `opacity` ein.
- Nur `transform`/`opacity`/`filter` animieren. `will-change` nur kurzzeitig. `content-visibility: auto` für Reihen außerhalb des Viewports.
- `backdrop-filter` (Glass) und SVG-/Filter-Effekte (Neon Grid) haben im TV-Modus und bei schwacher Hardware reduzierte Varianten (R9).

---

## 14. Sicherheit

- **Token:** `localStorage` (nötig für Persistenz). Das Risiko XSS wird durch eine strikte CSP ohne `unsafe-inline`/`unsafe-eval` und durch Rendering ohne `dangerouslySetInnerHTML` begrenzt. Server-Texte (Beschreibungen) werden immer als Text gerendert.
- **CSP** (vom Entrypoint gerendert, Phase 5):
  ```
  default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self';
  img-src 'self' data: blob: <JF>; media-src 'self' blob: <JF>;
  connect-src 'self' <JF> <JF-WS>; worker-src 'self' blob:; manifest-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```
  `<JF>`: bei `LOCK_SERVER`+`JELLYFIN_URL` genau diese Origin; im Proxy-Modus nichts zusätzlich; sonst `https: http:` bzw. `wss: ws:`, weil der Benutzer beliebige Server hinzufügen darf. `worker-src blob:` braucht der hls.js-Worker. Inline-Styles über Reacts `style`-Prop setzen CSSOM-Eigenschaften und sind ohne `unsafe-inline` erlaubt.
- Keine Secrets im Repo. `.env.local` steht in `.gitignore`. Demo-Daten enthalten keine echten Personen oder Marken.
- `rel="noopener noreferrer"` für externe Links. `Referrer-Policy: strict-origin-when-cross-origin`. `Permissions-Policy` erlaubt nur `fullscreen`, `picture-in-picture`, `autoplay` und `screen-wake-lock` für `self`.

---

## 15. Docker und Betrieb (Ausblick Phase 5)

- **Build-Stage** `node:24-alpine` auf `$BUILDPLATFORM`: Das statische Ergebnis ist architekturunabhängig, nur die nginx-Stage wird pro Architektur gebaut. Das spart QEMU-Zeit für arm64.
- **Laufzeit** `nginxinc/nginx-unprivileged:alpine`, Port 8080, Nicht-Root.
- **Entrypoint:** validiert die Variablen (Theme-ID gegen Liste, Booleans, URL-Format), schreibt `config.js` mit JSON-Escaping, rendert `nginx.conf` (CSP, optionaler `/jellyfin/`-Proxy mit WebSocket-Upgrade) und `manifest.webmanifest` (Name aus `APP_TITLE`) nach `/tmp/app`.
- **Read-only Root-FS:** einziger Schreibpfad `/tmp` (tmpfs), dokumentiert in README und Compose.
- `/healthz` → 200 aus nginx. Docker-`HEALTHCHECK` mit `wget -q --spider`.
- **PWA:** Manifest, Icons 192/512/maskable (per Skript aus SVG über Playwright erzeugt, keine neue Abhängigkeit), minimaler Service Worker **ohne** Caching von Medien und API. Er wird nur registriert, wenn ein sicherer Kontext besteht und kein Demo-Modus aktiv ist. Im Demo-Modus braucht MSW den Scope.
- **Lokal:** Docker ist auf diesem Rechner nicht installiert. Den Container prüfe ich im CI (Build, Start read-only, `/healthz`, `config.js`, CSP-Header). **[Frage 12]**

---

## 16. Tests und CI

| Ebene | Werkzeug | Inhalt |
| --- | --- | --- |
| Unit | Vitest | Mapper, DeviceProfile aus Fähigkeits-Fixtures, Quellenwahl, Fallback-Kette, Trickplay-Mathematik, Segmente, Reporting-Takt (Fake-Timer), Settings-Merge, Config-Validierung, Token-Kontraste, i18n-Schlüsselgleichheit, Vertragstest für jedes Theme |
| Integration | Vitest + RTL + MSW (Node) | Hooks gegen Mock-Jellyfin, Default-Seiten mit Lade-/Leer-/Fehlerzustand |
| E2E | Playwright + MSW (Browser, Demo-Modus) gegen `vite preview` | Login (Passwort, Quick Connect, Profile), Home, Bibliothek (Sortierung, Filter, Sprungleiste), Details, Serie, Suche, Favoriten, Einstellungen/Theme-Wechsel, Player (Direct Play, Transcoding-Fallback, Spuren, Segmente, nächste Folge), **reine Tastaturdurchläufe**, axe |
| Screenshots | Playwright-Skript | 1920×1080, 3840×2160, 1280×800, 390×844 × Seiten × aktive Themes → `artifacts/screenshots/` (nicht im Repo). Ich sehe sie mir in jeder UI-Phase an. |

**Mock-Jellyfin:** MSW-Handler für alle genutzten Endpunkte mit zustandsbehafteten Fixtures (Favorit, gesehen und Fortschritt ändern sich wirklich). Die Fixtures erzeugt ein Skript: rund 60 Filme, 12 Serien mit Staffeln und Episoden, eine Anime-Bibliothek, Sammlungen, Genres, 3 öffentliche Profile, Segmente, Trickplay, Kapitel. **Bilder** sind generierte SVG-Verläufe mit erfundenem Titel. Die BlurHashes werden aus denselben Verlaufsdaten berechnet. **Demo-Video:** selbst erzeugtes Testbild mit Ton. Ohne ffmpeg auf diesem Rechner (§19, [Frage 13]).

**CI (`ci.yml`, Phase 1):** `npm ci` → lint → typecheck → test → build → Bundle-Budget → Playwright (Chromium; WebKit und Firefox als Smoke-Test für Codec-Unterschiede) → Artefakte (Report, Screenshots). Ab Phase 5 zusätzlich ein Docker-Job.

---

## 17. Phasenplan im Detail

| Phase | Ergebnis |
| --- | --- |
| 1 Fundament | Vite/TS/ESLint/Prettier/Vitest/Playwright, `ci.yml`, Importregeln, Config + Dev-Plugin, API-Schicht (Client, Gerät, Server, Session, Fehler), Login (Passwort, Quick Connect, Profilauswahl, mehrere Server), MSW-Mock mit Fixture-Generator + Demo-Modus, i18n (de/en), Bundle-Budget-Skript, Minimal-Shell des Default-Themes für die Auth-Seiten. Prüfung der Device-ID-Frage (R6). |
| 2 Default-Theme | Domänentypen + Mapper, alle Hooks aus §6.2, Theme-Slot-Mechanik (zunächst nur Default), Home, Bibliothek (VirtualGrid inkl. Tastaturnavigation zuerst), Details, Serie, Suche, Favoriten, Toasts, alle Lade-/Leer-/Fehlerzustände, WebSocket-Invalidierung. |
| 3 Player | Fähigkeiten, DeviceProfile, PlaybackInfo, Engines, Untertitel, Spur-/Qualitätswechsel, Reporting, Segmente, Trickplay, Kapitel, Fortsetzen, nächste Folge, Fallback-Kette, Media Session, Trailer-Vorschau-Engine. |
| 4 Theme-System | Registry mit Lazy Loading, Fallback + Error Boundary, Token-/Scope-Tests, Wechsel mit Überblendung, Einstellungen (alle aus §10) mit Live-Vorschau, Persistenz lokal + Server, Spatial Navigation über alle Seiten, TV-Modus. |
| 5 Docker & Release | Dockerfile, nginx-Template, Entrypoint, Compose, PWA, `release.yml`, Dependabot, Docker-Job im CI. |
| 6–10 Themes | je Theme: Tokens, Schriften, alle abweichenden Komponenten, Bewegung, reduzierte Variante, TV-Variante, Vorschaubild, rechtliche Prüfliste, Screenshot-Prüfung. |
| 11 Feinschliff | README (de) mit Screenshots, `docs/themes.md`, Performance- und a11y-Audit, Changelog, Release v1.0.0. |

---

## 18. Risiken

| # | Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- | --- |
| R1 | SDK 1.0.0 ist gegen 12.0 generiert; das Verhalten (nicht die Pfade) kann auf 10.10/10.11 abweichen | falsche Ergebnisse, z. B. Filter | Pfade verifiziert (§1.2). Mapper tolerant gegenüber fehlenden Feldern. Manuelle Smoke-Tests gegen echte 10.10/10.11/12.0-Server ([Frage 2]). |
| R2 | `ActiveEncodings` fehlt im SDK | verwaiste Transcodes beim Spurwechsel | Handgeschriebener Aufruf über SDK-Axios (§9.7), in Phase 3 auf 12.0 prüfen |
| R3 | Codec-Erkennung im Browser ungenau (HEVC unter Windows nur mit Erweiterung, mkv-Sonderfall, HDR) | Direct Play schlägt fehl | Fallback-Kette (§9.11), Fähigkeits-Fixtures pro Browser |
| R4 | Audiospurwechsel bei Direct Play unmöglich | Spurwechsel braucht neuen Stream | Bewusst immer neuer Stream an derselben Position (§9.7) |
| R5 | CORS/Mixed Content ohne Proxy (HTTPS-Client + HTTP-Server, Server ohne CORS-Freigabe) | Login schlägt fehl | Klare Fehlermeldung mit Hinweis auf `JELLYFIN_PROXY_TARGET`; Proxy-Modus in Compose als Standard empfohlen |
| R6 | Device-ID: mehrere Benutzer auf demselben Gerät verdrängen sich gegenseitig | Profilwechsel meldet andere ab | In Phase 1 am Server prüfen, ggf. Device-ID je Benutzer |
| R7 | Spatial Navigation × Virtualisierung | Fokus geht im Raster verloren | Eigene Pfeiltasten-Logik in `VirtualGrid`, früh in Phase 2 mit E2E abgesichert |
| R8 | Basis-Budget 250 KB ist knapp (~200 KB geschätzt) | Budget gerissen | Budget-Check in CI ab Phase 1, aggressives Lazy Loading |
| R9 | `backdrop-filter`, Glow, Glitch, Filter auf TV-Hardware | Ruckeln unter 60 fps | TV-/Low-Power-Varianten, Effekte auf kleine Flächen, `@supports`-Fallbacks |
| R10 | Neon-Effekte vs. Lesbarkeit/Anfälle | a11y-Verstoß | ≤ 3 Blitze/s, nie über Fließtext, reduzierte Bewegung schaltet ab, Kontrast-Tests |
| R11 | Unsichere Kontexte (HTTP im LAN) | kein Service Worker/PWA, kein Wake Lock, MSW-Demo nur auf localhost | Funktionen per Feature-Detection ausblenden, Hinweis in README |
| R12 | Autoplay-Richtlinien der Browser | Trailer starten nicht | Nur stumm, Fehler still ignorieren und Ken Burns zeigen |
| R13 | Themes wirken zu nah an Markenoberflächen | rechtliches Risiko | Prüfliste §7.8, eigene Namen, eigene Icons, keine exakten Farben |
| R14 | Docker nicht lokal verfügbar | Container-Fehler erst im CI sichtbar | Docker-Job im CI mit Laufzeittests ([Frage 12]) |
| R15 | Kein ffmpeg lokal | kein HLS-Testmaterial für den Demo-Modus | [Frage 13] |

---

## 19. Offene Fragen

Jede Frage hat eine Empfehlung. Ohne Gegenrede würde ich der Empfehlung folgen.

1. ~~**Projektname, Repo, Image.**~~ **Beantwortet 2026-10-07:** *Jellymorph*, Repo `Lua-x/jellymorph`, Image `ghcr.io/lua-x/jellymorph`. Das Default-Theme heißt deshalb „Classic“ (siehe CLAUDE.md §12).
2. **Test-Server.** Welche Jellyfin-Version läuft bei dir, und gibt es eine Adresse für `JELLYFIN_DEV_URL` (bleibt in `.env.local`, wird nie committet)? Ideal wäre zusätzlich je ein 10.10- und 12.0-Testserver. Empfehlung: mindestens dein Server + ein 12.0-Testcontainer im CI für Smoke-Tests.
3. **Browser-/TV-Ziele.** Passt §1.4? Welche Fernseher bzw. Streaming-Sticks willst du konkret nutzen? Davon hängt ab, wie konservativ ich bei CSS und Effekten sein muss.
4. **Zusätzliche Abhängigkeiten aus §2.2** (`blurhash`, `@axe-core/playwright`, Test- und ESLint-Zubehör). Empfehlung: freigeben.
5. **`DEMO_MODE` als zusätzliche Container-Variable** (Standard `false`). Damit ließe sich z. B. eine öffentliche Demo betreiben. Das MSW-Chunk ist ohnehin im Build, weil E2E gegen den Produktions-Build läuft, wird aber nur im Demo-Modus geladen. Empfehlung: ja.
6. **Sprach-, Untertitel- und Autoplay-Einstellungen in der Jellyfin-Benutzerkonfiguration statt in eigenen DisplayPreferences speichern?** Vorteil: gilt auch in jellyfin-web und den offiziellen Apps; der Server nutzt die Werte ohnehin für Standardspuren. Nachteil: Änderungen wirken auch dort. Empfehlung: ja, Benutzerkonfiguration.
7. **Max. Streaming-Qualität und Bedienmodus nur lokal pro Gerät** (nicht synchronisiert), weil sie von Gerät und Netz abhängen. Empfehlung: ja.
8. **Mehrere gemerkte Profile pro Gerät** (ein Token je Benutzer) für „Wer schaut?“ ohne erneutes Passwort? Jedes Profil ist einzeln abmeldbar. Auf geteilten Geräten bedeutet das: Wer das Gerät hat, kann jedes gemerkte Profil öffnen. Empfehlung: ja, mit Schalter „Profil auf diesem Gerät merken“ beim Login.
9. **ASS/SSA-Untertitel** (häufig bei Anime): standardmäßig vom Server in WebVTT umwandeln lassen (keine Transcodierung, aber ohne Styling) plus Einstellung „Gestaltete Untertitel einbrennen“ (Styling bleibt, kostet Server-Transcoding). Echtes ASS-Rendering im Browser (JASSUB) wäre eine große WASM-Abhängigkeit. Empfehlung: VTT + Einbrennen-Option, JASSUB nicht.
10. **Nicht unterstützte Bibliothekstypen** (Musik, Bücher, Fotos, Live-TV, Playlists): in v1 ausblenden? Empfehlung: ausblenden, dazu ein dezenter Hinweis in den Einstellungen.
11. **Anrede in deutschen UI-Texten:** „du“ wie bei Crystal? Empfehlung: ja.
12. **Docker nur im CI prüfen** (wie bei Crystal, kein lokales Docker)? Empfehlung: ja.
13. **Demo-Video ohne ffmpeg:** Testbild + Ton über Chromiums MediaRecorder per Playwright aufnehmen (WebM/MP4 für den Direct-Play-Pfad; keine neue Abhängigkeit). Den HLS-Pfad testen Unit-Tests mit hls.js-Doubles plus dein echter Server. Alternative: ffmpeg einmalig per `winget` installieren, dann gäbe es auch eine HLS-Variante im Demo-Modus. Empfehlung: MediaRecorder; ffmpeg nur, wenn du es ohnehin installieren möchtest.
14. **Lizenz** für das öffentliche Repo: Crystal ist AGPL-3.0. Für einen reinen Client wäre auch MIT oder GPL-3.0 üblich. Code aus jellyfin-web (GPL-2.0) übernehme ich nicht. Empfehlung: AGPL-3.0 wie Crystal, falls du keine andere Präferenz hast.
