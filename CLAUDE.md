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
- [x] Phase 5 – Docker & Release: Dockerfile, nginx, Entrypoint, Compose, release.yml _(fertig 2026-10-08, v0.5.0, freigegeben 2026-10-08)_
- [x] Phase 6 – Theme neon-grid _(fertig 2026-10-08, v0.6.0, freigegeben 2026-10-09)_
- [x] Phase 7 – Theme crimson _(fertig 2026-10-09, v0.7.0, freigegeben 2026-10-09)_
- [x] Phase 8 – Theme glass _(fertig 2026-10-09, v0.8.0, freigegeben 2026-10-13)_
- [x] Phase 9 – Theme horizon _(fertig 2026-10-13, v0.9.0, freigegeben 2026-10-13)_
- [x] Phase 10 – Theme constellation _(fertig 2026-10-13, v0.10.0, freigegeben 2026-10-14)_
- [x] Phase 11 – Feinschliff: README mit Screenshots, docs/themes.md, Performance- und Barrierefreiheits-Prüfung, erster Release-Tag v1.0.0 _(fertig 2026-10-14, freigegeben 2026-10-14; der Tag `v1.0.0` folgt nach Phase 12)_

### Nach 1.0 (festgelegt 2026-10-14)

Ab hier gilt: Phase n → nächste Minor-Version (1.x.0), Fehlerbehebungen als Patch (1.x.y). Arbeitsweise wie bisher: eine Phase nach der anderen, am Ende Zusammenfassung und OK abwarten.

- [x] Phase 12 – Praxis-Feinschliff vor dem Release: Beschreibung gekürzt mit „Mehr anzeigen“, Ton- und Untertitelspuren auf 3 Einträge gekürzt mit „weitere anzeigen“, HTML-Zeilenumbrüche (`<br>`) aus den Metadaten als Absätze statt als Text, Navigation mit vielen Bibliotheken (Überlauf in ein Menü „Mehr“), Test am echten Server des Nutzers (Bilder, Sprungleiste, Genre-Seiten, Wiedergabe direkt und per Transcoding, Untertitel, Einstellungen am Server). Alles in allen Themes. → v1.0.0, danach setzt der Nutzer den Tag `v1.0.0` _(fertig 2026-10-14, freigegeben 2026-10-14; Tag `v1.0.0` setzt der Nutzer auf 884c446)_
- [x] Phase 13 – Admin-Funktionen je Titel (nur für Administratoren sichtbar): Menü „Bearbeiten“ auf den Detailseiten mit Identifizieren, Metadaten bearbeiten, Bilder (aus Online-Quellen wählen, hochladen, löschen), Metadaten aktualisieren, Untertitel suchen/herunterladen/hochladen/löschen, Eintrag löschen; Bibliothek scannen; „Server-Verwaltung öffnen“ verlinkt das Jellyfin-Dashboard (das Dashboard selbst wird nicht nachgebaut). → v1.1.0 _(fertig 2026-10-14)_
- [ ] Phase 14 – Gestaltung anpassen: eigene Farben, Schriften und CSS je Theme (Dateien aus einem gemappten Ordner, wegen der CSP kein eingefügtes CSS); Anordnung per Einstellung in allen Themes: Reihenfolge und Sichtbarkeit der Knöpfe auf der Detailseite, angezeigte Fakten, Startseiten-Bereiche, Einträge der Navigation; Vorgabe für alle (Admin) und pro Benutzer, per Drag & Drop. Kein fremder Code. → v1.2.0
- [ ] Phase 15 – Eigene Themes als Plugins: öffentliche, versionierte Theme-Schnittstelle, Laden zur Laufzeit aus dem gemappten Ordner, Starter-Vorlage zum Bauen, Auswahl installierter Themes in den Einstellungen. Sicherheitskonzept: Plugin-Themes sind Code mit Zugriff auf die Sitzung, installieren darf nur der Container-Admin. → v1.3.0

Nicht geplant (Nutzerentscheidung 2026-10-14): native Apps für Android/iOS, SSO.

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
  - Das Paket auf ghcr.io ist öffentlich (erbt die Sichtbarkeit des Repositorys); ein anonymer Pull von `edge` mit amd64 und arm64 wurde nach dem ersten Release-Lauf geprüft.
- **2026-10-08 – Phase 6, Neon Grid:**
  - **Eigene Komponenten** für alles, was das Theme prägt: AppShell (HUD-Leiste mit Systemzeit und Operator-Menü über perspektivischem Raster), LoginPage und ProfileSelect (Boot-Sequenz, dann Zugangsterminal), HomePage („Sektoren“, Genre-Tags), Hero, Row, MediaCard, ItemDetailPage und SeriesPage (Dossier mit HUD-Datenfeldern, Episoden-Log), SearchPage (Terminal mit Block-Cursor, der dem Caret folgt), PlayerOverlay (HUD mit Anzeigen für Systemzeit, Kapitel und Spuren, segmentierte Zeitleiste), ResumePrompt, Toast und die Zustände. Bibliothek, Favoriten und Einstellungen sind die Classic-Seiten in Neon-Farben und -Schriften (Überschriften bekommen global Großschrift und Glow).
  - **Schriften** (OFL, `@fontsource`): Orbitron (Überschriften), Rajdhani (Text, mit `font-size-adjust` wegen der kleinen x-Höhe), Share Tech Mono (Daten, Terminal). Nur Latin und Latin-Ext.
  - **Farben:** fast schwarz, Magenta `#ff3bdc`, Cyan `#3ff2ff`, Gelb `#ffd23f` für Aktionen (bewusst nicht das Gelb bekannter Spielemarken). Kontraste prüft der Token-Test.
  - **Effekte** nur mit transform, opacity und filter: Glitch beim Fokus von Karten und auf der Überschrift beim Seitenwechsel, chromatische Aberration per SVG-Filter auf Bildern im Fokus, Scanlines nur über Bildern, Text-Scramble für Titel (die echte Schrift behält Platz und Barrierefreiheit, die Zeichen sind eine dekorative Ebene darüber), Raster mit Fahrt-Animation. Reduzierte Bewegung schaltet alles ab, TVs bekommen die ruhige Variante (kein SVG-Filter, kein Jitter, kein Blur).
  - **Boot-Sequenz** einmal pro Browser-Sitzung (neuer gemeinsamer Hook `useSessionFlag`, weil Themes keinen Storage nutzen dürfen), überspringbar mit jeder Taste, Klick oder dem Button; bei reduzierter Bewegung gar nicht.
  - **UI-Sounds:** per Web Audio erzeugt (keine Dateien), standardmäßig aus. Neue Benutzer-Einstellung `uiSounds` (DisplayPreferences `jellymorph.uiSounds`, Schema bleibt Version 1, alte Stände haben den Wert einfach nicht). Der Schalter erscheint nur für Themes mit `features.uiSounds`.
  - **Vertrag:** `ThemeModule.texts` (eigene Texte als Namespace `theme-<id>`) und `ThemeManifest.features`. `PlayerTimeline` und `PlayerMenu` von Classic nehmen ein `classes`-Objekt, damit Themes die geprüfte Bedienlogik mit eigenem Aussehen nutzen. `AppLink` reicht Anker-Attribute durch; `useRouteKey()` liefert einen Schlüssel für Seitenübergänge.
  - **Tests:** E2E `e2e/neon-grid.spec.ts` (Wechsel, Boot einmal pro Sitzung, Terminal-Suche, Dossier, HUD-Player, Pfeiltasten, Fokus = Hover, axe, Animationseigenschaften, reduzierte Bewegung). Die CSSOM-Prüfung der Animationen ist jetzt der Helfer `layoutAnimations`. Screenshots `30-…41-neon-*`, Vorschaubild per `npm run previews` mit Theme-Auswahl.
- **2026-10-09 – Phase 7, Crimson:**
  - **Eigene Komponenten:** AppShell (Leiste oben, über dem Hero transparent, ab 8 px Scrollen deckend; Profilmenü mit eckigem Avatar), ProfileSelect („Wer schaut?“ mit großen quadratischen Kacheln, Sprachwahl), HomePage (ein Hero, Reihen ragen in seinen unteren Rand, Bibliotheks-Kacheln nach den ersten zwei Reihen, Genres am Ende), Hero, Row (Querformat, Randpfeile, Seitenanzeige, ←/→), MediaCard mit Vorschaukarte, ItemDetailPage und SeriesPage als Overlay, SearchPage, PlayerOverlay. Anmeldung, Bibliothek, Favoriten, Einstellungen, Zustände, Toast und Fortsetzen-Abfrage sind Classic in Crimson-Farben.
  - **Farben und Schrift:** fast schwarz `#0f0f10`, Akzent `#d31d34` (ΔE76 ≈ 21 zum Rot des Vorbilds), Inter (OFL, schon von Classic geladen). App-Titel weiß statt einer roten Wortmarke.
  - **Details als Overlay** über der Seite, von der sie kommen (architecture.md §7.9): Descendant-Routen mit `state.backgroundLocation`, die Seite bleibt montiert und `inert`, Zurück stellt sie unverändert wieder her. Direkt aufgerufen sind Details eine normale Seite. Nur `/item/:id` kann Overlay sein; Overlay-Links im Overlay ersetzen den Verlaufseintrag, damit Schließen immer zur Seite führt. Gefundener Fehler auf dem Weg: Der Staffelwechsel (`?season=`) verlor den History-State und machte aus dem Overlay eine Seite, behoben für alle Themes. Episoden stehen direkt im Overlay (Staffel als natives `select`, ganze Zeile spielt die Folge, nächste Folge hervorgehoben).
  - **Vorschaukarte:** öffnet 400 ms nach Hover oder Tastatur-/Fernbedienungsfokus, nicht auf Touch-Geräten und nicht im Overlay. Sie liegt als Portal in Dokumentkoordinaten über der Karte: Reihen schneiden sie nicht ab, und sie gehört zur Inhaltsebene der Pfeilnavigation. Abspielen, Favorit, gesehen, „Mehr“ (öffnet die Details), Freigabe, Jahr, Laufzeit, Bewertung, Genres. Esc schließt sie, Fokus bleibt auf der Karte. Weil sie die Karte verdeckt, trägt sie den weißen Fokusrahmen, solange die Karte fokussiert ist (WCAG 2.4.11), und genauso beim Hover.
  - **Hero:** ein Titel, Ken-Burns-Drift (26 s, TV 40 s) bis der stumme Trailer nach 3 s übernimmt (gemeinsamer `useTrailerPreview`); Logo wird dann kleiner, Beschreibung blendet aus. Das Bild endet 4 px vor der Unterkante, sonst scheint es an der kantengeglätteten Bruchpixel-Kante als heller Strich durch.
  - **Player:** Zurück-Pfeil oben, rote Zeitleiste mit Restzeit, Titel mittig in der Steuerleiste; nach 6 s Pause ohne Eingabe weichen die Bedienelemente einem „Du siehst gerade“ mit Beschreibung über abgedunkeltem Bild. Zeitleiste und Menüs sind die Classic-Bausteine mit Crimson-Klassen.
  - **Vertrag:** `ThemeOptions.cardShape` (`'mixed' | 'landscape'`) für die übernommenen Classic-Seiten. `AppLink` hat `overlay` und `ref`.
  - **Tests:** `e2e/crimson.spec.ts` (12 Tests: Wechsel, Overlay mit Zurück/Esc/Scroll/Fokus, Ersetzen aus „Mehr wie dieses“, Seite bei Direktaufruf, Vorschaukarte per Maus und Tastatur, Staffelwechsel, Profile, Player mit Pausenansicht, Pfeiltasten, Fokus = Hover, axe, Animationseigenschaften, reduzierte Bewegung), `navigation/overlay.test.ts`. Screenshots `50-…63-crimson-*`.
- **2026-10-09 – Phase 8, Glass:**
  - **Motion jetzt installiert** (`motion` 13.5, wie in §3 vorgesehen und in Phase 4 angekündigt), nur im Glass-Chunk: Basis-Bundle unverändert 183 KB, Glass 50 KB JS. Version 14 war beim Einbau eine Woche alt (neue Hauptversion), deshalb 13.x.
  - **Eigene Komponenten:** AppShell (drei schwebende Glasstücke: Marke links, zentrierte Pille mit Suche und Abschnitten, Profil rechts; aktiver Abschnitt als massive Pille; auf dem Handy eine schwebende Tab-Leiste unten), Hero (Vollbild-Karussell, 8 s je Titel, Überblendung mit langsamem Ausklingen des Bilds, Textwechsel mit Feder, Fortschritt in der Seitenanzeige, Pause-Knopf nach WCAG 2.2.2, Stopp bei Hover, Fokus, Trailer und reduzierter Bewegung), Row (Regale mit Platz für angehobene Karten, gläserne Pfeile nur unter dem Zeiger), MediaCard (Fokuseffekt `useLift`: anheben, unter der Maus zur Zeigerposition neigen, Lichtreflex; Titel darunter weicht aus), HomePage (Bibliotheks-Kacheln mit Glasstreifen, Genre-Chips), ItemDetailPage und SeriesPage (Vollbild-Bühne mit Verlauf, Titel-Logo statt Text, Glas-Knöpfe; darunter Besetzung als runde Porträts, Ähnliches, Info-Panel; Staffeln als Segment-Pille, Episoden als Regal, die nächste Folge wird angesprungen; jede Episode hat einen Info-Knopf zur eigenen Seite), SearchPage, PlayerOverlay (Glaspanel mit Titel, Zeitleiste zwischen gesehener und verbleibender Zeit, Wiedergabe mittig). Anmeldung, Bibliothek, Favoriten, Einstellungen und Zustände sind Classic in Glass-Farben.
  - **Hell und Dunkel:** Text über Bildern (Hero, Bühne, Player) ist in beiden Schemata hell auf dunklem Verlauf. Leisten mit Text haben eine dichtere Glasstufe (`--gl-bar`), damit der Kontrast auch über weißen oder schwarzen Bildern reicht. Auf Fernsehern kein Blur (teuer für die Grafikchips), dafür dichteres Glas. Fokusringe in `rem`, also im TV-Modus 1,5-mal so dick; massive Knöpfe bekommen einen dunklen Abstand vor dem Ring.
  - **Farben:** Akzent `#4256cf`/`#2456c8` (ΔE76 ≥ 16 bzw. ≥ 12 zu bekannten Systemblautönen), Hauptaktionen weiß bzw. fast schwarz.
  - **Tests:** `e2e/glass.spec.ts` (11 Tests: Wechsel, Karussell dreht und hält per Pause-Knopf, Karte hebt sich und neigt sich nur unter der Maus, Detailseite, Staffel-Tabs und Episoden, Player, helles Schema mit axe, Pfeiltasten, Fokus = Hover nach dem Einschwingen der Federn, axe, Animationseigenschaften, reduzierte Bewegung). Der Helfer `waitForAnimations` ignoriert jetzt auch langsame Hintergrundbewegungen ab 5 s, sonst wartet er im Glass-Hero ewig. Der Pfeiltasten-Test von Neon Grid drückt jetzt, bis der Fokus ankommt (wackelte unter Last). Screenshots `70-…80-glass-*` in beiden Schemata.
  - **README:** Bis zum ersten Release-Tag gibt es nur `edge`; das steht jetzt dort.
- **2026-10-13 – Images ohne Docker Hub** (architecture.md §15.1): Der Release-Lauf zum Tag `v0.8.0` und der Lauf danach scheiterten im Docker-Job, weil Docker Hub nicht antwortete und GitHub-Runner ins anonyme Pull-Limit laufen. Node, Dockerfile-Frontend, BuildKit und QEMU kommen jetzt über `mirror.gcr.io`, nginx-unprivileged über `ghcr.io/nginx/nginx-unprivileged` (dasselbe Herstellerimage wie `nginxinc/nginx-unprivileged` aus §7, nur eine andere Registry). README bekam einen Kopf mit Logo und Status-Badges (CI auf `main`, Release, Image, Lizenz).
- **2026-10-13 – Phase 9, Horizon:**
  - **Eigene Komponenten:** AppShell (deckende, klebende Leiste mit Textlinks, weißer Balken bei Hover und Fokus, blauer für die aktuelle Seite; Suche und Profil mit Namen rechts; auf dem Handy eine Leiste unten), Hero (breites Karussell unter der Leiste: Bild rechts mit Verlauf, Text links; die Titel gleiten seitlich, große Pfeile an beiden Rändern, Punkte und Pause-Knopf darunter, 10 s je Titel, Titel außerhalb des Bilds sind `inert`), Row (16:9-Karten, „Alle anzeigen“ rechts, runde Pfeile), MediaCard (klappt 250 ms nach Hover oder Fokus nach unten auf: Bild bleibt an seinem Platz, darunter Titel, Abspielen, Favorit, Details, Fakten und Beschreibung; Portal wie bei Crimson, eigener Fokusrahmen), HomePage, ItemDetailPage und SeriesPage (Kopf mit Bild rechts, darunter Tabs „Episoden“ (nur Serien), „Ähnliches“, „Details“ nach dem WAI-ARIA-Tab-Muster; Episoden als Liste mit Standbild zum Abspielen und Titel-Link zur Episodenseite, Staffel per `select`; Episodenseiten zeigen die Details ohne Tabs), SearchPage, PlayerOverlay (Titel oben links, Werkzeuge oben rechts, Zurück/Abspielen/Vor groß in der Bildmitte auf dunklen Scheiben, unten eine blaue Zeitleiste zwischen gesehener und verbleibender Zeit). Anmeldung, Bibliothek (Querformat über `cardShape`), Favoriten, Einstellungen und Zustände sind Classic in Horizon-Farben.
  - **Farben und Schrift:** Grund `#13192a` (ΔE76 ≈ 8 zum Grund des Vorbilds), Akzent `#2a63e6` (ΔE76 ≥ 32), Figtree (OFL, `@fontsource-variable/figtree`, neue Schrift-Abhängigkeit wie bei Neon Grid).
  - **Tests:** `e2e/horizon.spec.ts` (10 Tests: Wechsel, Pfeile und Punkte im Hero samt `inert`, Karte klappt nach unten auf (Geometrie geprüft) per Maus und Tastatur mit Esc, Tabs per Pfeiltasten, Staffelwahl und Episoden-Link, Player, Pfeiltasten, Fokus = Hover, axe, Animationseigenschaften, reduzierte Bewegung). Screenshots `81-…91-horizon-*`.
- **2026-10-13 – Phase 10, Constellation:**
  - **Eigene Komponenten:** AppShell (schmale Icon-Leiste links, auf Desktop und TV; klappt bei Hover, Tastatur- oder Fernbedienungsfokus und offenem Profilmenü über die Seite auf: dunkler Schatten blendet ein, Beschriftungen erscheinen neben den Icons, aktuelle Seite mit leuchtender Marke; Profil unten; auf dem Handy eine kleine Leiste oben und die Hauptbereiche unten), Hero (abgerundete Banner im Karussell, Nachbarn ragen an den Rändern ins Bild und zeigen nur ihr Bild; der ganze Banner öffnet den Titel, Glührahmen bei Fokus; Pfeile über den Nachbarn nur für Zeiger und Tab, Punkte und Pause-Knopf darunter, 8 s je Titel), Kachelreihe direkt unter dem Hero für Bibliotheken und Sammlungen (16:9, Name in der Mitte, Glührahmen und leichte Vergrößerung bei Fokus), Row und MediaCard (abgerundete 16:9-Karten mit weichem Schatten, bei Fokus 5 % größer mit weißem Rahmen und Glühen), HomePage (Hero, Kacheln, Reihen, Genres als Pillen; die Sammlungsreihe steckt in den Kacheln), ItemDetailPage und SeriesPage (Bild über die ganze Fensterbreite hinter der Leiste, unten in den Sternenhimmel ausgeblendet; darunter Abschnitte statt Tabs: „Episoden“ als seitliche Reihe mit Staffelwahl, die nächste Folge wird in den sichtbaren Teil gerollt, „Vorschläge“, „Details“ mit Beschreibung, Fakten und Besetzung), SearchPage (großes durchscheinendes Suchfeld), PlayerOverlay (Zurück-Pfeil oben links, Titel mittig, unten türkise Zeitleiste mit Restzeit, darunter Wiedergabe links und Werkzeuge rechts). Anmeldung, Bibliothek (Querformat), Favoriten, Einstellungen und Zustände sind Classic in Constellation-Farben.
  - **Hintergrund:** Dunkelblauer Verlauf mit zwei schwachen Nebelflecken, fest beim Scrollen. Sternenfeld aus kleinen `radial-gradient`s in Kacheln unterschiedlicher Größe (kein sichtbares Muster, keine Bilddatei, kein DOM); das ruhige Feld liegt hinter jeder Seite, ein paar hellere Sterne der AppShell funkeln langsam (nur Deckkraft, nicht bei reduzierter Bewegung und auf Fernsehern).
  - **Farben und Schrift:** Grund `#0b1533` (ΔE76 ≈ 14 bzw. 17 zu den Grundtönen des Vorbilds), Akzent `#2bb6c9` (ΔE76 ≈ 80 zum Markenblau), Nunito Sans (OFL, `@fontsource-variable/nunito-sans`, neue Schrift-Abhängigkeit wie bei Neon Grid und Horizon).
  - **Navigation:** Die Leiste ist fest positioniert, also eine eigene Ebene der Pfeilnavigation: ← am linken Rand führt hinein, → wieder heraus. Gefunden und behoben: Ohne `data-nav-ignore` sprang ← von der ersten Karte zum unsichtbaren Hero-Pfeil statt in die Leiste.
  - **Tests:** `e2e/constellation.spec.ts` (12 Tests: Wechsel samt Schrift und Sternenfeld, Leiste klappt per Maus und Tastatur auf und wieder zu und behält dabei ihre schmale Messbreite, Banner per Pfeilen und Punkten samt `inert` und Öffnen, Kacheln mit Glühen öffnen Bibliothek und Sammlung, Filmseite mit Abschnitten, Episodenreihe mit nächster Folge im sichtbaren Teil und Staffelwahl, Player-Aufbau, Pfeiltasten, Fokus = Hover, axe, Animationseigenschaften, reduzierte Bewegung). Screenshots `92-…99-constellation-*` inklusive TV mit aufgeklappter Leiste.
- **2026-10-14 – Phase 11, Feinschliff:**
  - **Barrierefreiheit:** neue Prüfung `e2e/accessibility.spec.ts`: jede Seite in jedem Theme mit axe (Bibliothek, Sammlung, Genre, Person, Favoriten, Suche, Einstellungen, Player pausiert und mit offenem Menü), Classic und Glass auch hell. Dazu Lighthouse je Theme. Gefunden und behoben: WCAG 2.5.3 (sichtbare Beschriftung im Namen) beim Profilknopf von Neon Grid („OPERATOR“ fehlte im Namen) und bei den Bannern von Constellation (Name war nur der Titel). Die Avatar-Initialen kommen jetzt per CSS (`attr()`), damit sie als Dekoration nicht zur Beschriftung zählen.
  - **Performance** (Messwerte in architecture.md §13.2): LCP 0,8–1,3 s, TBT 0 ms, Lighthouse 99–100 in allen Themes. Behoben: Die Hero-Platzhalter von Horizon und Constellation waren um die Zeile mit den Punkten zu niedrig (CLS 0,05 → ≤ 0,001); die Leiste von Constellation steht jetzt oben statt mittig, damit nachgeladene Bibliotheken nichts verschieben. Lighthouse läuft per `npx` (wie in §13.2 geplant) und hängt sich an ein von Playwright gestartetes Chromium, weil es hier kein eigenes starten kann.
  - **Gefundene Fehler:** Horizon: Die aufgeklappte Karte war bei kleineren Fenstern (1280 px) zu schmal, Details-Knopf und Bewertung ragten heraus (Panel jetzt `minmax(0, 1fr)`, Knöpfe kompakter). Demo-Server: Genres ließen sich nicht per ID laden, die Genre-Seite zeigte „Nicht gefunden“ (am echten Server noch zu prüfen). Die TV-Screenshots der Detailseiten zeigten keinen Fokusring, weil der Test auf ein h1 wartete, das auch die Startseite hat, und ↓ noch während des Ladens drückte (Test korrigiert, die App war in Ordnung).
  - **README** mit Bildern aller Themes (`npm run readme-shots`, `e2e/readme.spec.ts`, JPEG 1280×800 unter `docs/screenshots/`, zusammen unter 1 MB), Funktionsliste und Version 1.0; neuer `CHANGELOG.md`. docs/themes.md hat eine Übersicht der mitgelieferten Themes.
- **2026-10-14 – Phase 12, Praxis-Feinschliff** (Anlass: Screenshot des Nutzers vom echten Server, lange Beschreibung mit wörtlichen `<br>`, sehr lange Spurlisten, Navigation mit neun Bibliotheken lief über den Rand):
  - **Texte vom Server:** `plainText()` (`src/domain/text.ts`) macht aus HTML in Beschreibungen Klartext mit Zeilenumbrüchen: `<br>` und Absätze werden Umbrüche, andere Tags fallen weg, Entitäten werden einmal dekodiert. Gerendert wird weiter nur Text, nie HTML vom Server. Vorschauen (Hero, Karten) zeigen die Umbrüche als Leerzeichen, Detailseiten als Absätze (`white-space: pre-line`).
  - **Gemeinsame Bausteine** in `default/components/Expandable.tsx`: `ExpandableText` (4 Zeilen, „Mehr anzeigen“ nur, wenn wirklich gekürzt, gemessen per ResizeObserver) und `TrackList` (Spuren untereinander, ab dem vierten Eintrag „+ n weitere“; ist nur einer zu viel, wird er einfach gezeigt). Themes geben nur Klassen mit. Eingebaut in die Detailseiten aller sechs Themes.
  - **`OverflowNav`** (`default/components/OverflowNav.tsx`): Bibliotheken, die nicht in die Leiste passen, wandern in ein Menü „Mehr“; Startseite, Suche und Favoriten bleiben immer stehen. Gemessen wird live (Fensterbreite, TV-Schrift, Sprache); weggefaltete Einträge bleiben unsichtbar in der Liste, damit sie neu gemessen werden können. Die Leisten scrollen nicht mehr heimlich seitwärts. Eingebaut in Classic, Neon Grid, Crimson, Glass und Horizon; Glass misst den Platz um die zentrierte Pille (`available`). Constellation braucht es nicht (senkrechte Leiste). Neon Grid zeigt „Mehr“ schon bei 1280 px, weil seine HUD-Leiste dort nicht für alle Einträge reicht; vorher wurden die letzten Einträge stillschweigend abgeschnitten.
  - **Demo:** „Kupferherz“ hat jetzt eine lange Beschreibung mit `<br>` und Entitäten sowie sieben Ton- und sechs Untertitelspuren (nach der Generierung gesetzt, alle anderen Demo-Daten bleiben gleich).
  - **Test am echten Server** (Jellyfin 12.2.0 des Nutzers, angemeldet hat er sich selbst im Browser-Pane, Adresse nur in `.env.local`): Startseite, Bibliotheken, Bilder (`srcset` lädt passende Größen), Suche, Serien, Genre-Seiten (`/Items/{id}` liefert Genres), Einstellungen am Server (DisplayPreferences) in Ordnung. Wiedergabe direkt (MP4 H.264/AAC, `static=true`) und per HLS-Transcoding (DTS-HD), Wechsel auf eingebrannte PGS-Untertitel an derselben Stelle, Fortschritts- und Stopp-Meldungen (204); ohne gespeicherte Position, weil unter 5 %. Sprungleiste mit `nameLessThan` stimmt (Kleinschreibung der Sortiernamen bestätigt).
  - **Daraus behoben:** Die Sprungleiste setzt die Zeile des Buchstabens jetzt oben hin (vorher landete sie am unteren Rand; `focusIndex(…, 'start')`, `scroll-margin-top` gegen die klebende Leiste). Jellyfin schreibt den Namen in die erzeugten Bibliotheksbilder; die Themes legen ihn nicht mehr ein zweites Mal darüber (für Screenreader bleibt er), in Constellation lag er sonst genau auf dem Text des Bilds. Die Demo-Bibliotheksbilder tragen deshalb jetzt ihren Namen wie bei Jellyfin. Studios und Regie werden wie die Spuren gekürzt (`ShortList`, bei einer Serie standen 28 Sender in einer Zeile). Der Knopf „Mehr“ bleibt hervorgehoben, solange sein Menü offen ist.
  - **Tests:** `e2e/long-content.spec.ts` (je Theme: Beschreibung gekürzt und aufklappbar, kein `<br>` im Text, Spuren gekürzt und aufklappbar; je Theme mit Leiste: zu breite Einträge falten sich in „Mehr“, keine seitliche Überbreite, Esc schließt das Menü, Fokus zurück, Links führen zur Bibliothek), `src/domain/text.test.ts`.
- **2026-10-14 – Phase 13, Admin-Funktionen** (Details: architecture.md §14 für die CSP):
  - **Ein gemeinsames Menü für alle Themes:** `ItemAdmin` (`default/components/admin/`) mit Menü und allen Dialogen; Themes geben nur ihren Knopf über `renderTrigger` mit (Classic und Neon Grid mit Text, die anderen rund mit `aria-label`). Sichtbar nur für Administratoren (`useIsAdmin()`), „Löschen“ nur mit `CanDelete` am Eintrag (Jellyfin verlangt dafür `EnableContentDeletion`, Admin allein reicht nicht). Identifizieren nur bei Filmen und Serien, Untertitel nur bei Videos. Die Dialoge sind native `<dialog>`-Elemente in einem eigenen Chunk (13 KB gzip), den nur Administratoren beim Öffnen des Menüs laden; die API-Clients dafür stecken mit darin (`useItemAdmin`), nur `useIsAdmin` und der Bibliotheks-Scan liegen in kleinen eigenen Modulen (`useAdminAccess`, `api/refresh.ts`).
  - **Menü in der obersten Ebene (Popover-API, `popover="manual"`):** Im Kopf von Horizon schnitt `overflow: hidden` das Menü ab, in Constellation lagen die Karten darunter darüber. Ein Portal in `<body>` löste das, brach aber zwei Dinge: React reicht Ereignisse aus Portalen an die Komponenten-Eltern weiter (Esc im Menü hätte Crimsons Detail-Overlay geschlossen), und außerhalb des `aria-modal`-Overlays ist das Menü für Screenreader unsichtbar. Das Popover bleibt im DOM neben seinem Knopf und erscheint trotzdem über allem. Browser ohne Popover-API (Chrome < 114, Safari < 17) zeigen es wie vorher an Ort und Stelle. Esc, Backspace und die Zurück-Tasten der Fernbedienung fängt das Menü (wie die Dialoge) im Capture-Schritt am `window` ab; vorher schloss Esc einen Dialog **und** ging eine Seite zurück, wenn der Fokus den Dialog verlassen hatte (am echten Server gefunden).
  - **Metadaten speichern wie jellyfin-web:** `UpdateItem` leert jedes skalare Feld, das fehlt (Titel, Beschreibung, Daten, Bewertungen), Listen bleiben bei `null` erhalten. Der Editor schickt deshalb das ganze geladene DTO zurück und ersetzt nur die bearbeiteten Felder (Unit-Test). Beschreibungen werden roh bearbeitet (mit `<br>`), wie Jellyfin sie speichert.
  - **Bild-Upload von Hand:** `SetItemImage` erwartet den Body als Base64-Text mit Bild-Content-Type, das SDK typisiert ihn als Binärdatei. Der Aufruf geht deshalb über die Axios-Instanz des SDK (dritter handgeschriebener Aufruf nach `ActiveEncodings` und den Medien-URLs).
  - **Aktualisieren mit den drei Modi von jellyfin-web** (im Quelltext geprüft): „nach neuen und geänderten Dateien suchen“ = `Default`, „fehlende Metadaten ergänzen“ = `FullRefresh` ohne Ersetzen, „alle ersetzen“ = `FullRefresh` mit Ersetzen; Bilder lassen sich nur beim vollen Abruf ersetzen. „Bibliothek scannen“ ist der Modus `scan` auf dem Bibliotheksordner.
  - **CSP `img-src https:` in jedem Modus:** Jellyfin liefert für Bildvorschläge und Identifizieren nur die Adressen der Anbieter (z. B. TMDB) und hat dafür keinen Bild-Proxy. Andere Quellen (Skripte, Verbindungen, Medien) bleiben wie gehabt.
  - **Server-Verwaltung:** Eintrag im Profilmenü aller Themes, öffnet `<Server>/web/#/dashboard` in einem neuen Tab (im Proxy-Modus `/jellyfin/web/`, gleiche Origin; geprüft am echten Server). jellyfin-web hat eine eigene Sitzung, dort meldet man sich einmal selbst an. Im Demo-Modus gibt es den Eintrag nicht.
  - **Externe IDs:** Jellyfin liefert für einen Film auch die ID seiner Sammlung unter demselben Anbieternamen („TheMovieDb“ zweimal); doppelte Namen bekommen deshalb den Medientyp dazu („TheMovieDb (Sammlung)“). Untertitelsprachen kommen aus der Kulturliste des Servers (Jellyfin 12 nennt Deutsch `deu`, ältere Server `ger`), vorgewählt ist die Sprache der Oberfläche.
  - **Demo-Server:** alle Admin-Endpunkte mit Änderungen im Speicher bis zum Neuladen (erfundene Anbieter „Demo-Archiv“, „Kinoregister“, „Plakatwand“, Bildvorschläge als Farbvarianten der erzeugten Bilder, gleiche Origin wegen der CSP). Bild-Tags tragen eine Versionsnummer, damit geänderte Bilder nicht aus dem Browser-Cache kommen.
  - **Am echten Server geprüft** (nur lesend, nichts gespeichert): Menü, Metadaten-Editor mit echten Daten, Bilder mit Vorschlägen von Fanart und TMDB, Identifizieren mit TMDB-Treffern, Untertitel-Dialog, Scan-Knopf, Dashboard-Link über den Proxy. Daraus behoben: Der Dialog-Inhalt scrollte nicht (eine `1fr`-Zeile ohne feste Höhe nimmt die Inhaltshöhe; jetzt Flex-Spalte), Poster wurden quer beschnitten, die Untertitelsprache war nicht vorgewählt, die doppelte TMDB-Beschriftung, Esc ging zusätzlich zurück.
  - **Nebenbei behoben:** Glass auf dem Handy: Das Logo verlor seinen Namen für Screenreader (der Text war per `display: none` versteckt; die axe-Prüfung aller Seiten läuft nur am Desktop, die neue Admin-Prüfung auch mobil). Wenn Intl für eine Sprache keinen Namen kennt (`aa`), bleibt der Name vom Server stehen. Crimson: Der Fokus kehrte nach dem Schließen der Details selten zu einem anderen Link mit derselben Adresse zurück (Hero statt Karte; ließ den Release-Lauf scheitern, unter Last etwa 1 von 60, auch schon in Phase 12). Ursache: Das Overlay las den Auslöser erst beim Einhängen aus `document.activeElement` und suchte sonst per Adresse. Jetzt merkt sich `AppLink` beim Klick den Link (`rememberOverlayOpener` in `navigation/overlay.ts`); 160 Wiederholungen unter Last ohne Fehler.
  - **Tests:** `e2e/admin.spec.ts` (Desktop und mobil: Menü je Titelart und per Tastatur, Metadaten samt Pflichtfeld und erhaltenen Feldern, Identifizieren, Bilder wählen/hochladen/löschen, Untertitel laden/hochladen/löschen, Aktualisieren, Löschen mit Rücksprung, Esc ohne Fokus, Esc im Menü schließt nicht Crimsons Overlay, Scrollen im Dialog, Bibliothek scannen, alle sechs Themes mit axe und der Prüfung, dass nichts das Menü verdeckt, Nicht-Admins sehen nichts), `src/api/admin.test.ts`. Screenshots `a1-…a9-admin-*`.
- **2026-10-07 – MSW 3 über das Vite-Plugin `msw/vite` im Modus `worker-only`.** Es liefert `mockServiceWorker.js` im Dev-Server aus und legt es beim Build in `dist/`. Die Datei liegt also nicht im Repo und ist immer passend zur installierten MSW-Version. Gestartet wird über die stabile API `setupWorker`, nicht über das experimentelle `virtual:msw`.

- **2026-10-07 – SDK 1.0.0 trotz Mindestversion 10.10.** `@jellyfin/sdk` 1.0.0 ist gegen die OpenAPI von Jellyfin 12.0 generiert (Klassen umbenannt, z. B. `ItemsApi` → `LibraryApi`, `PlaystateApi` → `SessionApi`). Ein Abgleich aller Endpunkt-Pfade mit SDK 0.11.0 (= Jellyfin 10.10) zeigt: Jeder Pfad, den der Client braucht, existiert unverändert in 10.10. `MINIMUM_VERSION` des SDK ist weiterhin 10.10.0. Details: docs/architecture.md §1.2.
- **2026-10-07 – Zwei handgeschriebene Aufrufe über die SDK-Axios-Instanz.** `DELETE /Videos/ActiveEncodings` (Transcode beim Spurwechsel beenden) fehlt im generierten Client von SDK 1.0.0. Stream-, Untertitel- und Trickplay-URLs für `<video>`/`<img>` werden mit `api.getUri()` und dem Query-Parameter `ApiKey` gebaut, weil Medienelemente keine Header senden können. Details: §5.6 und §9.7.
- **2026-10-07 – TypeScript ~6.0 statt 7.0.** typescript-eslint 8.71 unterstützt nur TypeScript < 6.1.
- **2026-10-07 – Eigener DeviceProfile-Generator.** `getBrowserDeviceProfile()` aus dem SDK erzeugt nur Untertitelprofile.
- **2026-10-07 – Themes hängen von Domänentypen ab, nicht von SDK-Typen.** Hooks bilden `BaseItemDto` auf schlanke Typen (`MediaItem` …) ab. ESLint verbietet in `src/themes/**` Importe aus `@/api`, dem SDK, axios und TanStack Query (§3.3).
- **2026-10-07 – Ergänzungen zum Theme-Vertrag:** `ResumePrompt` und `Toast` als zusätzliche Komponenten, optionale Props für `LoadingState`, `ThemeModule.options` (u. a. `detailPresentation: 'page' | 'modal'` für Crimson), `contractVersion` (§7.1).
