# Jellymorph

Ein selbst gehosteter Web-Client für [Jellyfin](https://jellyfin.org) mit austauschbaren Themes. Ein Theme ist hier mehr als ein Farbschema: Jedes bringt sein eigenes Bedienkonzept mit, also Layout, Navigation, Karten, Detailseiten, Player-Oberfläche und Animationen.

> **Status:** in Entwicklung. Fertig sind das Fundament, die Anmeldung (Server, Profile, Passwort, Quick Connect), alle Inhaltsseiten im Theme „Classic“, der Player und der Demo-Modus. Den Fahrplan zeigt [CLAUDE.md](CLAUDE.md) §11.

## Ausprobieren ohne Server (Demo-Modus)

```bash
npm install
npm run dev
```

Ohne `JELLYFIN_DEV_URL` startet die App mit einem eingebauten Mock-Server und erfundenen Beispieldaten. Das Passwort aller Demo-Profile lautet `demo`. Quick-Connect-Codes werden nach wenigen Sekunden automatisch bestätigt.

Im Demo-Modus spielt jeder Titel denselben 60-Sekunden-Clip, mit Intro, Abspann, Kapiteln, Untertiteln und Vorschaubildern. Daran lassen sich alle Player-Funktionen ausprobieren: Direct Play, HLS, Spurwechsel, „Intro überspringen“ und die nächste Folge.

## Entwicklung mit einem echten Jellyfin-Server

1. `.env.example` nach `.env.local` kopieren. Die Datei wird nicht eingecheckt.
2. `JELLYFIN_DEV_URL` auf deinen Server setzen, z. B. `http://192.168.1.10:8096`.
3. `npm run dev` starten. Der Dev-Server leitet `/jellyfin` an deinen Server weiter, so entstehen keine CORS-Probleme.

Unterstützt wird Jellyfin ab Version 10.10, auch 12.x.

## Befehle

| Befehl                               | Zweck                                                              |
| ------------------------------------ | ------------------------------------------------------------------ |
| `npm run dev`                        | Entwicklungsserver                                                 |
| `npm run build`                      | Produktions-Build nach `dist/`                                     |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                                                |
| `npm test`                           | Unit- und Integrationstests (Vitest, MSW)                          |
| `npm run test:e2e`                   | End-to-End-Tests gegen den Build im Demo-Modus (Playwright)        |
| `npm run shots`                      | Prüf-Screenshots in vier Auflösungen nach `artifacts/screenshots/` |
| `npm run check:bundle`               | Größenbudget des Basis-Bundles (250 KB gzip) prüfen                |
| `node scripts/record-demo-clip.ts`   | Demo-Clip neu aufnehmen (dauert eine Minute)                       |

Die Architektur beschreibt [docs/architecture.md](docs/architecture.md).

## Hinweise

Die Themes orientieren sich an gängigen Streaming-Oberflächen. Jellymorph steht in keiner Verbindung zu den Anbietern dieser Dienste und beansprucht keine Markenrechte. Jellymorph ist außerdem ein inoffizieller Client und kein Projekt des Jellyfin-Teams.

## Lizenz

[AGPL-3.0](LICENSE)
