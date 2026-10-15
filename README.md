<p align="center">
  <img src="public/favicon.svg" width="88" height="88" alt="" />
</p>

<h1 align="center">Jellymorph</h1>

<p align="center">
  A self-hosted web client for <a href="https://jellyfin.org">Jellyfin</a> with interchangeable themes.<br />
  Every theme brings its own way of using the app: layout, navigation, cards, detail pages,
  player and motion – in the browser, on the phone and on the TV.
</p>

<p align="center">
  <a href="https://github.com/Lua-x/jellymorph/actions/workflows/release.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/Lua-x/jellymorph/release.yml?branch=main&event=push&label=CI&logo=github" alt="CI" /></a>
  <a href="https://github.com/Lua-x/jellymorph/releases"><img src="https://img.shields.io/github/v/release/Lua-x/jellymorph?include_prereleases&label=release" alt="Release" /></a>
  <a href="https://github.com/Lua-x/jellymorph/pkgs/container/jellymorph"><img src="https://img.shields.io/badge/image-ghcr.io-2496ed?logo=docker&logoColor=white" alt="Docker image on ghcr.io" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License: AGPL-3.0" /></a>
</p>

> **Version 1.2:** six themes, the full feature set, administration of single titles for administrators and now your own arrangement and styling. What changed is in the [changelog](CHANGELOG.md).

## Themes

A theme is more than a color scheme: each one arranges navigation, home page, cards, detail pages and player differently and moves differently. You switch in the settings, without a reload and with a live preview. The choice is stored per user and applies on every device.

### Classic

Plain and clear, the foundation of all other themes. Light and dark.

<p>
  <img src="docs/screenshots/classic-home.jpg" width="49%" alt="Classic: home page" />
  <img src="docs/screenshots/classic-series.jpg" width="49%" alt="Classic: a series with seasons and episodes" />
</p>

### Neon Grid

The project's own design: a futuristic HUD with neon light, a perspective grid, glitch effects, a boot sequence at sign-in and a terminal-style search.

<p>
  <img src="docs/screenshots/neon-grid-home.jpg" width="49%" alt="Neon Grid: home page with HUD bar and grid" />
  <img src="docs/screenshots/neon-grid-movie.jpg" width="49%" alt="Neon Grid: a movie as a dossier with data fields" />
</p>

### Crimson

Big cinema: a full-bleed hero with trailer preview, rows with preview cards, details as a sheet above the page and a profile picker with large tiles.

<p>
  <img src="docs/screenshots/crimson-home.jpg" width="49%" alt="Crimson: home page with a large hero" />
  <img src="docs/screenshots/crimson-preview.jpg" width="49%" alt="Crimson: enlarged preview card in a row" />
</p>

### Glass

Calm frosted-glass surfaces, a full-screen carousel and cards that lift on focus and tilt towards the pointer. Light and dark.

<p>
  <img src="docs/screenshots/glass-home.jpg" width="49%" alt="Glass: home page with full-screen carousel" />
  <img src="docs/screenshots/glass-series-light.jpg" width="49%" alt="Glass in the light scheme: episodes of a series" />
</p>

### Horizon

Clear 16:9 rows, cards that unfold downwards on focus and detail pages with tabs for episodes, related titles and details.

<p>
  <img src="docs/screenshots/horizon-home.jpg" width="49%" alt="Horizon: home page with carousel and arrows" />
  <img src="docs/screenshots/horizon-card.jpg" width="49%" alt="Horizon: unfolded card with actions and description" />
</p>

### Constellation

A starry sky as background, an icon rail that expands on focus, banners with their neighbors peeking in and large glowing tiles for libraries and collections.

<p>
  <img src="docs/screenshots/constellation-home.jpg" width="49%" alt="Constellation: home page with banners and tiles" />
  <img src="docs/screenshots/constellation-series.jpg" width="49%" alt="Constellation: a series with a row of episodes" />
</p>

The pictures show the demo mode with made-up titles and generated artwork.

## Features

- **Sign-in:** several servers, profile picker, password or Quick Connect. Only the access token is stored, never the password.
- **Home page:** continue watching, next up, new per library, favorites, collections and genres, in the order of your Jellyfin libraries.
- **Libraries:** a fast grid even with thousands of titles, sorting, filters (genre, year, watched, favorites) and an A–Z jump bar.
- **Details and series:** cast, audio and subtitle tracks, trailers, seasons, episodes with progress, the next episode highlighted. Live search, grouped by type.
- **Player:** plays directly where the browser can, otherwise through HLS transcoding. Audio and subtitle choice (picture subtitles are burned in), quality, speed, full screen, picture-in-picture, preview thumbnails on the timeline, "Skip intro", next episode with countdown. Progress goes back to Jellyfin, so "Continue watching" is right on every device.
- **Administration (for administrators):** an "Edit" menu on every detail page: identify, edit metadata, choose, upload or delete pictures, search, upload or delete subtitles, refresh metadata, delete the item. Plus "Scan library" and a link to Jellyfin's dashboard in the profile menu (you sign in there once with your Jellyfin account). Other users see none of this.
- **Arrangement:** order and visibility of the home page areas, the navigation and the buttons and details on detail pages, by dragging or with the arrow keys. Administrators set a default for everybody; own arrangements take precedence.
- **Own styling:** your own colors, fonts and CSS per theme from a mounted folder (see below).
- **Input:** mouse, touch, keyboard and remote control. On TVs a TV mode with larger type and an adjustable overscan margin, in 1080p and 4K.
- **Accessibility:** contrast according to WCAG AA, focus at least as clear as hover, reduced motion on request or by system setting. Every page of every theme is checked automatically with axe.
- **Languages:** German and English.
- **Operation:** a small Docker image for amd64 and arm64 that runs without root and read-only, with a strict Content Security Policy.

## Running with Docker

The image is available for `linux/amd64` and `linux/arm64` (e.g. Raspberry Pi 4/5):

```bash
docker run -d --name jellymorph -p 8080:8080 \
  -e JELLYFIN_PROXY_TARGET=http://192.168.1.10:8096 \
  --read-only --tmpfs /tmp --cap-drop ALL \
  ghcr.io/lua-x/jellymorph:latest
```

Jellymorph is then available at `http://<host>:8080`. A complete Docker Compose example is in [docker-compose.yml](docker-compose.yml).

### Variables

| Variable                | Purpose                                                                                                                            | Default      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `JELLYFIN_PROXY_TARGET` | Address of your Jellyfin server. Jellymorph passes it through under `/jellyfin` (recommended).                                     | empty        |
| `JELLYFIN_URL`          | Server address pre-filled at sign-in. The browser connects directly.                                                               | empty        |
| `LOCK_SERVER`           | `true`: the address from `JELLYFIN_URL` is fixed and cannot be changed in the app.                                                 | `false`      |
| `DEFAULT_THEME`         | Theme for users without a choice of their own: `default` (Classic), `neon-grid`, `crimson`, `glass`, `horizon` or `constellation`. | `default`    |
| `APP_TITLE`             | Name in the browser tab and when installed as an app                                                                               | `Jellymorph` |
| `DEMO_MODE`             | `true`: a demo with made-up data, without any Jellyfin server                                                                      | `false`      |

Changes need no new build: adjust the variable, restart the container. Invalid values, such as a typo in the theme name, stop the container with a message in the log (`docker logs jellymorph`) that names the variable.

### With or without the proxy

- **With `JELLYFIN_PROXY_TARGET` (recommended):** Jellyfin appears under the same address as Jellymorph. There are no CORS or mixed-content problems, there is no server selection, and the browser may only talk to Jellymorph itself. The container also starts while Jellyfin is not running yet, and it finds a restarted Jellyfin container again on its own. In Kubernetes, give the full DNS name (e.g. `http://jellyfin.media.svc.cluster.local:8096`), because nginx does not know search domains.
- **With `JELLYFIN_URL`:** the browser connects to Jellyfin directly. If Jellymorph runs on HTTPS, Jellyfin has to be reachable over HTTPS too. Without `LOCK_SERVER`, users can add further servers.

### HTTPS, installing as an app and security

- For HTTPS, put a reverse proxy (e.g. Caddy, Traefik or nginx) in front of the container. Only with HTTPS (or on `localhost`) can Jellymorph be installed as an app from the browser menu, and only then does the demo mode run on other devices too.
- Jellymorph runs as an unprivileged user (UID 101) and only writes to `/tmp`, which is why `--read-only` and `--cap-drop ALL` work. The container sets a strict Content Security Policy and further security headers. Pictures may come from any HTTPS address, because the picture suggestions of metadata providers (e.g. TMDB) load directly from their sites.
- Health check: `GET /healthz` answers `ok`. The image comes with a matching `HEALTHCHECK`.
- So that Jellyfin sees the real client addresses behind the proxy, you can add the address of the Jellymorph container in Jellyfin under _Networking → Known proxies_.

### Image tags

| Tag            | Contents                                                       |
| -------------- | -------------------------------------------------------------- |
| `latest`       | newest stable version                                          |
| `1.2.3`, `1.2` | a specific version, or the newest patch version                |
| `1`            | newest version with the same major version (from 1.0)          |
| `edge`         | every state of `main` after a passing CI, not for everyday use |

## Trying it without a server (demo mode)

With Docker:

```bash
docker run --rm -p 8080:8080 -e DEMO_MODE=true ghcr.io/lua-x/jellymorph:latest
```

Or from the source:

```bash
npm install
npm run dev
```

Without `JELLYFIN_DEV_URL` the app starts with a built-in mock server and made-up sample data. The password of all demo profiles is `demo`. Quick Connect codes are approved automatically after a few seconds.

In demo mode every title plays the same 60-second clip, with intro, credits, chapters, subtitles and preview thumbnails. It lets you try every player feature: direct play, HLS, switching tracks, "Skip intro" and the next episode.

## Settings and input

Jellymorph stores theme, color scheme, language, motion and trailer autoplay per user on the Jellyfin server, so they apply on every device. Audio and subtitle language, subtitle mode and "Play next episode automatically" live in your Jellyfin account and also apply to the other Jellyfin apps. Streaming quality, input mode and overscan stay on the device.

Everything works with mouse, touch, keyboard or remote control: the arrow keys move the focus, Enter selects, Esc or the back key goes back. On TVs Jellymorph switches to the TV mode with larger type and an adjustable overscan margin by itself. It can also be switched on permanently in the settings.

## Own styling

### Arrangement

In _Settings → Arrangement_ you choose which areas the home page shows (title picture, libraries, continue watching, "New in …" per library, favorites, collections, genres), which entries the navigation has and which buttons and details the detail pages show, each in your order. Drag an entry by its handle into place or use the arrows (keyboard, remote control); the eye hides it. The arrangement applies on all your devices and in every theme. Whatever you leave alone follows the theme.

Administrators can switch to _Everybody (default)_. The default applies to everybody who has not arranged a list themselves. When saved, Jellymorph copies it into the Jellyfin settings of every user; users added later receive it as soon as an administrator opens Jellymorph.

### Own colors, fonts and CSS

Mount a folder to `/custom` (read-only is enough):

```yaml
volumes:
  - ./custom:/custom:ro
```

- `custom.css` applies to every theme, `<theme>.css` to one: `default.css` (Classic), `neon-grid.css`, `crimson.css`, `glass.css`, `horizon.css`, `constellation.css`.
- Put fonts and pictures next to them (e.g. `custom/fonts/`) and refer to them relatively.
- Jellymorph serves only CSS, fonts (woff2, woff, ttf, otf) and pictures from the folder. Changes to existing files apply on the next page load, new files after a restart of the container.

The easiest way is to override the design tokens, the CSS variables of the themes (list in [docs/themes.md](docs/themes.md#4-tokens-and-scoping)). The attributes `data-theme`, `data-color-scheme` and `data-device` on the `<html>` element are stable too; the class names of the components are generated at build time and change with every version.

```css
/* custom/custom.css: an own font for every theme */
@font-face {
  font-family: 'My Font';
  src: url('fonts/my-font.woff2') format('woff2');
}

[data-theme] {
  --font-body: 'My Font', system-ui, sans-serif;
}

/* custom/crimson.css: another accent for Crimson */
[data-theme='crimson'] {
  --color-accent: #e0a100;
}
```

Keep an eye on contrast with your own colors; the checks of the themes only cover their own values.

## Development with a real Jellyfin server

1. Copy `.env.example` to `.env.local`. The file is not checked in.
2. Set `JELLYFIN_DEV_URL` to your server, e.g. `http://192.168.1.10:8096`.
3. Run `npm run dev`. The dev server forwards `/jellyfin` to your server, so there are no CORS problems.

Jellyfin 10.10 and later is supported, including 12.x.

## Commands

| Command                              | Purpose                                                              |
| ------------------------------------ | -------------------------------------------------------------------- |
| `npm run dev`                        | Development server                                                   |
| `npm run build`                      | Production build into `dist/`                                        |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                                                  |
| `npm test`                           | Unit and integration tests (Vitest, MSW)                             |
| `npm run test:e2e`                   | End-to-end tests against the build in demo mode (Playwright)         |
| `npm run shots`                      | Review screenshots in four resolutions into `artifacts/screenshots/` |
| `npm run previews`                   | Render the theme preview pictures for the theme picker again         |
| `npm run readme-shots`               | Pictures for this README into `docs/screenshots/`                    |
| `npm run check:bundle`               | Check the size budget of the base bundle (250 KB gzip)               |
| `node scripts/record-demo-clip.ts`   | Record the demo clip again (takes a minute)                          |
| `node scripts/render-icons.ts`       | Render the app icons from `public/favicon.svg` again                 |
| `docker build -t jellymorph .`       | Build the image locally                                              |

[docs/architecture.md](docs/architecture.md) describes the architecture, [docs/themes.md](docs/themes.md) how to build a theme.

## Notes

The themes take their cues from common streaming interfaces. Jellymorph is not affiliated with the providers of these services and claims no trademark rights. Jellymorph is also an unofficial client and not a project of the Jellyfin team.

## License

[AGPL-3.0](LICENSE)
