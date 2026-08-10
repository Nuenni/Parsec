# Parsec

Selbstgehostetes Projekt- und Ticket-Management für interne Nutzung.

Parsec ist ein Fork von [Plane](https://github.com/makeplane/plane) und
steht wie das Original unter der **AGPL-3.0-only**. Details zu unseren
Änderungen und zur Lizenz: siehe [FORK.md](./FORK.md).

## Was anders ist als bei Plane

- Eigenständige GitHub-Integration: bidirektionaler Sync von Issues,
  Kommentaren und Labels, PR-Status-Verknüpfung, Sync der GitHub Issue
  Fields (Priority, Effort), Auth über eine eigene GitHub App
- Support-Ticket-Intake per E-Mail (IMAP-Polling, Antworten per SMTP)
- Verschachtelte Pages und Page-Labels im Frontend
- Kommentar-Threading
- Deployment für Coolify + Traefik

## Setup

Für Installation und Betrieb gilt im Wesentlichen die
[Dokumentation von Plane](https://developers.plane.so/self-hosting/overview)
— abweichend sind bei uns nur die Deployment-Anpassungen für Coolify und
Traefik.

## Lizenz und Herkunft

AGPL-3.0-only. "Plane" ist eine Marke von Plane Software, Inc. Dieses
Projekt steht in keiner Verbindung zu Plane Software, Inc. und wird von
dort nicht unterstützt.
