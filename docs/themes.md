# Themes schreiben

Ein Theme in Jellymorph ist ein komplettes Bedienkonzept: Layout, Navigation, Karten, Detailseiten, Player-Oberfläche und Bewegung. Daten, Server-Zugriffe, Wiedergabe-Logik und Einstellungen gehören der App. Ein Theme bekommt fertige Daten über Props und gemeinsame Hooks und zeichnet sie.

Dieser Leitfaden beschreibt den Stand des Theme-Vertrags Version 1 (`src/themes/contract.ts`). Die Begründungen stehen in [architecture.md](architecture.md) §7 und §8.

## Inhalt

1. [Aufbau eines Themes](#1-aufbau-eines-themes)
2. [Neues Theme anlegen](#2-neues-theme-anlegen)
3. [Slots und Fallback](#3-slots-und-fallback)
4. [Tokens und Scoping](#4-tokens-und-scoping)
5. [Daten, Hooks und Bausteine](#5-daten-hooks-und-bausteine)
6. [Fokus, Fernbedienung und TV](#6-fokus-fernbedienung-und-tv)
7. [Bewegung](#7-bewegung)
8. [Live-Vorschau](#8-live-vorschau)
9. [Texte](#9-texte)
10. [Prüfliste vor dem Abschluss](#10-prüfliste-vor-dem-abschluss)

## 1. Aufbau eines Themes

```
src/themes/<id>/
  manifest.ts          # ThemeManifest: id, Text-Schlüssel, Vorschaubilder, Farbschemata, load()
  index.ts             # ThemeModule: importiert Schriften, tokens.css, global.css, Komponenten
  tokens.css           # Design-Tokens unter [data-theme='<id>']
  global.css           # globale Regeln, jede beginnt mit dem Theme-Scope
  preview-dark.jpg     # Vorschaubilder für die Theme-Auswahl (npm run previews)
  preview-light.jpg    # nur, wenn das Theme ein helles Schema hat
  components/          # React-Komponenten + CSS Modules
```

Das Manifest ist klein und Teil des Basis-Bundles. Alles andere liegt in einem eigenen Chunk, den `load()` erst nachlädt, wenn das Theme aktiv ist oder in der Vorschau gezeigt wird.

```ts
// src/themes/<id>/manifest.ts
import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const neonGridManifest: ThemeManifest = {
  id: 'neon-grid',
  nameKey: 'neon-grid.name',
  descriptionKey: 'neon-grid.description',
  preview: { dark: previewDark },
  colorSchemes: ['dark'], // das erste Schema ist der Standard
  load: () => import('./index').then((module) => module.theme),
};
```

```ts
// src/themes/<id>/index.ts
import '@fontsource/…'; // Schriften nur über @fontsource, selbst gehostet
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { Hero } from './components/Hero';
import { MediaCard } from './components/MediaCard';

export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: { Hero, MediaCard }, // alles Weitere kommt von Classic
  options: { heroItemCount: 8 },
};
```

`options` steuert, was die App für das Theme anders vorbereiten muss:

| Option               | Bedeutung                                                          | Classic  |
| -------------------- | ------------------------------------------------------------------ | -------- |
| `detailPresentation` | `'page'` oder `'modal'` (Details als Ebene über der vorigen Seite) | `'page'` |
| `heroItemCount`      | Anzahl der Titel, die der Hero bekommt                             | `6`      |

## 2. Neues Theme anlegen

1. Die ID muss in `src/config/theme-ids.ts` stehen. Dort sind alle geplanten Themes schon eingetragen, weil `DEFAULT_THEME` und gespeicherte Einstellungen gegen diese Liste geprüft werden.
2. Ordner `src/themes/<id>/` mit `manifest.ts`, `index.ts`, `tokens.css` und `global.css` anlegen.
3. Das Manifest in `src/themes/registry.ts` in `THEMES` eintragen. Die Reihenfolge dort ist die Reihenfolge in den Einstellungen.
4. Name und Beschreibung in `src/i18n/locales/de/themes.json` und `en/themes.json` (Schlüssel `<id>.name`, `<id>.description`). Für Classic und die geplanten Themes sind sie schon da.
5. Das Theme in `e2e/previews.spec.ts` eintragen und `npm run previews` ausführen. Das Skript schreibt `preview-<schema>.jpg` in den Theme-Ordner. Bisher gibt es dort nur Classic; mit dem zweiten Theme wählt die Aufnahme das Theme vorher in den Einstellungen aus.
6. `npm test` prüft automatisch: Manifest registriert, Modul lädt mit der richtigen Vertragsversion, Vorschaubild je Farbschema, alle Pflicht-Tokens je Farbschema, WCAG-Kontraste, Scoping von `global.css`.
7. Screenshots mit `npm run shots` in allen vier Auflösungen erzeugen und ansehen.

## 3. Slots und Fallback

Ein Theme muss keinen Slot liefern. Was fehlt, kommt von Classic. Classic implementiert jeden Slot und benutzt nur die gemeinsamen Tokens, deshalb passen seine Komponenten automatisch zu Farben, Schriften und Radien des aktiven Themes.

| Slot                                                | Aufgabe                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `AppShell`                                          | Rahmen: Kopfzeile, Navigation, Benutzermenü, Inhalt (`children`) |
| `LoginPage`, `ProfileSelect`                        | Anmeldung (Server, Passwort, Quick Connect) und Profilauswahl    |
| `HomePage`, `Hero`, `Row`, `MediaCard`              | Startseite und ihre Bausteine                                    |
| `LibraryPage`                                       | Bibliothek, Genre, Sammlung, Person (virtualisiertes Raster)     |
| `ItemDetailPage`, `SeriesPage`                      | Detailseiten für Filme, Folgen und Serien                        |
| `SearchPage`, `FavoritesPage`                       | Suche und Favoriten                                              |
| `SettingsPage`                                      | Einstellungen mit Theme-Auswahl und Live-Vorschau                |
| `PlayerOverlay`, `ResumePrompt`                     | Alles über dem Video und die Frage „Fortsetzen oder von vorne?“  |
| `Toast`, `LoadingState`, `EmptyState`, `ErrorState` | Rückmeldungen und Zustände                                       |

**Slots zusammensetzen:** Ein Theme rendert andere Slots über `<ThemeSlot>`, nicht über direkte Importe. So greift der Fallback auch innerhalb des Themes, und jeder Slot hat eine eigene Fehlergrenze. Wirft eine Komponente, zeigt der Slot die von Classic und schreibt den Fehler in die Konsole.

```tsx
import { ThemeSlot } from '../../ThemeSlot';

<ThemeSlot name="Row" props={{ title, items, variant: 'landscape', seeAll, context: 'page' }} />;
```

Eigene Teile von Classic (Buttons, Icons) darf ein Theme importieren. Andere Themes nicht; das verbietet ESLint.

## 4. Tokens und Scoping

Alle Werte stehen als CSS Custom Properties unter dem Theme-Scope. Theme-CSS bleibt nach einem Wechsel im Dokument, deshalb darf keine Regel ohne Scope gelten.

```css
/* tokens.css */
[data-theme='glass'] {
  color-scheme: dark;
  --color-bg: #0b0d12;
  /* … alle Pflicht-Tokens … */
}

[data-theme='glass'][data-color-scheme='light'] {
  color-scheme: light;
  --color-bg: #f4f5f8;
  /* … */
}
```

```css
/* global.css – :where() hält die Spezifität niedrig, Komponentenstile gewinnen immer */
[data-theme='glass'] body {
  background: var(--color-bg);
}

:where([data-theme='glass']) :focus-visible {
  outline: 2px solid var(--color-focus);
}
```

**Pflicht-Tokens** (`REQUIRED_TOKENS`) für jedes Farbschema: Farben (`--color-bg`, `-surface`, `-surface-raised`, `-surface-hover`, `-border`, `-text`, `-text-muted`, `-accent`, `-on-accent`, `-accent-text`, `-focus`, `-danger`, `-success`, `-progress`, `-overlay`), Schriften (`--font-body`, `-display`, `-mono`), Radien (`--radius-card`, `-control`), Schatten (`--shadow-card`, `-overlay`), Zeiten und Kurven (`--duration-fast`, `-base`, `-slow`, `--ease-standard`, `-emphasized`) und `--focus-ring`.

**Kontraste** (`CONTRAST_PAIRS`) rechnet `src/themes/tokens.test.ts` nach: Text auf Hintergrund und Flächen mindestens 4,5:1, Fokusfarbe auf Hintergrund mindestens 3:1. Effekte wie Glow oder Scanlines dürfen nie über Fließtext liegen.

**Theme-neutrale Größen** liegen in `src/app/base.css` und gelten für alle Themes: `--page-gutter` (Seitenrand inklusive TV-Overscan), `--overscan-x`/`--overscan-y`, z-Index-Stufen, Safe-Area.

**Seiten-Grids** brauchen `grid-template-columns: minmax(0, 1fr)`. Sonst wächst eine Spalte mit einer langen Kartenreihe mit und die Seite scrollt seitlich. Ein E2E-Test prüft das.

## 5. Daten, Hooks und Bausteine

Themes rufen nie selbst den Server. ESLint verbietet in `src/themes/**` Importe aus `@/api`, dem Jellyfin-SDK, axios, TanStack Query, `@/mocks` und den Player-Engines sowie `fetch`, `localStorage` und `sessionStorage`.

**Daten kommen als Props.** Listen und Details sind `QueryResult<T>`: `{ status: 'pending' }`, `{ status: 'error', error, retry }` oder `{ status: 'success', data }`. Jedes Theme zeigt alle drei Zustände, am einfachsten über die Slots `LoadingState`, `ErrorState` und `EmptyState`. Die Typen (`MediaItem`, `ItemDetail`, `Season` …) kommen aus `@/domain/types`, nie aus dem SDK.

**Gemeinsame Hooks und Bausteine:**

| Baustein                                       | Wofür                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `useMediaActions()` (`@/hooks`)                | Abspielen, Favorit, gesehen – optimistisch, mit Toast bei Fehlern                |
| `useMotionPreference()` / `useReducedMotion()` | `'full' \| 'reduced'` aus Einstellung und System                                 |
| `useTrailerPreview(itemId)` (`@/player`)       | Stummer Trailer im Hero: `videoRef`, `playing`, `cancel()` (siehe §8 unten)      |
| `useScrubber()` (`@/ui`)                       | Zeitleiste des Players mit Zeiger, Touch und Tastatur                            |
| `<JellyImage>` (`@/ui`)                        | Bilder vom Server in passender Größe, mit BlurHash, lazy außerhalb des Viewports |
| `<VirtualGrid>` (`@/ui`)                       | Virtualisiertes Raster mit eigener Pfeiltasten-Logik                             |
| `<AppLink>` (`@/ui`)                           | Interne Links, ohne direkte Abhängigkeit von der Router-API                      |
| `<ThemePreview>` (`@/themes/ThemePreview`)     | Live-Vorschau eines Themes in der Einstellungsseite                              |
| `formatClock()` (`@/ui/time`)                  | Zeitangaben im Player                                                            |
| `paths` (`@/navigation/paths`)                 | URLs für Seiten und Player                                                       |

Der Player gehört der App. `PlayerOverlay` bekommt ein `PlayerModel` mit Zustand und Befehlen (`togglePlay`, `seek`, `selectAudio`, `skipSegment` …) und sieht nie hls.js, URLs oder PlaybackInfo. Das `<video>`-Element liegt unter dem Overlay.

## 6. Fokus, Fernbedienung und TV

Die Pfeiltasten-Navigation (`src/navigation/spatial.ts`) arbeitet mit dem echten DOM: Alles, was mit Tab erreichbar ist, erreicht man auch mit den Pfeilen. Ein Theme muss nichts registrieren. Es gelten diese Regeln:

- **Echte Bedienelemente:** `button`, `a[href]`, Formularelemente. Keine klickbaren `div`s.
- **Fokus = Hover:** Jede Hover-Regel wird als `:is(:hover, :focus-visible)` geschrieben. Der Fokus muss mindestens so deutlich sein wie der Hover-Zustand. Ein E2E-Test vergleicht die berechneten Stile.
- **Eigene Pfeillogik** (Karussell, Tabs, Radiogruppe, Menü): Die Komponente behandelt die Taste und ruft `event.preventDefault()` auf. Dann bleibt die globale Navigation still.
- **Einstieg:** Ohne Fokus springt der erste Pfeil auf `[data-autofocus]`, sonst auf das erste sichtbare Element im `<main>`. Ein Theme setzt `data-autofocus`, wenn ein anderes Element der bessere Einstieg ist.
- **`data-nav-ignore`:** Element ist per Tab, aber nicht per Pfeil erreichbar (z. B. der Skip-Link).
- **Feste Leisten** (`position: fixed` oder `sticky`) sind eine eigene Ebene: Die Pfeile erreichen sie erst, wenn der Inhalt in dieser Richtung nichts mehr hat.
- **Dialoge und Menüs** brauchen `role="dialog"`/`aria-modal` bzw. `role="menu"`, dann bleibt der Fokus darin.
- **Zurück:** Esc, Backspace und die Zurück-Taste der Fernbedienung gehen eine Seite zurück. Offene Overlays fangen die Taste vorher selbst ab (`preventDefault()`).
- **Angehobene Karten:** Fokussierte Karten dürfen per `transform` größer werden. Die Navigation rechnet damit.

**TV-Modus:** Auf `<html>` steht `data-device="tv"` (bzw. `desktop`, `touch`). Im TV-Modus skaliert `rem` mit der Bildschirmbreite (1920 px → 24 px, 3840 px → 48 px). Themes rechnen deshalb in `rem` und berücksichtigen `--overscan-x`/`--overscan-y` an festen Rändern (Kopfzeile, Player-Steuerung). Hover-Effekte, die nur mit Maus erreichbar wären, gibt es nicht.

## 7. Bewegung

- Animiert werden nur `transform` (auch `translate`, `scale`, `rotate`), `opacity` und `filter`. Ein E2E-Test liest alle Übergänge und Keyframes aus dem CSSOM und schlägt bei anderen Eigenschaften fehl.
- `data-motion="reduced"` auf `<html>` bzw. `useMotionPreference() === 'reduced'`: keine Parallaxe, kein Ken Burns, keine Neigung, kein Glitch, keine automatischen Karussells, keine Trailer. Kurze Überblendungen bleiben erlaubt.
- Flackernde Effekte höchstens dreimal pro Sekunde (WCAG 2.3.1).
- Der Theme-Wechsel selbst blendet über (View Transition). Das Theme muss dafür nichts tun.

## 8. Live-Vorschau

Die Einstellungsseite zeigt das ausgewählte Theme live mit den echten Daten des Benutzers: `Hero` und eine `Row`, gerendert mit `context: 'preview'` in einem Container mit eigenem `data-theme`/`data-color-scheme`. Der Container ist 1280 px breit gelayoutet, wird verkleinert und ist `inert`.

Daraus folgt für `Hero`, `Row` und `MediaCard`:

- Breiten in `cqi` statt `vw` rechnen. Außerhalb eines Containers entspricht `cqi` der Viewport-Breite, die Seite sieht also gleich aus.
- Kein `position: fixed`, keine Abhängigkeit von der Scrollposition des Fensters.
- Bei `context === 'preview'` keine Trailer, keine automatischen Wechsel und keine Effekte, die Fokus brauchen.

## 9. Texte

- Jeder sichtbare Text kommt aus i18next. Classic nutzt die gemeinsamen Namespaces (`common`, `content`, `player`, `settings`, `errors`). Ein eigener Namespace je Theme, der mit dem Theme-Chunk geladen wird, kommt mit dem ersten Theme, das eigene Texte braucht.
- Deutsch in Du-Form, Englisch gleichwertig. Ein Test prüft, dass beide Sprachen dieselben Schlüssel haben.
- Zahlen, Daten und Laufzeiten über `Intl` bzw. `formatClock()`.

## 10. Prüfliste vor dem Abschluss

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle` fehlerfrei; Theme-Chunk unter 80 KB JS gzip
- [ ] Lade-, Leer- und Fehlerzustände auf jeder Seite
- [ ] `npm run test:e2e` grün, inklusive axe-Prüfung in jedem Farbschema
- [ ] `npm run shots`: 1920×1080, 3840×2160, 1280×800, 390×844 angesehen; TV-Modus 1080p und 4K
- [ ] Alle Seiten nur mit Pfeiltasten, Enter und Zurück bedienbar; Fokus = Hover
- [ ] Reduzierte Bewegung geprüft
- [ ] `npm run previews` ausgeführt, Vorschaubilder eingecheckt
- [ ] **Rechtliches:** keine Logos, Markennamen, Original-Schriften oder Icons von Streaming-Anbietern – weder im Code noch in Dateinamen, Kommentaren oder Texten. Farben nur in ähnlicher Stimmung, keine exakten Markenfarben. Schriften frei lizenziert über `@fontsource`. Icons selbst gezeichnet. Kein „im Stil von …“ im UI.
