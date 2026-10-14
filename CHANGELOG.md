# Changelog

Alle nennenswerten Änderungen an Jellymorph. Die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/). Die Release-Notizen auf GitHub entstehen zusätzlich automatisch aus den Commits.

## 1.1.0 – 2026-10-14

Verwaltung direkt in Jellymorph: Administratoren pflegen ihre Titel, ohne zur Jellyfin-Oberfläche zu wechseln.

### Neu

- Menü **„Bearbeiten“** auf jeder Detailseite, in allen Themes, nur für Administratoren:
  - **Identifizieren:** nach Titel, Jahr oder einer externen ID bei den Metadaten-Anbietern suchen und einen Treffer übernehmen, auf Wunsch samt Bildern.
  - **Metadaten bearbeiten:** Titel, Originaltitel, Sortiertitel, Jahr, Daten, Altersfreigabe, Bewertungen, Slogan, Beschreibung, Genres, Tags, Studios, externe IDs und die Sperre gegen automatische Änderungen.
  - **Bilder:** je Bildtyp (Poster, Hintergrund, Logo, Vorschaubild, Banner, Clearart) ein Bild der Anbieter übernehmen, ein eigenes hochladen oder eines löschen.
  - **Untertitel:** bei den Untertitel-Anbietern des Servers suchen und herunterladen, eigene Dateien hochladen (SRT, VTT, ASS, SSA) und externe Untertitel löschen.
  - **Metadaten aktualisieren:** nach neuen und geänderten Dateien suchen, fehlende Metadaten ergänzen oder alle ersetzen, auf Wunsch auch die Bilder.
  - **Löschen:** Eintrag samt Dateien löschen (nur mit Löschrecht), danach geht es zur vorherigen Seite zurück.
- **„Bibliothek scannen“** auf der Bibliotheksseite.
- **„Server-Verwaltung“** im Profilmenü öffnet das Dashboard von Jellyfin in einem neuen Tab.
- Demo-Modus: Alex (Administrator) kann alles davon ausprobieren; Änderungen gelten bis zum Neuladen.

### Geändert

- Content Security Policy: Bilder dürfen von allen HTTPS-Adressen kommen. Die Bildvorschläge der Metadaten-Anbieter lädt der Browser direkt von deren Seiten.

### Behoben

- Glass auf dem Handy: Der Link mit dem Logo hatte für Screenreader keinen Namen.
- Sprachlisten zeigten für Sprachen ohne Übersetzung im Browser nur das Kürzel (z. B. „aa“) statt des Namens.

## 1.0.0 – 2026-10-14

Die erste stabile Version: sechs Themes, der vollständige Funktionsumfang und ein geprüftes Docker-Image.

### Neu

- Prüfung der Barrierefreiheit über alle Seiten aller Themes (Bibliothek, Sammlung, Genre, Person, Favoriten, Suche, Einstellungen, Player mit offenem Menü), auch im hellen Schema von Classic und Glass.
- Bilder aller Themes im README (`npm run readme-shots`), dazu dieser Changelog.

### Verbessert

- Horizon und Constellation: Nichts springt mehr, wenn die Titel des Hero geladen sind. Der Platzhalter hat jetzt die volle Höhe samt Punkten (Layout-Verschiebung von 0,05 auf 0,001).
- Constellation: Die Seitenleiste steht oben statt mittig, damit später geladene Bibliotheken die Einträge darüber nicht verschieben. Das Logo des aktuellen Banners lädt mit Vorrang.
- Horizon: Die aufgeklappte Karte passt auch bei kleineren Fenstern (z. B. 1280 px). Vorher ragten der Details-Knopf und die Bewertung aus der Karte.
- Barrierefreiheit (WCAG 2.5.3, sichtbare Beschriftung im Namen): Der Profilknopf von Neon Grid heißt jetzt so, wie er beschriftet ist („Operator …“), die Banner von Constellation tragen ihren sichtbaren Text als Namen, und die Initialen im Avatar zählen nicht mehr als Beschriftung.

### Behoben

- Beschreibungen mit HTML aus den Metadaten zeigten Zeilenumbrüche als `<br>`. Jetzt werden daraus Absätze.
- Lange Beschreibungen sind auf vier Zeilen gekürzt, „Mehr anzeigen“ klappt sie auf. Ton- und Untertitelspuren stehen untereinander, nach drei Einträgen geht es mit „+ n weitere“ weiter.
- Studios und Regie stehen ebenfalls untereinander und sind nach drei Einträgen gekürzt.
- Die Bibliotheksbilder von Jellyfin enthalten den Namen schon; die Themes schreiben ihn nicht mehr ein zweites Mal darüber.
- Die Sprungleiste der Bibliothek setzt den gewählten Buchstaben an den oberen Rand statt an den unteren.
- Mit vielen Bibliotheken lief die Navigation über den Rand. Was nicht passt, steht jetzt im Menü „Mehr“; Startseite, Suche und Favoriten bleiben immer sichtbar.
- Demo-Modus: Genre-Seiten zeigten „Nicht gefunden“, weil der Demo-Server Genres nicht über ihre ID fand.

## 0.10.0 – 2026-10-13

- Theme **Constellation**: Sternenhimmel, aufklappende Icon-Leiste, Banner-Karussell, leuchtende Kacheln für Bibliotheken und Sammlungen, Detailseiten mit Abschnitten.

## 0.9.0 – 2026-10-13

- Theme **Horizon**: Leiste mit Textlinks, Karussell mit seitlichen Pfeilen, aufklappende 16:9-Karten, Detailseiten mit Tabs.
- Das Docker-Image entsteht ohne Docker Hub (Pull-Limit und Ausfälle).

## 0.8.0 – 2026-10-09

- Theme **Glass**: Milchglas, Vollbild-Karussell, Karten mit Neigung und Lichtreflex, Hell- und Dunkelmodus.
- README mit Logo und Status-Badges.

## 0.7.0 – 2026-10-09

- Theme **Crimson**: Profilauswahl, Vorschaukarten, Details als Fenster über der Seite, Trailer im Hero.

## 0.6.0 – 2026-10-08

- Theme **Neon Grid**: HUD-Oberfläche mit Raster, Glitch-Effekten, Boot-Sequenz, Terminal-Suche und optionalen UI-Klängen.

## 0.5.0 – 2026-10-08

- Docker-Image für amd64 und arm64 mit nginx, Entrypoint, Proxy zu Jellyfin, strikter CSP und Healthcheck, Beispiel für Docker Compose, Release-Workflow, PWA-Manifest.

## 0.4.0 – 2026-10-08

- Theme-System mit Registry, Fallback auf Classic, Wechsel ohne Neuladen und Live-Vorschau.
- Einstellungen, gespeichert pro Benutzer auf dem Jellyfin-Server.
- Bedienung mit Pfeiltasten und Fernbedienung, TV-Modus.

## 0.3.0 – 2026-10-08

- Player: Direct Play und HLS, Ton- und Untertitelspuren, Qualität, Trickplay, Intro und Abspann überspringen, nächste Folge, Fortschrittsmeldung an Jellyfin.

## 0.2.0 – 2026-10-07

- Alle Inhaltsseiten im Theme Classic: Startseite, Bibliotheken, Details, Serien, Suche, Favoriten.

## 0.1.0 – 2026-10-07

- Grundgerüst, Anmeldung (Server, Profile, Passwort, Quick Connect), Demo-Modus mit Mock-Server, Deutsch und Englisch.
