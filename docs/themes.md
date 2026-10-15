# Writing themes

A theme in Jellymorph is a complete way of using the app: layout, navigation, cards, detail pages, player interface and motion. Data, server access, playback logic and settings belong to the app. A theme receives ready-made data through props and shared hooks and draws it.

This guide describes version 1 of the theme contract (`src/themes/contract.ts`). The reasoning is in [architecture.md](architecture.md) §7 and §8.

## Contents

1. [Structure of a theme](#1-structure-of-a-theme)
2. [Creating a new theme](#2-creating-a-new-theme)
3. [Slots and fallback](#3-slots-and-fallback)
4. [Tokens and scoping](#4-tokens-and-scoping)
5. [Data, hooks and building blocks](#5-data-hooks-and-building-blocks)
6. [Focus, remote control and TV](#6-focus-remote-control-and-tv)
7. [Motion](#7-motion)
8. [Live preview](#8-live-preview)
9. [Texts](#9-texts)
10. [Checklist before finishing](#10-checklist-before-finishing)
11. [The bundled themes](#11-the-bundled-themes)

## 1. Structure of a theme

```
src/themes/<id>/
  manifest.ts          # ThemeManifest: id, text keys, preview pictures, color schemes, load()
  index.ts             # ThemeModule: imports fonts, tokens.css, global.css, components
  tokens.css           # design tokens under [data-theme='<id>']
  global.css           # global rules, each one starts with the theme scope
  i18n/de.json, en.json # own texts (namespace theme-<id>), optional
  preview-dark.jpg     # preview pictures for the theme picker (npm run previews)
  preview-light.jpg    # only if the theme has a light scheme
  components/          # React components + CSS Modules
```

The manifest is small and part of the base bundle. Everything else lives in its own chunk, which `load()` only fetches once the theme is active or shown in the preview.

```ts
// src/themes/<id>/manifest.ts
import type { ThemeManifest } from '../contract';
import previewDark from './preview-dark.jpg';

export const neonGridManifest: ThemeManifest = {
  id: 'neon-grid',
  nameKey: 'neon-grid.name',
  descriptionKey: 'neon-grid.description',
  preview: { dark: previewDark },
  colorSchemes: ['dark'], // the first scheme is the default
  features: { uiSounds: true }, // optional, see §5
  load: () => import('./index').then((module) => module.theme),
};
```

```ts
// src/themes/<id>/index.ts
import '@fontsource/…'; // fonts only through @fontsource, self-hosted
import './tokens.css';
import './global.css';
import { THEME_CONTRACT_VERSION, type ThemeModule } from '../contract';
import { Hero } from './components/Hero';
import { MediaCard } from './components/MediaCard';
import de from './i18n/de.json';
import en from './i18n/en.json';

export const theme: ThemeModule = {
  contractVersion: THEME_CONTRACT_VERSION,
  components: { Hero, MediaCard }, // everything else comes from Classic
  options: { heroItemCount: 8 },
  texts: { de, en }, // optional, see §9
};
```

`options` controls what the app has to prepare differently for the theme:

| Option               | Meaning                                                                       | Classic         |
| -------------------- | ----------------------------------------------------------------------------- | --------------- |
| `detailPresentation` | `'page'` or `'modal'` (details as a layer above the previous page)            | `'page'`        |
| `heroItemCount`      | Number of titles the hero receives                                            | `6`             |
| `cardShape`          | `'mixed'` (poster and landscape depending on the content) or `'landscape'`    | `'mixed'`       |
| `layout`             | The theme's own arrangement of home page, detail buttons and details (see §5) | `classicLayout` |

`cardShape` applies to the pages a theme takes over from Classic (library, favorites): with `'landscape'` they show landscape cards everywhere, matching a theme that only knows such cards.

## 2. Creating a new theme

1. The ID has to be in `src/config/theme-ids.ts`. All planned themes are already listed there, because `DEFAULT_THEME` and stored settings are checked against this list.
2. Create the folder `src/themes/<id>/` with `manifest.ts`, `index.ts`, `tokens.css` and `global.css`.
3. Add the manifest to `THEMES` in `src/themes/registry.ts`. The order there is the order in the settings.
4. Name and description go into `src/i18n/locales/de/themes.json` and `en/themes.json` (keys `<id>.name`, `<id>.description`). They already exist for Classic and the planned themes.
5. Add the theme with its ID, display name and color schemes to `e2e/previews.spec.ts` and run `npm run previews`. The recording selects the theme in the settings and writes `preview-<scheme>.jpg` into the theme folder.
6. `npm test` checks automatically: manifest registered, module loads with the right contract version, a preview picture per color scheme, all required tokens per color scheme, WCAG contrasts, scoping of `global.css`.
7. Create screenshots in all four resolutions with `npm run shots` and look at them.

## 3. Slots and fallback

A theme does not have to provide any slot. Whatever is missing comes from Classic. Classic implements every slot and uses only the shared tokens, which is why its components automatically match the colors, fonts and radii of the active theme.

| Slot                                                | Task                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `AppShell`                                          | Frame: header, navigation, user menu, content (`children`)       |
| `LoginPage`, `ProfileSelect`                        | Sign-in (server, password, Quick Connect) and profile picker     |
| `HomePage`, `Hero`, `Row`, `MediaCard`              | Home page and its building blocks                                |
| `LibraryPage`                                       | Library, genre, collection, person (virtualized grid)            |
| `ItemDetailPage`, `SeriesPage`                      | Detail pages for movies, episodes and series                     |
| `SearchPage`, `FavoritesPage`                       | Search and favorites                                             |
| `SettingsPage`                                      | Settings with theme picker and live preview                      |
| `PlayerOverlay`, `ResumePrompt`                     | Everything above the video and the question "Resume or restart?" |
| `Toast`, `LoadingState`, `EmptyState`, `ErrorState` | Feedback and states                                              |

**Composing slots:** a theme renders other slots through `<ThemeSlot>`, not through direct imports. That way the fallback also works inside the theme, and every slot has its own error boundary. If a component throws, the slot shows Classic's and writes the error to the console.

```tsx
import { ThemeSlot } from '../../ThemeSlot';

<ThemeSlot name="Row" props={{ title, items, variant: 'landscape', seeAll, context: 'page' }} />;
```

A theme may import Classic's own parts (buttons, icons). Other themes it may not; ESLint forbids that.

## 4. Tokens and scoping

All values are CSS custom properties under the theme scope. Theme CSS stays in the document after a switch, so no rule may apply without the scope.

```css
/* tokens.css */
[data-theme='glass'] {
  color-scheme: dark;
  --color-bg: #0b0d12;
  /* … all required tokens … */
}

[data-theme='glass'][data-color-scheme='light'] {
  color-scheme: light;
  --color-bg: #f4f5f8;
  /* … */
}
```

```css
/* global.css – :where() keeps specificity low, component styles always win */
[data-theme='glass'] body {
  background: var(--color-bg);
}

:where([data-theme='glass']) :focus-visible {
  outline: 2px solid var(--color-focus);
}
```

**Required tokens** (`REQUIRED_TOKENS`) for every color scheme: colors (`--color-bg`, `-surface`, `-surface-raised`, `-surface-hover`, `-border`, `-text`, `-text-muted`, `-accent`, `-on-accent`, `-accent-text`, `-focus`, `-danger`, `-success`, `-progress`, `-overlay`), fonts (`--font-body`, `-display`, `-mono`), radii (`--radius-card`, `-control`), shadows (`--shadow-card`, `-overlay`), durations and curves (`--duration-fast`, `-base`, `-slow`, `--ease-standard`, `-emphasized`) and `--focus-ring`.

**Tokens are public:** operators can override them with their own CSS from the mounted folder (README, "Own styling"). So give new tokens telling names and do not rename them without need. The logo takes `--logo-shape` and `--logo-dot`; its three facets are mixed from those two, or set exactly with `--logo-facet-mid` and `--logo-facet-deep`.

**Contrasts** (`CONTRAST_PAIRS`) are recalculated by `src/themes/tokens.test.ts`: text on background and surfaces at least 4.5:1, focus color on background at least 3:1. Effects such as glow or scanlines must never lie over body text.

**Theme-neutral sizes** live in `src/app/base.css` and apply to every theme: `--page-gutter` (page margin including TV overscan), `--overscan-x`/`--overscan-y`, z-index levels, safe area.

**Shared CSS building blocks:** whoever takes over classes of a shared module through `composes` (e.g. frames with corner marks) should read their base values as `var(--name, default)` and set positioning with `:where()`. Otherwise the load order of the CSS files decides whether the component gets its own values through.

**Page grids** need `grid-template-columns: minmax(0, 1fr)`. Otherwise a column grows with a long row of cards and the page scrolls sideways. An E2E test checks this.

## 5. Data, hooks and building blocks

Themes never call the server themselves. ESLint forbids imports from `@/api`, the Jellyfin SDK, axios, TanStack Query, `@/mocks` and the player engines in `src/themes/**`, as well as `fetch`, `localStorage` and `sessionStorage`.

**Data arrives as props.** Lists and details are a `QueryResult<T>`: `{ status: 'pending' }`, `{ status: 'error', error, retry }` or `{ status: 'success', data }`. Every theme shows all three states, most easily through the slots `LoadingState`, `ErrorState` and `EmptyState`. The types (`MediaItem`, `ItemDetail`, `Season` …) come from `@/domain/types`, never from the SDK.

**Shared hooks and building blocks:**

| Building block                                 | Purpose                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `useMediaActions()` (`@/hooks`)                | Play, favorite, played – optimistic, with a toast on errors                       |
| `useMotionPreference()` / `useReducedMotion()` | `'full' \| 'reduced'` from the setting and the system                             |
| `useTrailerPreview(itemId)` (`@/player`)       | Muted trailer in the hero: `videoRef`, `playing`, `cancel()` (see §8 below)       |
| `useScrubber()` (`@/ui`)                       | The player's timeline with pointer, touch and keyboard                            |
| `<JellyImage>` (`@/ui`)                        | Pictures from the server in a fitting size, with BlurHash, lazy off-screen        |
| `<VirtualGrid>` (`@/ui`)                       | Virtualized grid with its own arrow key logic                                     |
| `<AppLink>` (`@/ui`)                           | Internal links without the router API; `overlay` opens details as a layer         |
| `<ThemePreview>` (`@/themes/ThemePreview`)     | Live preview of a theme on the settings page                                      |
| `formatClock()` (`@/ui/time`)                  | Times in the player                                                               |
| `paths` (`@/navigation/paths`)                 | URLs for pages and the player                                                     |
| `useRouteKey()` (`@/navigation`)               | Changes with every page, e.g. as the `key` for page transitions                   |
| `useSessionFlag(key)` (`@/ui`)                 | A flag for the browser session, e.g. "boot sequence already shown"                |
| `useUiSounds()` (`@/hooks`)                    | Whether the user has switched on interface sounds (only with `features.uiSounds`) |
| `<ItemAdmin>` (`default/components/admin`)     | "Edit" menu with dialogs for administrators (see below)                           |
| `useIsAdmin()` (`@/hooks/useAdminAccess`)      | Whether the user administers the server                                           |

The player belongs to the app. `PlayerOverlay` receives a `PlayerModel` with state and commands (`togglePlay`, `seek`, `selectAudio`, `skipSegment` …) and never sees hls.js, URLs or PlaybackInfo. The `<video>` element lies below the overlay.

**Reusing Classic's building blocks:** themes may import from `src/themes/default/components` (icons, `meta.ts`, `text.ts`, `Avatar`). The player's timeline and track/chapter menus have tested interaction logic (dragging, keyboard, dialog focus). That is why `PlayerTimeline` and `PlayerMenu` take a `classes` object: a CSS module with the same class names as `default/components/PlayerOverlay.module.css`. Neon Grid and Crimson use this for their players.

**Details as an overlay** (`detailPresentation: 'modal'`, example Crimson): links with `<AppLink overlay>` open a title's details above the current page. The URL is the normal detail URL, the page below stays mounted, unchanged and `inert`. Back closes the layer; scroll positions and the state of the page are kept. `ItemDetailPage` and `SeriesPage` then receive `presentation: 'modal'` and `onClose`; without a page below (URL opened directly, reloaded) they receive `presentation: 'page'`, and the theme shows the same content as a page. The overlay itself has to:

- set `role="dialog"`, `aria-modal="true"` and `aria-labelledby` (pointing to the heading, also in the loading and error state),
- carry an element with `data-overlay-open` (the theme uses it e.g. to lock the page's scrolling),
- handle Esc itself (`preventDefault()`, then `onClose()`), have a close button and keep Tab inside the dialog,
- pull the focus in when opening and return it to the element that opened it when closing.

Only details (`/item/:id`) open as an overlay; `overlay` on other targets (person, collection) is a normal link. An overlay link inside an overlay replaces the history entry, so closing always leads back to the page. Crimson's `DetailSheet` is the template.

**Administration:** every detail page includes `<ItemAdmin item={item} renderTrigger={…} />` next to favorite and "played". For everybody else it renders nothing. The theme only provides the button: `renderTrigger` receives `label` and `buttonProps` (ref, `aria-expanded`, `aria-controls`, `onClick`), which belong on the theme's own button; a round button without text takes `label` as its `aria-label`. Menu and dialogs are shared and take on the theme's tokens (`--color-surface`, `--color-border`, `--radius-card`, `--shadow-overlay` …). The menu appears in the browser's top layer, so `overflow: hidden` in the header does not clip it. For administrators, `NavModel.dashboard` is the link to Jellyfin's server administration (otherwise `null`); every profile menu shows it as a link with `target="_blank"`.

**Arrangement (phase 14):** home page, detail pages and navigation arrive already arranged, according to the theme, the administrator's default or the user's arrangement. Every theme defines its own arrangement in `options.layout` (`home`, `detailActions`, `facts`; template: `default/layout.ts`) and then only draws in the order in which it receives the data:

- Besides the rows and genres, `HomePageProps.sections` also contains `{ kind: 'hero' }` and `{ kind: 'libraries' }` in their place; hidden areas are missing. `splitHero()`, `homeIsEmpty()` and `rowVariant()` from `default/components/home.ts` help with drawing.
- `ItemDetailPageProps.layout` and `SeriesPageProps.layout` have `actions` (buttons in order) and `facts` (details in order, only the visible ones). The easiest way is for the theme to build a map from ID to element and draw `layout.actions.map(…)`; details shown in several places follow the same list.
- `NavModel.items` is already arranged; themes do not reorder the entries themselves (search as an icon in another place is allowed).

**Interface sounds:** a theme with `features: { uiSounds: true }` gets the switch "Interface sounds" in the settings (off by default, stored per user on the server). The theme creates the sounds itself and only plays them while `useUiSounds()` returns `true`.

## 6. Focus, remote control and TV

The arrow key navigation (`src/navigation/spatial.ts`) works with the real DOM: everything reachable with Tab is also reachable with the arrows. A theme does not have to register anything. These rules apply:

- **Real controls:** `button`, `a[href]`, form elements. No clickable `div`s.
- **Focus = hover:** every hover rule is written as `:is(:hover, :focus-visible)`. The focus has to be at least as clear as the hover state. An E2E test compares the computed styles.
- **Own arrow logic** (carousel, tabs, radio group, menu): the component handles the key and calls `event.preventDefault()`. Then the global navigation stays quiet.
- **Entry point:** without focus, the first arrow jumps to `[data-autofocus]`, otherwise to the first visible element in `<main>`. A theme sets `data-autofocus` when another element is the better entry point.
- **`data-nav-ignore`:** the element is reachable with Tab but not with the arrows (e.g. the skip link).
- **Fixed bars** (`position: fixed` or `sticky`) are a layer of their own: the arrows only reach them once the content has nothing left in that direction.
- **Dialogs and menus** need `role="dialog"`/`aria-modal` or `role="menu"`, then the focus stays inside.
- **Back:** Esc, Backspace and the back key of the remote control go back one page. Open overlays catch the key themselves first (`preventDefault()`).
- **Lifted cards:** focused cards may grow through `transform`. The navigation accounts for that.

**TV mode:** `<html>` carries `data-device="tv"` (or `desktop`, `touch`). In TV mode `rem` scales with the screen width (1920 px → 24 px, 3840 px → 48 px). Themes therefore calculate in `rem` and respect `--overscan-x`/`--overscan-y` at fixed edges (header, player controls). There are no hover effects that would only be reachable with a mouse.

## 7. Motion

- Only `transform` (also `translate`, `scale`, `rotate`), `opacity` and `filter` are animated. An E2E test reads all transitions and keyframes from the CSSOM and fails on other properties.
- `data-motion="reduced"` on `<html>` or `useMotionPreference() === 'reduced'`: no parallax, no Ken Burns, no tilt, no glitch, no automatic carousels, no trailers. Short cross-fades stay allowed.
- Flickering effects at most three times per second (WCAG 2.3.1).
- **Motion (spring animations):** allowed, but only in the theme chunk. With `LazyMotion features={domAnimation} strict` and `m.*` elements its share stays small (without layout animations); `MotionConfig reducedMotion` follows `useReducedMotion()`. Glass wraps this in `GlassMotion`; building blocks rendered outside the shell (live preview, player) need the wrapper themselves. Motion, too, animates only `transform` and `opacity`. These animations run in JavaScript and are not in the CSSOM, so the E2E test does not see them: here the rule is enforced in code review.
- **Example focus effect:** `glass/components/useLift.ts` lifts a card on focus and hover, tilts it towards the pointer under the mouse and lets a light reflection follow (springs through Motion values, without re-rendering). Keyboard and remote control only lift the card straight up; reduced motion switches tilt and animation off. The stronger shadow of a lifted card lies on its own layer and only fades in through `opacity`.
- **Automatic carousels** need a pause button (WCAG 2.2.2) and stop on hover, focus and a running trailer. Titles outside the picture get `inert`, so keyboard and remote control do not jump into them (Horizon).
- **Side bars that expand on focus** (Constellation): every entry keeps the narrow width, the label sits next to it. That way the arrow navigation measures the icon column, and content to the right of it stays reachable. The bar expands on hover, `:has(:focus-visible)` (not `:focus-within`, otherwise the bar would stay open after a mouse click) and an open menu; only the opacity and offset of the labels and a shadow are animated.
- **Controls for pointer and Tab only** get `data-nav-ignore` when they would lead the arrow navigation astray. Example: Constellation's hero arrows sit at the left edge next to the bar; without the marker, ← from the first card of a row would jump to the invisible arrow instead of into the bar.
- **Global keyframes** are not allowed in `global.css` (the token test only accepts selectors with the theme scope, and keyframe names are global). Animations belong in a CSS module; that is why Constellation puts the twinkling stars into the AppShell, while the calm star field stays in `global.css`.
- **Cards with more content on focus** (Crimson: enlarged preview, Horizon: unfolding downwards) lie as a portal in document coordinates above the page: rows scroll sideways and would clip them otherwise. Because they cover the card, they carry the focus outline themselves while the card has the focus (WCAG 2.4.11).
- The theme switch itself cross-fades (View Transition). The theme does not have to do anything for it.

## 8. Live preview

The settings page shows the selected theme live with the user's real data: `Hero` and one `Row`, rendered with `context: 'preview'` in a container with its own `data-theme`/`data-color-scheme`. The container is laid out 1280 px wide, scaled down and `inert`.

For `Hero`, `Row` and `MediaCard` this means:

- Calculate widths in `cqi` instead of `vw`. Outside a container `cqi` equals the viewport width, so the page looks the same.
- No `position: fixed`, no dependency on the window's scroll position.
- With `context === 'preview'`: no trailers, no automatic changes and no effects that need focus.

## 9. Texts

- Every visible text comes from i18next. Where it fits, a theme uses the shared namespaces (`common`, `content`, `player`, `settings`, `errors`).
- Own wording (e.g. "Sectors", "System time") lives in `i18n/de.json` and `i18n/en.json` in the theme folder and reaches the `ThemeModule` through `texts: { de, en }`. It travels with the theme chunk and is registered as the namespace `theme-<id>` on load: `useTranslation('theme-neon-grid')`. For type checking, add the namespace to `src/i18n/i18next.d.ts`.
- Accessible names stay the shared terms where tests and screen reader users expect them: Neon Grid shows "Sectors", the region is still called "Libraries" for screen readers.
- German in the informal "du" form, English on equal terms. A test checks that both languages have the same keys.
- Numbers, dates and runtimes through `Intl` or `formatClock()`.

## 10. Checklist before finishing

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle` without errors; theme chunk below 80 KB JS gzip
- [ ] Loading, empty and error states on every page
- [ ] `npm run test:e2e` green, including the axe check in every color scheme; add the new theme to `e2e/accessibility.spec.ts` (checks every page, including the ones taken over from Classic)
- [ ] `npm run shots`: 1920×1080, 3840×2160, 1280×800, 390×844 looked at; TV mode 1080p and 4K
- [ ] Every page usable with arrow keys, Enter and Back only; focus = hover
- [ ] Reduced motion checked; effects only over pictures and headings, never over body text
- [ ] `npm run previews` run, preview pictures checked in; README pictures via `npm run readme-shots` (entry in `e2e/readme.spec.ts`)
- [ ] Long content: overviews through `ExpandableText`, tracks through `TrackList`, a navigation with libraries through `OverflowNav` (all in `default/components/`), so real libraries with long texts and many entries stay readable
- [ ] Loading states without jumps: placeholders have the height of the loaded content, also for lines below the hero (dots, pause button)
- [ ] **Legal:** no logos, brand names, original fonts or icons of streaming providers – neither in the code nor in file names, comments or texts. Colors only in a similar mood, no exact brand colors. Fonts freely licensed through `@fontsource`. Icons drawn ourselves. No "in the style of …" in the UI.

## 11. The bundled themes

What each theme draws itself and what it takes over from Classic. Good templates for a new theme are Horizon and Constellation (few, clearly separated components) and Neon Grid (its own sign-in and its own states).

| Theme               | Own components                                                                                                                                         | From Classic                                  | Options                                                                     | Font                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| Classic (`default`) | all (reference)                                                                                                                                        | –                                             | –                                                                           | Inter                               |
| Neon Grid           | AppShell, LoginPage, ProfileSelect, HomePage, ItemDetailPage, SeriesPage, SearchPage, PlayerOverlay, ResumePrompt, Hero, Row, MediaCard, Toast, states | Library, favorites, settings                  | `heroItemCount: 6`                                                          | Orbitron, Rajdhani, Share Tech Mono |
| Crimson             | AppShell, ProfileSelect, HomePage, ItemDetailPage, SeriesPage, SearchPage, PlayerOverlay, Hero, Row, MediaCard                                         | Sign-in, library, favorites, settings, states | `detailPresentation: 'modal'`, `heroItemCount: 1`, `cardShape: 'landscape'` | Inter                               |
| Glass               | AppShell, HomePage, ItemDetailPage, SeriesPage, SearchPage, PlayerOverlay, Hero, Row, MediaCard                                                        | Sign-in, library, favorites, settings, states | `heroItemCount: 6`                                                          | Inter                               |
| Horizon             | AppShell, HomePage, ItemDetailPage, SeriesPage, SearchPage, PlayerOverlay, Hero, Row, MediaCard                                                        | Sign-in, library, favorites, settings, states | `heroItemCount: 6`, `cardShape: 'landscape'`                                | Figtree                             |
| Constellation       | AppShell, HomePage, ItemDetailPage, SeriesPage, SearchPage, PlayerOverlay, Hero, Row, MediaCard                                                        | Sign-in, library, favorites, settings, states | `heroItemCount: 6`, `cardShape: 'landscape'`                                | Nunito Sans                         |

Pictures of every theme are in the [README](../README.md#themes), the decisions on each theme in CLAUDE.md §12.
