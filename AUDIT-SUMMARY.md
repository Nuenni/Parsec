# Fork-Compliance-Audit — Abschlussbericht

Stand: 2026-08-11. Gilt für den Live-Branch `parsec-main`, Deployment
`pm.nafdo.de`. Dieses Dokument ist als Nachschlagewerk gedacht, nicht als
Protokoll — es setzt keine Kenntnis der Einzelschritte voraus.

## 1. AGPL-Pflichten — Status

| Pflicht                                                                | Status  | Wo es steht                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §5(a) Änderungshinweis                                                 | Erfüllt | `FORK.md` (Root), seit PR #1 im `parsec-main`-Branch, vorher nur auf einem nie gemergten Orphan-Branch — zählte bis dahin nicht                                                                                                                                                          |
| §13 Corresponding Source der laufenden Version                         | Erfüllt | Footer-Credit-Link (`apps/web/core/components/auth-screens/footer.tsx`) und alle 11 relevanten E-Mail-Templates zeigen auf `github.com/Nuenni/Parsec`, nicht auf `makeplane/plane`. Ursprünglich zeigte der Footer-Link auf das Upstream-Repo — das war der Auslöser des gesamten Audits |
| Lizenzintegrität (SPDX-Header, LICENSE-Datei)                          | Erfüllt | Header wurden geprüft und ergänzt wo sie fehlten (z.B. `github/__init__.py`)                                                                                                                                                                                                             |
| Markentrennung ("Plane" ist ein Warenzeichen von Plane Software, Inc.) | Erfüllt | Trademark-Hinweis in `FORK.md`; eigener Name/Logo-Ursprung dokumentiert                                                                                                                                                                                                                  |

## 2. Bewusst nicht geändert — und warum

- **Docs-Links** (`docs.plane.so`, `developers.plane.so`, `go.plane.so/p-docs`) — bleiben im UI. Beschreiben größtenteils das Produkt, das wir tatsächlich betreiben; eigene Dokumentation existiert nicht. Entfernen würde die Instanz schlechter machen, ohne dass jemand etwas gewinnt.
- **Docstrings und Code-Kommentare** — kein Nutzer sieht sie, jede Änderung ist reine Merge-Schuld gegen Upstream ohne Nutzen.
- **Billing-Vergleichsseite** (`workspace/billing/comparison/*`) — enthält weiterhin echten Upsell-Inhalt inklusive eines funktionierenden Checkout-Buttons zu `app.plane.so`. Bewusst zurückgestellt: nur ein Workspace-Admin erreicht sie aktiv über die Settings, aktuell eine einzige Person. Das ist eine befristete Risikoakzeptanz, kein Versehen — bei geänderter Erreichbarkeit (z.B. mehr Admins) neu bewerten.
- **Seed-Daten** (`workspace_seed_task.py`, Bot-User-Anzeigename teilweise "Plane") — der reine Anzeigename (`display_name`/`first_name`) wurde gefixt, da das nur künftige Workspace-Seeds betrifft, keine Migration. Der URL-Fallback (`... or 'https://plane.so'`) blieb unangetastet, da er nur bei fehlender `WEB_URL`-Konfiguration greift (bei uns nicht der Fall) und ein Ersatzwert dort erfunden werden müsste.
- **Maßnahme 6** (Versionskennung im UI) — zurückgestellt, kein Compliance-Thema.
- **Maßnahme 12** (Branding-Docker-Overlay) — zurückgestellt, kein Compliance-Thema.
- **Maßnahme 13** (eigene Datenhaltung für GitHub-Sync/E-Mail-Intake) — zurückgestellt, kein Compliance-Thema.
- **Maßnahme 11** (Django-Signals-Refaktor) — **verworfen**, nicht offen. War nie geplant umzusetzen.

## 3. Divergenz zu Upstream

- Phase 1 (ursprüngliche Bestandsaufnahme): 163 Dateien wichen von `upstream/preview` ab.
- Aktueller Stand: 276 Dateien weichen ab. Der Zuwachs stammt größtenteils aus regulärer Produktarbeit zwischen den Audit-Phasen (GitHub-Integration, E-Mail-Intake, Seitenverschachtelung u.a.), nicht primär aus diesem Compliance-Projekt.
- Direkt durch dieses Projekt (Admin-Redirect-Fix bis zu diesem Abschlussbericht) berührt: 122 Dateien. Davon ein zweistelliger Teil komplett neu zur Patch-Fläche hinzugekommen (z.B. `apps/*/nginx/nginx.conf` in `web`/`admin` — vorher 0-Diff gegenüber Upstream, jetzt mit `absolute_redirect off`/`port_in_redirect off` divergent), der Rest sind Textänderungen in ohnehin schon divergenten Dateien (z.B. bereits rebrandete Komponenten).
- Durch dieses Projekt vollständig **entfernt** (kein Diff mehr nötig, da Datei gelöscht): die gesamte `license/modal`-Komponenten-Baumstruktur (9 Dateien), `workspace/edition-badge.tsx`, `active-cycles/*` (Route, Layout, Header, Seite, Upgrade-Komponente, 6 Bild-Assets).

## 4. Was der CI-Wächter abdeckt — und was nicht

`.github/workflows/plane-reference-check.yml` läuft bei jedem PR gegen `parsec-main`.

**Deckt ab:** neue, textuelle Erwähnungen des Wortstamms "plane" (case-insensitiv, ohne Wortgrenze) in `apps/` und `packages/` — Links, Kontaktkanäle, sichtbare Markentexte, E-Mail-Inhalte.

**Deckt nicht ab:**

- Bilder/Icons mit Plane-Branding, die keinen Text enthalten (der `PlaneNewIcon`-Fund in `app-rail-hoc.tsx` wurde nur durch manuelle Recherche gefunden, nicht durch den Wächter)
- Funktionale Logik, die auf Plane-spezifische Werte prüft, ohne "plane" im Variablennamen zu tragen
- Neue Dateitypen außerhalb von `apps/`/`packages/` oder außerhalb der gescannten Endungen (ts/tsx/js/jsx/py/html/json)
- Alles, was bereits in der Ausnahme- oder Baseline-Liste steht (siehe unten)

## 5. Baseline-Reststand

Aktuell **338 Einträge** in `.github/plane-reference-baseline.txt`. Kategorien (Näherungswerte):

- **~60** Upsell-UI-Familie — verbleibende Konstanten/Komponenten der Billing-Vergleichsseite (bewusst zurückgestellt, siehe Abschnitt 2)
- **~16** SEO-/Metadata-Konstanten (`og:url`, `SITE_URL` u.ä.) — nicht klickbar, separates künftiges Aufräumen
- **~6** echte Restposten ohne klare Kategorie — u.a. der `EMAIL_FROM`-Fallback-Text selbst (Code bleibt, Konfiguration ist per FORK.md als Pflicht dokumentiert), der tote `intake@plane.so`-Check in `inbox-list-item.tsx`
- **~256** sichtbare Markentext-Erwähnungen ohne Link (E-Mail-Betreffzeilen wurden bereits gefixt; verbleibend sind primär Docstrings, Migrationen, interne Identifier und ein kleiner Rest UI-Text, der bei nächster Gelegenheit einzeln durchgesehen werden kann)

Die Liste soll schrumpfen, nicht wachsen — jeder Eintrag ist eine Schuld, keine Ausnahme.

## 6. Der teuerste Fehler dieses Projekts

Ein automatisierter Bulk-Textersatz ("Plane" → "Parsec") hätte beinahe reale S3-Bild-URLs in E-Mail-Templates, die AGPL-Attributionszeile, `tsconfig.json`-Pfad-Aliase samt Imports, Icon-Registry-Keys, eine funktionale Slug-Sperrliste, Celery-/Django-interne Namen und i18n-JSON-**Keys** zerstört. Alles vor dem Commit gefunden und zurückgenommen — Details und die daraus abgeleitete Regel stehen in `FORK.md` unter "Working with automated find-and-replace across this codebase".

## 7. Offene Punkte (nicht Rückstand, bewusst offen)

- Baseline-Textreste (siehe Abschnitt 5) — bei Gelegenheit, kein eigenes Vorhaben
- Billing-Vergleichsseite — Risikoakzeptanz, keine Aufgabe
- Maßnahme 6 (Versionskennung), 12 (Branding-Overlay), 13 (eigene Datenhaltung) — zurückgestellt aus Phase 2
- Maßnahme 11 (Django-Signals) — verworfen

## 8. Ausstehender Klicktest

Der Review in diesem Projekt lief überwiegend code-basiert, da dem Agenten kein Browser zur Verfügung stand. Manuell noch zu prüfen:

- Web-Fehlerseite und Space-Fehlerseite (Text korrigiert, nie live gesehen)
- "What's new"-Panel (zeigt jetzt einen neutralen Empty-State statt Planes Changelog)
- Sidebar ohne Edition-Badge (sauberes Rendering ohne die entfernte Komponente)
- Menüpunkt "Cycles" (jetzt vollständig entfernt, nicht nur der Inhalt)
