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
- [x] Phase 1 – Fundament: Setup, Tooling, ci.yml, Laufzeit-Config, API-Client, Auth (Server, Login, Quick Connect, Profilauswahl), Mock-Server + Demo-Modus, i18n _(fertig 2026-10-07, v0.1.0, freigegeben)_
- [x] Phase 2 – Default-Theme: alle Seiten funktional (Home, Bibliothek, Details, Serien, Suche, Favoriten) _(fertig 2026-10-07, v0.2.0, freigegeben 2026-10-07)_
- [x] Phase 3 – Player: komplett inkl. Reporting, Spuren, Trickplay, Segmente, Nächste Folge _(fertig 2026-10-08, v0.3.0, freigegeben 2026-10-08)_
- [x] Phase 4 – Theme-System: Registry, Fallback, Einstellungen mit Live-Vorschau, Persistenz, Spatial Navigation _(fertig 2026-10-08, v0.4.0, freigegeben 2026-10-08)_
- [x] Phase 5 – Docker & Release: Dockerfile, nginx, Entrypoint, Compose, release.yml _(fertig 2026-10-08, v0.5.0, Freigabe ausstehend)_
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
- **2026-10-07 – Phase 2, Umsetzungsentscheidungen:**
  - Theme-Vertrag v1 ergänzt um `LibraryPage`, `ItemDetailPage`, `SeriesPage`, `SearchPage`, `FavoritesPage`, `Hero`, `Row` und `MediaCard`.
    - `SeriesPageProps.series` ist ein geladenes `ItemDetail` statt eines `QueryResult`: Ob ein Eintrag eine Serie ist, steht erst nach dem Laden fest. Bis dahin zeigt `ItemDetailPage` den Ladezustand.
    - `CardVariant` ist `poster | landscape | episode`.
    - Themes setzen andere Slots über `<ThemeSlot>` zusammen, nicht über `useThemeComponent()` + JSX. So bleibt die Komponentenidentität stabil (React-Compiler-Regel), und jeder Baustein hat eine eigene Fehlergrenze.
  - „Abspielen“-Buttons erscheinen erst mit dem Player in Phase 3. `useMediaActions().play` ist bis dahin `null`, damit es keine toten Buttons gibt.
  - Favorit und gesehen werden sofort im ganzen Cache aktualisiert (optimistisch) und nach der Server-Antwort bestätigt bzw. bei Fehlern zurückgesetzt, mit Toast.
  - Live-Updates kommen über den SDK-WebSocket (`UserDataChanged`, `LibraryChanged`), gebündelt nach 1,5 s.
  - Sortierung und Filter der Bibliothek stehen in der URL (teilbar, Zurück-Taste funktioniert).
  - Die Sprungleiste zählt per `nameLessThan` (klein geschrieben, weil Jellyfin Sortiernamen klein speichert). Das muss am echten Server noch geprüft werden.
  - Jahre im Filter kommen vom Legacy-Endpunkt `/Items/Filters`, weil `/Items/Filters2` keine Jahre liefert.
  - „Nächste Folgen“ auf der Startseite lässt angefangene Folgen weg, die stehen unter „Weiterschauen“. Auf der Serienseite ist die angefangene Folge die nächste.
  - Inhaltsseiten außer der Startseite werden per Lazy Loading nachgeladen.
  - **Theme-Regel:** Seiten-Grids brauchen `grid-template-columns: minmax(0, 1fr)`. Sonst wächst die Spalte mit einer langen Kartenreihe mit, und die Seite scrollt seitlich. Ein E2E-Test prüft das.
  - Der Demo-Server speichert auch Favoriten und den Gesehen-Status pro Benutzer in `localStorage`.
- **2026-10-08 – Phase 3, Umsetzungsentscheidungen:**
  - Der Player ist eine eigene Vollbild-Route `/play/:itemId?start=<Sekunden>` statt einer Ebene über der vorherigen Seite. Die Startposition steht in der URL, ein Neuladen setzt also an derselben Stelle fort. Die vorherige Seite kommt beim Zurückgehen aus dem Cache. Beim Wechsel zur nächsten Folge bleibt der Bildschirm montiert, Vollbild bleibt erhalten.
  - Ohne `start` fragt die Route nach (Slot `ResumePrompt`), wenn eine gespeicherte Position existiert. Serien werden auf die nächste Folge aufgelöst.
  - Quellenwahl wie jellyfin-web (im Quelltext geprüft): `SupportsDirectPlay` oder `SupportsDirectStream` → statische Datei, sonst `TranscodingUrl`. HLS beginnt bei 0, der Player springt selbst an die Startposition. Bei progressivem Transcoding gilt ein Zeitversatz, außer die URL enthält `copytimestamps=true`.
  - DeviceProfile nach den Konventionen von jellyfin-web: `IsSecondaryAudio = false` (Tonspurwechsel immer über einen neuen Stream), MKV per `canPlayType` statt User-Agent (Chrome 153 meldet `maybe`), Untertitel nur als `vtt` extern (der Server wandelt SRT und ASS um), Bilduntertitel werden eingebrannt. „Gestaltete Untertitel einbrennen“ nutzt `AlwaysBurnInSubtitleWhenTranscoding` ohne Direct Play und ohne Video-Stream-Copy.
  - HLS läuft außerhalb von Safari über `hls.js/light` (116 statt 181 KB gzip, nur bei Bedarf geladen). Chrome meldet inzwischen natives HLS, trotzdem bleibt hls.js dort die erste Wahl, weil es erprobter ist.
  - `DELETE /Videos/ActiveEncodings` existiert in Jellyfin 12 weiter (`HlsSegmentController`, per `IgnoreApi` aus der OpenAPI ausgeblendet, deshalb fehlt er im SDK).
  - Die Laufzeit vom Server gilt als Dauer. Browser kennen bei fragmentierten Dateien und laufenden Transcodes oft nur den geladenen Teil.
  - Qualität, Lautstärke und „einbrennen“ sind Geräte-Einstellungen (lokal). „Nächste Folge automatisch“ liest der Player aus `UserConfiguration.EnableNextEpisodeAutoPlay`; die Einstellungsseite dafür kommt in Phase 4. Die Trailer-Vorschau im Hero (architecture.md §9.13) hängt an „Trailer-Autoplay“ und folgt deshalb ebenfalls in Phase 4. Lokale Trailer lassen sich schon jetzt auf der Detailseite abspielen.
  - Theme-Vertrag: neue Slots `PlayerOverlay` (bekommt ein `PlayerModel`) und `ResumePrompt`. Das `<video>`-Element gehört der App, das Overlay liegt darüber. Gemeinsame Bausteine für alle Themes: `useScrubber` (Zeitleiste) und `formatClock` in `src/ui/`.
  - Player-Bildschirme sind in jedem Farbschema dunkel: Die Bühne setzt das aktive Theme mit `data-color-scheme="dark"` erneut (derselbe Mechanismus wie die spätere Live-Vorschau).
  - Classic: Primär-Buttons werden bei Hover und Fokus dunkler statt heller. Vorher hatte weiße Schrift auf dem fokussierten Button nur 3,99:1.
  - **Demo-Video:** Jeder Titel spielt im Demo-Modus denselben 60-Sekunden-Clip. `scripts/record-demo-clip.ts` nimmt ihn per MediaRecorder in Chromium auf (VP9/Opus als fragmentiertes MP4, 2,9 MB) und korrigiert danach VP9-Level und Dauer im Header. Dieselbe Datei dient als Direct-Play-Datei und, über Byte-Ranges, als HLS-Stream. Gespeicherte Positionen beziehen sich im Demo-Modus auf den Clip.
  - Der Demo-Server beantwortet Range-Anfragen für Direct Play selbst: Der MSW-Service-Worker verliert beim Weiterreichen von `<video>`-Anfragen (no-cors) den Range-Header, die Datei wäre sonst nicht spulbar. Für Tests lassen sich Fehler einschalten (`localStorage["jellymorph.demo.faults"]`: `directPlay`, `transcode`, `playbackInfo`).
  - Bekannte Einschränkung im Demo-Modus: Beim Neuladen der Seite geht die Stop-Meldung verloren, weil der Mock-Server im Tab selbst läuft. Bei einem echten Server greift `keepalive`.
- **2026-10-08 – Phase 4, Umsetzungsentscheidungen:**
  - **Eigene Spatial Navigation statt norigin** (`src/navigation/spatial.ts`, keine Abhängigkeit). norigin verlangt, dass jedes fokussierbare Element sich per `useFocusable()` registriert. Bei sechs Themes mit eigenen Komponenten wäre jedes vergessene Element mit der Fernbedienung unerreichbar. Die eigene Lösung sucht das nächste fokussierbare DOM-Element in Pfeilrichtung (Querversatz zählt dreifach). Feste und klebende Leisten sind eine eigene Ebene. Komponenten mit eigener Pfeillogik rufen `preventDefault()` auf. Konventionen für Themes: `data-autofocus` (Einstieg), `data-nav-ignore` (nur per Tab). Details: architecture.md §8.1.
  - **Zurück-Tasten** (Esc, Backspace außerhalb von Feldern, `GoBack`/`BrowserBack`/`XF86Back`, webOS 461, Tizen 10009) gehen nur zurück, wenn es in der App eine vorherige Seite gibt. So verlässt niemand die App aus Versehen.
  - **TV-Modus:** `data-device` = `tv` per Einstellung „Bedienmodus“ (Automatisch/Computer/Fernseher) oder User-Agent-Erkennung bei „Automatisch“. Schrift `clamp(16px, 100vw / 80, 48px)`, Bildrand 0–5 % (Standard 3 %) über `--overscan-x`/`-y` im `--page-gutter`.
  - **Speicherung der Benutzer-Einstellungen:** lokal sofort (`jellymorph.user.<serverId>:<userId>`), am Server in DisplayPreferences `settings`/`jellymorph` mit flachen `CustomPrefs`-Schlüsseln (`jellymorph.theme` …, Schema-Version 1), 1 s gebündelt. Der Server gewinnt beim Start, **außer** eine lokale Änderung hat ihn noch nicht erreicht (Merker `pending`) oder wurde während des Ladens gemacht. Grund: Ohne diese Ausnahme ging eine Änderung verloren, wenn die Seite innerhalb der Wartezeit neu geladen wurde (im E2E-Test gefunden). Zusätzlich sendet `pagehide` einen offenen Stand mit `keepalive`. Gespeichert wird auf Basis des zuletzt gelesenen DTO, ohne erneutes GET; fremde Schlüssel bleiben erhalten.
  - **Live-Vorschau:** `ThemePreview` rendert `Hero` und eine Reihe des gezeigten Themes mit echten Daten in einem 1280 px breiten, skalierten, `inert`en Container mit eigenem `data-theme`/`data-color-scheme`. Classic rechnet in `Hero` und `Row` mit `cqi`. Die Vorschaubilder der Theme-Kacheln entstehen mit `npm run previews` (Playwright im Demo-Modus).
  - **Theme-Wechsel:** Chunk vorladen, dann `document.startViewTransition` + `flushSync` (260 ms), sonst Overlay-Überblendung, bei reduzierter Bewegung sofort. Der Loader merkt sich Status und Wert jedes Promises, damit `use()` beim Zurückwechseln nicht suspendiert.
  - **Motion (Framer Motion) noch nicht installiert:** Classic kommt mit CSS-Übergängen aus. Die Bibliothek folgt mit dem ersten Theme, das Feder-Animationen braucht (Abweichung nur im Zeitpunkt, nicht in der Wahl).
  - **Trailer-Vorschau im Hero** (aus Phase 3 verschoben): `useTrailerPreview` startet den lokalen Trailer stumm nach 3 s Ruhe mit höchstens 3 Mbit/s und ohne Reporting. Nur bei eingeschaltetem Trailer-Autoplay, voller Bewegung, ohne Datensparmodus und nicht auf Touch-Geräten. Stopp bei Scrollen (> 120 px), verborgenem Tab, Titelwechsel und wenn der Fokus den Hero verlässt.
  - **„Nächste Folge automatisch“** steht jetzt in den Einstellungen (Abschnitt Wiedergabe) zusammen mit Ton-/Untertitelsprache und Untertitelmodus. Sie werden in die `UserConfiguration` geschrieben (als Ganzes, optimistisch mit Rücknahme). Die Sprachliste kommt von `/Localization/Cultures`, übersetzt per `Intl.DisplayNames`.
  - Theme-Vertrag: `SettingsPage` ist jetzt Slot, `ToastProps.action` für „Erneut versuchen“, `THEME_SLOTS` mit Compile-Check für den Vertragstest. Ist das gezeigte Theme bereits aktiv, zeigt die Auswahl „Dieses Theme ist aktiv.“ statt eines deaktivierten Buttons.
  - Demo-Server: DisplayPreferences, `UserConfiguration` und `/Localization/Cultures` mit Speicherung in `localStorage`; neuer Fehlerschalter `preferences`. Lange Titel im generierten Logo werden in die Fläche eingepasst.
- **2026-10-08 – Phase 5, Umsetzungsentscheidungen** (Details: docs/architecture.md §15.1):
  - Basis-Images: `node:24-alpine` als Build-Stage auf der Plattform des Build-Rechners (statisches Ergebnis, arm64 braucht keinen emulierten Node-Build) und `nginxinc/nginx-unprivileged:1.31-alpine` (Mainline wie der Tag `alpine` der Vorgabe, aber mit Versionsnummer, damit Dependabot Updates vorschlagen kann).
  - **Eigener Entrypoint** statt der Skripte des Basis-Images: Er prüft alle Variablen und **stoppt den Container bei ungültigen Werten** mit einer Meldung, die die Variable nennt (z. B. Tippfehler in `DEFAULT_THEME`). Die App würde sie still ignorieren; ein Container, der unbemerkt mit Standardwerten läuft, fällt erst viel später auf. Alle Laufzeitdateien liegen in `/tmp/jellymorph`, nginx schreibt nur nach `/tmp`: läuft mit `--read-only`, `--cap-drop ALL` und beliebiger UID.
  - **Proxy** (`JELLYFIN_PROXY_TARGET`) mit Variable in `proxy_pass` und `resolver` aus `/etc/resolv.conf`: Der Container startet auch, wenn Jellyfin noch nicht läuft, und folgt einer neuen Container-Adresse. Pfad und Query gehen unverändert aus `$request_uri` weiter. Einschränkung: In Kubernetes ist der volle DNS-Name nötig (nginx kennt keine Suchdomänen).
  - **CSP je Modus** (Demo/Proxy: nur eigene Origin; `LOCK_SERVER`: genau eine Origin; sonst `https: http:`). Geprüft, indem die CI die komplette E2E-Suite gegen den Container im Demo-Modus laufen lässt; das Fixture `e2e/fixtures.ts` lässt jeden Test bei einer CSP-Verletzung scheitern.
  - **PWA ohne Service Worker** (Abweichung von architecture.md §15, Plan aus Phase 0): Manifest und Icons reichen für „App installieren“ im Browser-Menü (Chrome ab 108/112). Ein Service Worker brächte ohne Offline-Funktionen nur Risiko bei Medienanfragen und würde mit MSW im Demo-Modus um den Scope konkurrieren. Der automatische Installationshinweis von Chrome entfällt deshalb. `APP_TITLE` setzt auch den Namen im Manifest.
  - **Workflows:** `release.yml` ruft bei Push auf `main` und bei Tags `v*` zuerst die ganze CI auf (`workflow_call`) und veröffentlicht nur danach: `main` → `edge`, `v1.2.3` → `1.2.3`, `1.2`, `1` (nicht bei 0.x), `latest` (nicht bei Vorabversionen). `ci.yml` läuft deshalb direkt nur für andere Zweige und Pull Requests, `main` wird nicht doppelt geprüft. GitHub-Releases bekommen Notizen aus den Conventional Commits (`scripts/changelog.ts`, Überschriften auf Deutsch). Tags setzt weiterhin der Nutzer.
  - Der Docker-Job der CI baut amd64 und arm64 und prüft das amd64-Image mit `scripts/test-container.ts` (Header, Caching, Fallback, ungültige Werte, Proxy samt WebSocket gegen einen Node-Ersatzserver, E2E unter CSP). Fehler erscheinen zusätzlich als Annotation, weil Job-Logs ohne Anmeldung nicht lesbar sind.
  - Dependabot wöchentlich: npm (Tooling als eine Gruppe), Docker (ohne Node-Hauptversionen, die folgen `.node-version`), Actions (eine Gruppe).
  - Das Paket auf ghcr.io ist nach dem ersten Push eventuell privat und muss einmalig in den Paket-Einstellungen auf „public“ gestellt werden.
- **2026-10-07 – MSW 3 über das Vite-Plugin `msw/vite` im Modus `worker-only`.** Es liefert `mockServiceWorker.js` im Dev-Server aus und legt es beim Build in `dist/`. Die Datei liegt also nicht im Repo und ist immer passend zur installierten MSW-Version. Gestartet wird über die stabile API `setupWorker`, nicht über das experimentelle `virtual:msw`.

- **2026-10-07 – SDK 1.0.0 trotz Mindestversion 10.10.** `@jellyfin/sdk` 1.0.0 ist gegen die OpenAPI von Jellyfin 12.0 generiert (Klassen umbenannt, z. B. `ItemsApi` → `LibraryApi`, `PlaystateApi` → `SessionApi`). Ein Abgleich aller Endpunkt-Pfade mit SDK 0.11.0 (= Jellyfin 10.10) zeigt: Jeder Pfad, den der Client braucht, existiert unverändert in 10.10. `MINIMUM_VERSION` des SDK ist weiterhin 10.10.0. Details: docs/architecture.md §1.2.
- **2026-10-07 – Zwei handgeschriebene Aufrufe über die SDK-Axios-Instanz.** `DELETE /Videos/ActiveEncodings` (Transcode beim Spurwechsel beenden) fehlt im generierten Client von SDK 1.0.0. Stream-, Untertitel- und Trickplay-URLs für `<video>`/`<img>` werden mit `api.getUri()` und dem Query-Parameter `ApiKey` gebaut, weil Medienelemente keine Header senden können. Details: §5.6 und §9.7.
- **2026-10-07 – TypeScript ~6.0 statt 7.0.** typescript-eslint 8.71 unterstützt nur TypeScript < 6.1.
- **2026-10-07 – Eigener DeviceProfile-Generator.** `getBrowserDeviceProfile()` aus dem SDK erzeugt nur Untertitelprofile.
- **2026-10-07 – Themes hängen von Domänentypen ab, nicht von SDK-Typen.** Hooks bilden `BaseItemDto` auf schlanke Typen (`MediaItem` …) ab. ESLint verbietet in `src/themes/**` Importe aus `@/api`, dem SDK, axios und TanStack Query (§3.3).
- **2026-10-07 – Ergänzungen zum Theme-Vertrag:** `ResumePrompt` und `Toast` als zusätzliche Komponenten, optionale Props für `LoadingState`, `ThemeModule.options` (u. a. `detailPresentation: 'page' | 'modal'` für Crimson), `contractVersion` (§7.1).
