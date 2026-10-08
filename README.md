# Jellymorph

Ein selbst gehosteter Web-Client für [Jellyfin](https://jellyfin.org) mit austauschbaren Themes. Ein Theme ist hier mehr als ein Farbschema: Jedes bringt sein eigenes Bedienkonzept mit, also Layout, Navigation, Karten, Detailseiten, Player-Oberfläche und Animationen.

> **Status:** in Entwicklung. Fertig sind das Fundament, die Anmeldung (Server, Profile, Passwort, Quick Connect), alle Inhaltsseiten im Theme „Classic“, der Player, das Theme-System mit Einstellungen und Live-Vorschau, die Bedienung per Fernbedienung samt TV-Modus und der Demo-Modus. Den Fahrplan zeigt [CLAUDE.md](CLAUDE.md) §11.

## Ausprobieren ohne Server (Demo-Modus)

```bash
npm install
npm run dev
```

Ohne `JELLYFIN_DEV_URL` startet die App mit einem eingebauten Mock-Server und erfundenen Beispieldaten. Das Passwort aller Demo-Profile lautet `demo`. Quick-Connect-Codes werden nach wenigen Sekunden automatisch bestätigt.

Im Demo-Modus spielt jeder Titel denselben 60-Sekunden-Clip, mit Intro, Abspann, Kapiteln, Untertiteln und Vorschaubildern. Daran lassen sich alle Player-Funktionen ausprobieren: Direct Play, HLS, Spurwechsel, „Intro überspringen“ und die nächste Folge.

## Einstellungen und Bedienung

Theme, Farbschema, Sprache, Bewegung und Trailer-Autoplay speichert Jellymorph pro Benutzer auf dem Jellyfin-Server. Sie gelten also auf allen Geräten. Ton- und Untertitelsprache, Untertitelmodus und „Nächste Folge automatisch“ stehen in deinem Jellyfin-Konto und gelten auch für die anderen Jellyfin-Apps. Streaming-Qualität, Bedienmodus und Bildrand bleiben auf dem jeweiligen Gerät.

Alles lässt sich mit Maus, Touch, Tastatur oder Fernbedienung bedienen: Pfeiltasten bewegen den Fokus, Enter wählt aus, Esc oder die Zurück-Taste gehen zurück. Auf Fernsehern schaltet Jellymorph automatisch in den TV-Modus mit größerer Schrift und einstellbarem Bildrand. In den Einstellungen lässt er sich auch fest einschalten.

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
| `npm run previews`                   | Vorschaubilder der Themes für die Theme-Auswahl neu erzeugen       |
| `npm run check:bundle`               | Größenbudget des Basis-Bundles (250 KB gzip) prüfen                |
| `node scripts/record-demo-clip.ts`   | Demo-Clip neu aufnehmen (dauert eine Minute)                       |

Die Architektur beschreibt [docs/architecture.md](docs/architecture.md), wie man ein Theme baut [docs/themes.md](docs/themes.md).

## Hinweise

Die Themes orientieren sich an gängigen Streaming-Oberflächen. Jellymorph steht in keiner Verbindung zu den Anbietern dieser Dienste und beansprucht keine Markenrechte. Jellymorph ist außerdem ein inoffizieller Client und kein Projekt des Jellyfin-Teams.

## Lizenz

[AGPL-3.0](LICENSE)
