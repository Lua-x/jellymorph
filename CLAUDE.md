# CLAUDE.md – Jellyfin Theme Client

Projektname: **Jellymorph** · Repo: `github.com/Lua-x/jellymorph` · Image: `ghcr.io/lua-x/jellymorph`

Diese Datei ist die verbindliche Spezifikation. Lies sie zu Beginn jeder Sitzung vollständig. Weiche nur nach Rückfrage davon ab. Halte Abschnitt 11 (Status) und 12 (Entscheidungen) aktuell.

## 1. Produktziel

Ein eigenständiger, selbst gehosteter Web-Client für Jellyfin, betrieben als Docker-Container. Der Nutzer meldet sich an seinem Jellyfin-Server an und wählt in den Einstellungen ein Theme.

Ein Theme ist kein Farbschema, sondern ein komplettes Bedienkonzept: Layout, Navigation, Kartenformen, Detailseiten, Player-Overlay und Animationen. Vier Themes orientieren sich am Aufbau großer Streaming-Dienste, eines ist ein eigenes Cyberpunk-Design.

Qualitätsmaßstab: Die App soll sich wie ein fertiges kommerzielles Produkt anfühlen, nicht wie eine Demo. Flüssige Animationen (60 fps), keine Layout-Sprünge, sofortiges Feedback bei jeder Interaktion, durchdachte Lade-, Leer- und Fehlerzustände.

## 2. Rechtliche Leitplanken (nicht verhandelbar)

- Keine Logos, Markennamen, Wortmarken, Original-Schriften, Icons oder Grafiken von Netflix, Apple, Amazon, Disney oder anderen Anbietern – weder in Code, Assets, UI noch Dateinamen.
- Übernommen werden nur Layout-Prinzipien und Bedienmuster. Farben: ähnliche Stimmung, keine exakten Markenfarben.
- Themes tragen eigene, neutrale Namen. Im UI keine Hinweise wie „im Stil von …“.
- README: nur allgemeiner Hinweis, dass sich Themes an gängigen Streaming-Oberflächen orientieren, plus Haftungsausschluss (keine Verbindung zu den Anbietern, keine Markenrechte).
- Nur Schriften mit freier Lizenz, selbst gehostet über @fontsource (keine CDN-Abhängigkeit).
- Demo-/Mock-Daten verwenden keine echten Poster, sondern generierte Platzhalterbilder.
- Titel-Logos, Poster und Backdrops der eigenen Medien kommen ausschließlich vom Jellyfin-Server.

## 3. Tech-Stack

| Bereich       | Wahl                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| Framework     | React (aktuelle stabile Version) + TypeScript (strict) + Vite                         |
| API           | @jellyfin/sdk – kein handgeschriebener Fetch, wo das SDK eine Methode bietet          |
| Server-State  | TanStack Query (Caching, Hintergrund-Refresh, Request-Abbruch)                        |
| App-State     | zustand (Session, Einstellungen, Theme)                                               |
| Routing       | react-router                                                                          |
| Listen        | TanStack Virtual für große Bibliotheken                                               |
| Wiedergabe    | hls.js (Safari: natives HLS)                                                          |
| Animation     | Motion (Framer Motion)                                                                |
| Navigation    | Spatial Navigation für Fernbedienung, z. B. @noriginmedia/norigin-spatial-navigation  |
| Styling       | CSS Modules + Design-Tokens als CSS Custom Properties je Theme                        |
| i18n          | i18next – Deutsch (Standard), Englisch                                                |
| Tests         | Vitest + React Testing Library, MSW als Mock-Jellyfin, Playwright (E2E + Screenshots) |
| Code-Qualität | ESLint, Prettier, Conventional Commits                                                |

Keine weiteren größeren Abhängigkeiten ohne Rückfrage.

## 4. Architektur

### Grundprinzip

Strikte Trennung: Datenschicht und Logik sind theme-unabhängig (headless). Themes enthalten nur Darstellung und Bewegung. Ein Theme macht nie eigene API-Aufrufe, sondern nutzt ausschließlich die gemeinsamen Hooks.

### Ordnerstruktur

```
src/
  app/            # Bootstrapping, Router, Provider
  config/         # Laufzeit-Konfiguration (window.__APP_CONFIG__)
  api/            # SDK-Instanz, Auth, Geräte-/Client-Infos, Bild-URL-Helfer
  hooks/          # headless: useHomeSections, useLibrary, useItem, useSeries,
                  #           useSearch, useFavorites, usePlayback …
  player/         # DeviceProfile, PlaybackInfo, hls.js, Reporting, Segmente, Trickplay
  navigation/     # Fokus-/Spatial-Navigation, Tastenkürzel
  settings/       # Einstellungs-Store und Persistenz
  i18n/
  themes/
    contract.ts   # Theme-Vertrag (Typen)
    registry.ts   # alle Themes, Lazy Loading
    ThemeProvider.tsx
    default/      # Referenz-Theme, Fallback für jede Komponente
    neon-grid/
    crimson/
    glass/
    horizon/
    constellation/
  mocks/          # MSW-Handler + Fixtures (Demo-Modus)
docker/
  nginx.conf.template
  entrypoint.sh
e2e/              # Playwright
docs/             # architecture.md, themes.md
.github/workflows/
```

### Theme-Vertrag (Richtwert, in Phase 0 verfeinern)

```ts
import type { ComponentType } from 'react';

export interface ThemeManifest {
  id: string; // 'neon-grid'
  nameKey: string; // i18n-Key Anzeigename
  descriptionKey: string; // i18n-Key Kurzbeschreibung
  preview: string; // Vorschaubild für die Einstellungen
  colorSchemes: Array<'dark' | 'light'>;
  load: () => Promise<ThemeModule>; // eigener Lazy-Chunk
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

Regeln:

- Fehlt einem Theme eine Komponente, wird automatisch die des Default-Themes verwendet.
- Alle Theme-Tokens und globalen Theme-Styles sind unter `[data-theme="<id>"]` gescoped, damit sich Themes beim Wechsel nicht gegenseitig beeinflussen.
- Theme-Wechsel ohne Neuladen der Seite, mit kurzer Überblendung.
- Nicht aktive Themes werden nicht geladen.
- Neues Theme = neuer Ordner + ein Registry-Eintrag. Dokumentiert in docs/themes.md.

### Laufzeit-Konfiguration

Der Container schreibt beim Start `config.js` (`window.__APP_CONFIG__`). Die App liest sie vor dem Rendern. Keine Konfiguration wird beim Build eingebacken.

## 5. Funktionsumfang (gilt für alle Themes)

### Server & Anmeldung

- Server-URL eingeben, Erreichbarkeit und Version prüfen (`/System/Info/Public`), mehrere Server speichern.
- Login per Benutzername/Passwort und Quick Connect; Profilauswahl über öffentliche Benutzer, falls der Server sie anzeigt.
- Nur das Access-Token speichern, nie das Passwort. Abmelden beendet die Session am Server.
- Mindestversion Jellyfin 10.10. Funktionen, die der Server nicht unterstützt, sauber ausblenden.

### Startseite (Inhalte gleich, Anordnung je Theme)

- Hero/Featured mit Backdrop und Titel-Logo
- Weiterschauen, Nächste Folgen, Neu hinzugefügt je Bibliothek, Favoriten, Genres, Sammlungen
- Bibliotheks-Reihenfolge und ausgeblendete Bibliotheken des Benutzers respektieren

### Bibliotheken

- Virtualisiertes Raster, Sortierung (Titel, hinzugefügt, Erscheinungsjahr, Bewertung)
- Filter (Genre, Jahr, gesehen/ungesehen, Favoriten), alphabetische Sprungleiste
- Filme, Serien, Anime je nach Bibliothekstyp, Sammlungen

### Detailseiten

- Film: Backdrop, Logo, Metadaten (Jahr, Laufzeit, Freigabe, Bewertung, Genres), Beschreibung, Besetzung, verfügbare Ton-/Untertitelspuren, Abspielen/Fortsetzen/Von vorne, lokaler Trailer, Favorit, gesehen markieren, ähnliche Titel
- Serie: Staffelauswahl, Episodenliste mit Fortschritt, nächste Folge hervorgehoben

### Suche

- Live-Suche mit Debounce, Ergebnisse nach Typ gruppiert, mit Fernbedienung bedienbar

### Player

- DeviceProfile aus den echten Browser-Fähigkeiten (canPlayType / MediaCapabilities) erzeugen und an PlaybackInfo übergeben. Direct Play wenn möglich, sonst HLS-Transcoding.
- Audio- und Untertitelwahl. Textuntertitel als WebVTT, Bilduntertitel (PGS/VobSub) per Burn-in-Transcoding. Spurwechsel startet bei Bedarf einen neuen Stream an derselben Position.
- Qualitätswahl (max. Bitrate), Geschwindigkeit, Vollbild, Bild-in-Bild
- Trickplay-Vorschaubilder auf der Zeitleiste, falls vorhanden
- „Intro überspringen“ / „Abspann überspringen“ über die MediaSegments-API, falls vorhanden
- Nächste-Folge-Overlay mit Countdown, Auto-Play abschaltbar
- Fortsetzen-Abfrage und Fortschrittsmeldung an Jellyfin (Start, Progress alle 10 s, Pause, Stop), damit „Weiterschauen“ geräteübergreifend stimmt
- Tastenkürzel: Leertaste, F, M, ←/→ (±10 s), ↑/↓ (Lautstärke), Esc; Medientasten der Fernbedienung
- Bei Wiedergabefehlern: verständliche Meldung und automatischer Fallback auf Transcoding

### Einstellungen

- Theme-Auswahl mit Vorschaubildern und Live-Vorschau; Farbschema, wenn das Theme mehrere hat
- Sprache, reduzierte Bewegung, Trailer-Autoplay, nächste Folge automatisch, Standard-Audio-/Untertitelsprache, max. Streaming-Qualität
- Server wechseln, abmelden
- Speicherung lokal (sofort) und pro Benutzer über die DisplayPreferences-API (geräteübergreifend). Beim Login gewinnt der Server-Wert.

### Bedienung & Plattformen

- Maus, Touch, Tastatur und Fernbedienung (Pfeile, Enter, Zurück)
- Jedes interaktive Element ist fokussierbar. Der Fokuszustand ist mindestens so deutlich wie der Hover-Zustand – in jedem Theme gilt: Fokus = Hover.
- Responsiv: Smartphone ab 360 px, Tablet, Desktop, TV in 1080p und 4K (10-Foot-UI mit größerer Schrift und Overscan-Rand)
- Installierbar als PWA (Manifest, Icons; kein Offline-Caching von Medien)
- Bilder immer mit BlurHash-Platzhalter aus Jellyfin

## 6. Themes

Für alle gilt: `prefers-reduced-motion` und die Einstellung „Reduzierte Bewegung“ werden respektiert. Animiert werden nur `transform`, `opacity` und `filter`.

### default – „Classic“

Schlicht und funktional. Referenzimplementierung aller Komponenten, Fallback für andere Themes und Vorlage im Theme-Guide.

### neon-grid – „Neon Grid“ (eigenes Theme, Aushängeschild des Projekts)

Futuristisch, Cyberpunk. Soll mit Abstand am eigenständigsten wirken.

- Farben: fast schwarzer Grund, Neon-Magenta und Cyan als Hauptakzente, Gelb für Aktionen und Warnungen; Leuchten über `text-shadow` / `box-shadow`
- Formen: abgeschrägte Ecken (`clip-path`), HUD-Rahmen mit Eckmarkierungen, perspektivisches Rasterfeld im Hintergrund
- Effekte: Glitch bei Fokus und Seitenwechsel, chromatische Aberration auf Bildern bei Fokus, dezente Scanlines, Text-Scramble beim Einblenden von Titeln
- Login als Boot-Sequenz (überspringbar, nur einmal pro Sitzung)
- Suche im Terminal-Stil mit blinkendem Cursor
- Fortschrittsbalken als segmentierte Energieleisten, Metadaten als HUD-Datenfelder
- Player-Overlay als HUD mit Zeit, Kapiteln und Spuren
- Schriften: z. B. Orbitron oder Rajdhani für Überschriften, Share Tech Mono oder JetBrains Mono für Daten
- Optionale UI-Sounds, standardmäßig aus
- Lesbarkeit hat Vorrang: Textkontrast mindestens WCAG AA, Effekte nie über Fließtext

### crimson – „Crimson“

Orientierung: Netflix

- Profilauswahl „Wer schaut?“ mit großen Avataren der Jellyfin-Benutzer
- Navigation oben, transparent über dem Hero, beim Scrollen deckend
- Großes Hero mit Backdrop, Titel-Logo und Kurzbeschreibung; nach ca. 3 s stummer lokaler Trailer (falls vorhanden und erlaubt), sonst langsamer Ken-Burns-Effekt
- Horizontale Reihen mit Randpfeilen und Querformat-Karten; bei Hover/Fokus nach ca. 400 ms vergrößerte Vorschaukarte mit Abspielen, Favorit, Info und Metadaten
- Detailansicht als Modal über der Startseite, Episoden direkt im Modal
- Fast schwarzer Grund, tiefes Rot als Akzent; Schrift z. B. Inter

### glass – „Glass“

Orientierung: Apple TV

- Zentrierte Tab-Leiste oben in Pillenform mit Blur-Hintergrund
- Vollbild-Hero-Karussell mit automatischem Wechsel und Seitenindikator
- tvOS-Fokuseffekt: Karte hebt sich, leichte 3D-Neigung zur Zeigerposition, Lichtreflex
- Milchglasflächen (`backdrop-filter`), viel Weißraum, große Radien, ruhige Feder-Animationen
- Detailseite: Vollbild-Backdrop mit Verlauf, Titel-Logo statt Text, Glas-Buttons
- Hell- und Dunkelmodus; Schrift z. B. Inter

### horizon – „Horizon“

Orientierung: Prime Video

- Navigation oben mit Textlinks, Profil rechts
- Hero-Karussell mit seitlichen Pfeilen
- Reihen mit 16:9-Karten; bei Hover/Fokus klappt die Karte nach unten auf (Beschreibung, Laufzeit, Buttons)
- Detailseite mit Tabs: Episoden, Ähnliches, Details
- Dunkles Blaugrau, kräftiges Blau als Akzent

### constellation – „Constellation“

Orientierung: Disney+

- Unter dem Hero eine Reihe großer Kacheln für Bibliotheken und Sammlungen, Glow-Rahmen bei Fokus
- Dunkelblauer Verlaufshintergrund mit dezentem Sternenfeld
- Auf Desktop/TV schmale Icon-Seitenleiste, die bei Fokus aufklappt
- Abgerundete Karten mit weichem Schatten, leichte Skalierung bei Fokus

## 7. Docker & Betrieb

- Multi-Stage-Dockerfile: Node (Build) → `nginxinc/nginx-unprivileged:alpine` (Nicht-Root, Port 8080)
- nginx: SPA-Fallback, gzip, Cache-Header (gehashte Assets immutable, `index.html` und `config.js` no-cache), Security-Header (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Entrypoint schreibt `config.js` aus Umgebungsvariablen und rendert die nginx-Config per envsubst. Konfigurationsänderungen brauchen keinen Rebuild.
- Healthcheck-Endpunkt `/healthz`; Betrieb mit read-only Root-Filesystem möglich (benötigte Schreibpfade als tmpfs dokumentieren)
- Beispiel-`docker-compose.yml` im Repo

| Variable                | Zweck                                                                                   | Standard     |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------ |
| `JELLYFIN_URL`          | Server-URL vorbelegen                                                                   | leer         |
| `LOCK_SERVER`           | Server-URL fest, im UI nicht änderbar                                                   | `false`      |
| `JELLYFIN_PROXY_TARGET` | nginx leitet `/jellyfin/` an diesen Server weiter (gleiche Origin, keine CORS-Probleme) | leer         |
| `DEFAULT_THEME`         | Theme für neue Benutzer                                                                 | `default`    |
| `APP_TITLE`             | Titel im Browser                                                                        | `Jellymorph` |

Lokale Entwicklung: Vite-Dev-Proxy auf `JELLYFIN_DEV_URL` aus `.env.local` (in `.gitignore`). Ohne Server läuft die App im Demo-Modus mit MSW.

## 8. CI/CD (GitHub Actions)

- `ci.yml` bei Push und PR: Lint, Typecheck, Unit-Tests, Build, Playwright gegen Mock-Server
- `release.yml`: Multi-Arch-Image (`linux/amd64`, `linux/arm64`) nach ghcr.io über `docker/metadata-action` – Push auf `main` → Tag `edge`; Git-Tag `v*` → Semver-Tags und `latest`, dazu GitHub-Release mit Changelog
- Dependabot für npm, Docker und Actions

## 9. Definition of Done (pro Phase)

- `npm run lint`, `npm run typecheck`, `npm test` und `npm run build` laufen fehlerfrei
- Kein `any`, keine auskommentierten Reste, keine Platzhalter für Kernfunktionen
- Lade-, Leer- und Fehlerzustände umgesetzt
- UI-Phasen: Playwright-Screenshots im Demo-Modus bei 1920×1080, 3840×2160, 1280×800 und 390×844 erzeugen, selbst ansehen, gegen diese Spezifikation prüfen und Mängel beheben
- Tastatur-/Fernbedienungsnavigation durch alle neuen Seiten geprüft
- Status (Abschnitt 11) aktualisiert, Commits nach Conventional Commits

Performance-Ziele: Basis-Bundle ohne Theme < 250 KB gzip, LCP < 2,5 s auf Desktop. Bilder immer über die Jellyfin-Bild-API in passender Größe (`maxWidth`, `quality`), außerhalb des Viewports lazy. Barrierefreiheit: semantisches HTML, ARIA wo nötig, Kontrast WCAG AA.

## 10. Arbeitsweise

- Phasen strikt nacheinander. Am Ende jeder Phase: kurze Zusammenfassung (gebaut, offen, bekannte Einschränkungen), dann auf mein OK warten.
- Ist eine Vorgabe unklar oder technisch schlecht: nachfragen oder begründeten Gegenvorschlag machen, nicht stillschweigend abweichen.
- API-Details gegen die SDK-Typen bzw. die OpenAPI-Spezifikation des Servers prüfen, nicht raten.
- Keine Secrets, Tokens oder privaten Server-URLs committen.
- Code und Code-Kommentare auf Englisch, UI-Texte nur über i18n, README auf Deutsch.

## 11. Phasen & Status

- [x] Phase 0 – Plan: Architektur, finaler Theme-Vertrag, Abhängigkeiten mit Begründung, Player-Datenfluss, Risiken, offene Fragen → docs/architecture.md. Keine Implementierung. _(freigegeben 2026-10-07)_
- [x] Phase 1 – Fundament: Setup, Tooling, ci.yml, Laufzeit-Config, API-Client, Auth (Server, Login, Quick Connect, Profilauswahl), Mock-Server + Demo-Modus, i18n _(fertig 2026-10-07, v0.1.0, Freigabe ausstehend)_
- [ ] Phase 2 – Default-Theme: alle Seiten funktional (Home, Bibliothek, Details, Serien, Suche, Favoriten)
- [ ] Phase 3 – Player: komplett inkl. Reporting, Spuren, Trickplay, Segmente, Nächste Folge
- [ ] Phase 4 – Theme-System: Registry, Fallback, Einstellungen mit Live-Vorschau, Persistenz, Spatial Navigation
- [ ] Phase 5 – Docker & Release: Dockerfile, nginx, Entrypoint, Compose, release.yml
- [ ] Phase 6 – Theme neon-grid
- [ ] Phase 7 – Theme crimson
- [ ] Phase 8 – Theme glass
- [ ] Phase 9 – Theme horizon
- [ ] Phase 10 – Theme constellation
- [ ] Phase 11 – Feinschliff: README mit Screenshots, docs/themes.md, Performance- und Barrierefreiheits-Prüfung, erster Release-Tag v1.0.0

## 12. Entscheidungen & Notizen

Hier trägt Claude Code wichtige Architekturentscheidungen und Abweichungen mit Begründung ein.

- **2026-10-07 – Name „Jellymorph“** (Nutzerentscheidung). „Morph“ steht für den Kern der App: Ein Theme verwandelt die ganze Oberfläche. Der Name war auf GitHub frei; JellyStream, JellyFrame und JellyShift sind schon vergeben. Das Default-Theme heißt deshalb **„Classic“** statt „Jelly“, damit App und Theme nicht verwechselt werden. Kennung im Code und für Jellyfin (`clientInfo.name`, DisplayPreferences-Client): `jellymorph`.
- **2026-10-07 – Antworten auf die offenen Fragen aus docs/architecture.md §19** (Nutzer: „alles ja“, also jeweils die Empfehlung):
  - Zusätzliche Pakete `blurhash`, `@axe-core/playwright` sowie Test- und ESLint-Zubehör sind freigegeben.
  - Neue Container-Variable `DEMO_MODE` (Standard `false`).
  - Audio-/Untertitelsprache, Untertitelmodus und „nächste Folge automatisch“ liegen in der Jellyfin-`UserConfiguration`. Streaming-Qualität und Bedienmodus bleiben lokal pro Gerät.
  - Mehrere gemerkte Profile pro Gerät, mit Schalter „Auf diesem Gerät merken“ beim Login.
  - ASS/SSA werden standardmäßig als WebVTT angezeigt, dazu die Option „gestaltete Untertitel einbrennen“. Kein JASSUB.
  - Musik, Bücher, Fotos, Live-TV und Playlists sind in v1 ausgeblendet.
  - Deutsche Texte in Du-Form.
  - Docker wird nur in GitHub Actions geprüft.
  - Das Demo-Video entsteht per Browser-Aufnahme (MediaRecorder), ohne ffmpeg.
  - Lizenz AGPL-3.0.
  - Browser-Basis: Chrome/Edge ≥ 111, Firefox ≥ 128, Safari ≥ 16.4.
  - Noch offen (Frage 2): Version und Adresse des eigenen Jellyfin-Servers. Bis dahin wird nur gegen den Mock-Server entwickelt.
- **2026-10-07 – Phase 1, Umsetzungsentscheidungen:**
  - axios läuft global mit dem Fetch-Adapter: wegen `keepalive` für die spätere Stop-Meldung und weil MSW 3 im Test-DOM nur `fetch` abfängt.
  - Bild-URLs entstehen über `api.getUri()` in `src/api/urls.ts`. Die SDK-`ImageUrlsApi` kostet ~48 KB, und ihr `getUserImageUrl()` zielt auf eine nicht existierende Route.
  - `UserDto.HasPassword` wird trotz Deprecation gelesen (siehe architecture.md §1.2).
  - Der Theme-Vertrag wächst je Phase. Phase 1 enthält `AppShell`, `LoginPage`, `ProfileSelect`, `HomePage` (vorläufig: Begrüßung + Bibliotheken), `Toast` und die Zustände. `LoginPage` bekommt ein `LoginFlow`-Modell mit den Schritten server/credentials/quickConnect.
  - Der Demo-Server speichert ausgegebene Tokens in `localStorage`, damit eine Sitzung ein Neuladen übersteht, wie bei einem echten Server.
  - Globale Theme-Regeln stehen unter `:where([data-theme='…'])`, damit Komponentenstile immer Vorrang haben.
  - Vor dem ersten Rendern zeigt `index.html` einen neutralen Splash. Fehler beim Start (z. B. Demo ohne Service Worker) erscheinen als zweisprachige Meldung in `app/boot-error.ts`.
  - Version je Phase: Phase n → 0.n.0 (wie bei Crystal).
- **2026-10-07 – MSW 3 über das Vite-Plugin `msw/vite` im Modus `worker-only`.** Es liefert `mockServiceWorker.js` im Dev-Server aus und legt es beim Build in `dist/`. Die Datei liegt also nicht im Repo und ist immer passend zur installierten MSW-Version. Gestartet wird über die stabile API `setupWorker`, nicht über das experimentelle `virtual:msw`.

- **2026-10-07 – SDK 1.0.0 trotz Mindestversion 10.10.** `@jellyfin/sdk` 1.0.0 ist gegen die OpenAPI von Jellyfin 12.0 generiert (Klassen umbenannt, z. B. `ItemsApi` → `LibraryApi`, `PlaystateApi` → `SessionApi`). Ein Abgleich aller Endpunkt-Pfade mit SDK 0.11.0 (= Jellyfin 10.10) zeigt: Jeder Pfad, den der Client braucht, existiert unverändert in 10.10. `MINIMUM_VERSION` des SDK ist weiterhin 10.10.0. Details: docs/architecture.md §1.2.
- **2026-10-07 – Zwei handgeschriebene Aufrufe über die SDK-Axios-Instanz.** `DELETE /Videos/ActiveEncodings` (Transcode beim Spurwechsel beenden) fehlt im generierten Client von SDK 1.0.0. Stream-, Untertitel- und Trickplay-URLs für `<video>`/`<img>` werden mit `api.getUri()` und dem Query-Parameter `ApiKey` gebaut, weil Medienelemente keine Header senden können. Details: §5.6 und §9.7.
- **2026-10-07 – TypeScript ~6.0 statt 7.0.** typescript-eslint 8.71 unterstützt nur TypeScript < 6.1.
- **2026-10-07 – Eigener DeviceProfile-Generator.** `getBrowserDeviceProfile()` aus dem SDK erzeugt nur Untertitelprofile.
- **2026-10-07 – Themes hängen von Domänentypen ab, nicht von SDK-Typen.** Hooks bilden `BaseItemDto` auf schlanke Typen (`MediaItem` …) ab. ESLint verbietet in `src/themes/**` Importe aus `@/api`, dem SDK, axios und TanStack Query (§3.3).
- **2026-10-07 – Ergänzungen zum Theme-Vertrag:** `ResumePrompt` und `Toast` als zusätzliche Komponenten, optionale Props für `LoadingState`, `ThemeModule.options` (u. a. `detailPresentation: 'page' | 'modal'` für Crimson), `contractVersion` (§7.1).
