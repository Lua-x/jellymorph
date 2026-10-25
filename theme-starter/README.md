# Jellymorph theme starter

A template for your own Jellymorph theme, installed as a plugin in the container. It contains a small example theme, "Starter": warm amber on dark brown, with its own title stage and cards. Everything it leaves out, Classic draws in its colors.

The full guide to themes (slots, props, tokens, rules) is [docs/themes.md](https://github.com/Lua-x/jellymorph/blob/main/docs/themes.md) in the Jellymorph repository; plugin themes are described in its section 12.

## Requirements

- Jellymorph 1.5 or newer, run with `JELLYFIN_PROXY_TARGET` or without, either works
- [Node.js](https://nodejs.org/) 22 or newer on the computer you build on

## Build the example

```bash
npm install
npm run build
```

The theme is now in `dist/starter/`: `theme.json`, `index.js`, `index.css` and the preview picture.

## Install it

1. Copy the folder `dist/starter` into `themes/` of the folder you mount at `/custom`, so that `custom/themes/starter/theme.json` exists.
2. Switch plugin themes on and restart the container:

   ```yaml
   environment:
     THEME_PLUGINS: 'true'
   volumes:
     - ./custom:/custom:ro
   ```

3. Choose "Starter" under _Settings → Theme_. Plugin themes carry the badge "Plugin".

The container log shows which plugin themes it found (`plugin themes: starter`). If a theme does not appear, the browser console says why (messages starting with `[plugins]`).

## Make it your own

1. Pick an id: lowercase letters, digits and hyphens, e.g. `sunset`. Use it as `"id"` in `public/theme.json` and in the selectors of `src/tokens.css` (`[data-theme='sunset']`). The folder in `custom/themes` gets the same name.
2. Write the name and description in `public/theme.json`, in English (`en`) and, if you like, German (`de`).
3. Change the colors in `src/tokens.css`. Keep text contrast at WCAG AA (4.5:1).
4. Draw the slots you want to change: add components to `components` in `src/index.tsx`. Every slot you leave out comes from Classic.
5. Replace `public/preview-dark.jpg` with a screenshot of your theme (1280 × 720 or smaller), and list a light one in `theme.json` if your theme has a light color scheme.

`npm run typecheck` checks your code against the interface.

## What a theme may use

Plugins import only these modules; the build points them to the copies Jellymorph serves under `/plugin-api/v1/`, so your theme uses the app's own React and translations instead of bringing its own:

| Import          | Contents                                                                                                                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react`         | React itself                                                                                                                                                                                                                                                                            |
| `react-dom`     | Portals (`createPortal`), `flushSync`                                                                                                                                                                                                                                                   |
| `react-i18next` | `useTranslation`, `Trans`: the app's texts (namespace `content`, `common` …) and your theme's own (`theme-<id>`, from `texts` in `src/index.tsx`)                                                                                                                                       |
| `jellymorph`    | the theme contract (slot props as types, `THEME_SLOTS`, `REQUIRED_TOKENS`), `ThemeSlot` for other slots, `AppLink`, `JellyImage`, Classic's building blocks (icons, states, expandable texts, the player's timeline and menus, the admin menu …), text helpers and the hooks of the app |

Other packages you install and import are bundled into your theme. Do not fetch data yourself: everything a slot needs comes in its props and the hooks of `jellymorph`.

## Rules

The same as for the built-in themes (docs/themes.md):

- Scope every global rule to `[data-theme='<id>']`; define every token in `REQUIRED_TOKENS`.
- Focus looks at least like hover; draw focus rings with `outline` or `box-shadow`, never only with color.
- Animate only `transform`, `opacity` and `filter`, and respect `[data-motion='reduced']`.
- Grids of a page need `grid-template-columns: minmax(0, 1fr)`; entries of sideways rows need `position: relative`.
- No logos, names or fonts of streaming services.

## Versions

`"api": 1` in `theme.json` is the version of the plugin interface, `contractVersion` in `src/index.tsx` the version of the theme contract. Jellymorph only loads a theme whose versions it offers; a theme for an interface it does not know is left out with a message in the browser console. Within version 1 the interface only grows, so a theme built today keeps working with later 1.x releases.

## Security

A plugin theme is code. It runs in every user's browser with that user's session, like Jellymorph itself. Only install themes you trust. Only whoever controls the container can install them, and only with `THEME_PLUGINS=true`; without it, Jellymorph serves no code from the mounted folder.
