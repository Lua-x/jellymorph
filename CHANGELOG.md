# Changelog

All notable changes to Jellymorph. Versions follow [Semantic Versioning](https://semver.org/). The release notes on GitHub are also generated automatically from the commits.

## 1.4.0 – 2026-10-25

An eighth theme: Onyx.

### New

- Theme **Onyx**: almost black with a cool blue shimmer, white main buttons and the Instrument Sans font. A fixed side panel with text on desktop and TV (search, home, the libraries as a section of their own, favorites, the profile at the foot), a bar at the bottom on phones. A very tall spotlight with a blue light edge that changes with dots and stops with the pause button. Rows of landscape cards with the title below, a ranked row of the best rated titles with large outlined numbers, and detail pages with season chips, the episodes as a sideways row of large stills (the next one scrolled into view), "More like this", the extras with the local trailer and the details.
- Two new home page areas in Onyx: **Top rated** (movies and series by community rating) and **Coming soon** (the next episodes of your series that Jellyfin already knows, with the day they air). Like every area they can be moved or hidden in the arrangement; themes that do not show them do not offer them there.

### Fixed

- Episodes that Jellyfin only knows from the metadata (not aired yet, or missing when "Display missing episodes" is switched on) no longer offer a play button that could only fail.

## 1.3.0 – 2026-10-25

A seventh theme: Cobalt.

### New

- Theme **Cobalt**: deep night blue with a cobalt accent and the Manrope font. A large title stage under a transparent bar, with a filmstrip of the featured titles: choose one directly, or watch the current one fill with a progress bar until the next one comes (paused while you look at the stage, stopped with the pause button, never with reduced motion). Rows of posters whose title and year appear with focus, continue watching and next up in landscape, the libraries as channel tiles right below the stage, and detail pages with the picture large on the right, a season pill and a list of episodes.

### Fixed

- Horizon and Constellation: in the details, a short fact next to a long one (for example the director next to many audio tracks) moved down to the middle of the row. Facts now start at the top.

## 1.2.1 – 2026-10-25

### Fixed

- Opening a detail page no longer wakes a sleeping hard disk with the artwork. Jellymorph asked for pictures in a quality that made Jellyfin send the original file (for backdrops and logos often stored next to the media) instead of its cached copy. Pictures now always come from Jellyfin's image cache after the first request, as in jellyfin-web.

## 1.2.0 – 2026-10-15

Make it your own: everybody arranges the home page, the navigation and the detail pages the way they like, and operators give Jellymorph their own colors and fonts.

### New

- **Arrangement** in the settings, for every theme: order and visibility of the home page areas (title picture, libraries, continue watching, "New in …", favorites, collections, genres), of the navigation and of the buttons and details on detail pages. Entries can be dragged by their handle or moved with the arrows (keyboard, remote control); every change is announced to screen readers. The arrangement applies on all of the user's devices.
- **Default for everybody:** administrators set an arrangement for everybody. It applies to every list a user has not arranged themselves, and it also reaches users added later.
- **Own colors, fonts and CSS** from a mounted folder `/custom`: `custom.css` for every theme, `<theme>.css` for one, fonts and pictures next to them. No exception in the Content Security Policy needed.

### Changed

- Every theme keeps its previous arrangement as its default. The one exception: in Crimson, Glass and Horizon the libraries now always follow the same rows instead of "the first two rows" (also when "Continue watching" is empty).
- New app icon: a play symbol cut into three purple facets on a dark violet square. Every theme tints the mark in its own colors.
- The README, this changelog, the documentation and the release notes are now in English. The app itself stays in German and English.

## 1.1.0 – 2026-10-14

Administration right inside Jellymorph: administrators look after their titles without switching to the Jellyfin interface.

### New

- An **"Edit"** menu on every detail page, in every theme, for administrators only:
  - **Identify:** search the metadata providers by title, year or an external ID and apply a match, optionally including its pictures.
  - **Edit metadata:** title, original title, sort title, year, dates, parental rating, ratings, tagline, overview, genres, tags, studios, external IDs and the lock against automatic changes.
  - **Pictures:** per picture type (poster, backdrop, logo, thumbnail, banner, clear art) apply a picture from the providers, upload your own or delete one.
  - **Subtitles:** search the server's subtitle providers and download, upload your own files (SRT, VTT, ASS, SSA) and delete external subtitles.
  - **Refresh metadata:** scan for new and changed files, fill in missing metadata or replace all of it, optionally the pictures too.
  - **Delete:** delete the item including its files (only with the right to delete), then go back to the previous page.
- **"Scan library"** on the library page.
- **"Server administration"** in the profile menu opens Jellyfin's dashboard in a new tab.
- Demo mode: Alex (administrator) can try all of this; changes last until the page is reloaded.

### Changed

- Content Security Policy: pictures may come from any HTTPS address. The browser loads the picture suggestions of the metadata providers directly from their sites.

### Fixed

- Overviews with HTML from the metadata showed line breaks as `<br>`. They now become paragraphs.
- Long overviews are cut to four lines, "Show more" expands them. Audio and subtitle tracks are listed one below the other, after three entries "+ n more" continues.
- Studios and directors are listed one below the other as well and cut after three entries.
- Jellyfin's library pictures already contain the name; the themes no longer write it over them a second time.
- The jump bar of the library puts the chosen letter at the top edge instead of the bottom.
- With many libraries the navigation ran over the edge. Whatever does not fit is now in a "More" menu; home, search and favorites always stay visible.
- Glass on phones: the logo link had no name for screen readers.
- Crimson: after closing the details, the focus occasionally landed on another link to the same title (e.g. in the hero) instead of the card that had opened them. The details now remember the clicked link.
- Language lists showed only the code (e.g. "aa") for languages the browser has no translation for, instead of the name.

## 1.0.0 – 2026-10-14

The first stable version: six themes, the full feature set and a tested Docker image.

### New

- Accessibility checks of every page in every theme (library, collection, genre, person, favorites, search, settings, player with an open menu), also in the light scheme of Classic and Glass.
- Pictures of every theme in the README (`npm run readme-shots`), plus this changelog.

### Improved

- Horizon and Constellation: nothing jumps any more once the hero titles have loaded. The placeholder now has the full height including the dots (layout shift from 0.05 down to 0.001).
- Constellation: the side bar sits at the top instead of the middle, so libraries loaded later no longer move the entries above them. The logo of the current banner loads with priority.
- Horizon: the unfolded card also fits in smaller windows (e.g. 1280 px). Before, the details button and the rating stuck out of the card.
- Accessibility (WCAG 2.5.3, visible label in the name): Neon Grid's profile button is now named the way it is labeled ("Operator …"), Constellation's banners carry their visible text as their name, and the initials in the avatar no longer count as a label.

### Fixed

- Demo mode: genre pages showed "Not found", because the demo server did not find genres by their ID.

## 0.10.0 – 2026-10-13

- Theme **Constellation**: a starry sky, an expanding icon rail, a banner carousel, glowing tiles for libraries and collections, detail pages with sections.

## 0.9.0 – 2026-10-13

- Theme **Horizon**: a bar with text links, a carousel with side arrows, 16:9 cards that unfold, detail pages with tabs.
- The Docker image is built without Docker Hub (pull limit and outages).

## 0.8.0 – 2026-10-09

- Theme **Glass**: frosted glass, a full-screen carousel, cards with tilt and light reflection, light and dark mode.
- README with logo and status badges.

## 0.7.0 – 2026-10-09

- Theme **Crimson**: profile picker, preview cards, details as a sheet above the page, trailer in the hero.

## 0.6.0 – 2026-10-08

- Theme **Neon Grid**: a HUD interface with a grid, glitch effects, a boot sequence, a terminal search and optional UI sounds.

## 0.5.0 – 2026-10-08

- Docker image for amd64 and arm64 with nginx, entrypoint, proxy to Jellyfin, a strict CSP and a health check, a Docker Compose example, the release workflow, a PWA manifest.

## 0.4.0 – 2026-10-08

- Theme system with a registry, fallback to Classic, switching without a reload and a live preview.
- Settings, stored per user on the Jellyfin server.
- Arrow key and remote control navigation, TV mode.

## 0.3.0 – 2026-10-08

- Player: direct play and HLS, audio and subtitle tracks, quality, trickplay, skipping intro and credits, next episode, progress reporting to Jellyfin.

## 0.2.0 – 2026-10-07

- All content pages in the Classic theme: home, libraries, details, series, search, favorites.

## 0.1.0 – 2026-10-07

- Foundation, sign-in (server, profiles, password, Quick Connect), demo mode with a mock server, German and English.
