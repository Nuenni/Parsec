<p align="center">
  <img src=".github/assets/logo.svg" alt="Parsec" width="120" />
</p>

<h1 align="center">Parsec</h1>

<p align="center"><b>Self-hosted project & ticket management, running our own way.</b></p>

<p align="center">
  <a href="LICENSE.txt"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License: AGPL-3.0"></a>
  <img src="https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <a href="https://github.com/makeplane/plane"><img src="https://img.shields.io/badge/fork%20of-Plane-6366f1" alt="Fork of Plane"></a>
</p>

---

## What this is

Parsec is a fork of [Plane](https://github.com/makeplane/plane), an
open-source project management tool, licensed under **AGPL-3.0-only**.
It runs our internal work for NAFDO/PayGlue projects, not as a public
product. Details on what we changed and why: [FORK.md](./FORK.md).

## What's different from Plane

- A from-scratch GitHub integration: bidirectional sync of issues,
  comments and labels, PR status linking, sync of GitHub Issue Fields
  (Priority, Effort), auth via our own GitHub App
- Support-ticket intake by email (IMAP polling, replies over SMTP)
- Nested pages and page labels in the frontend
- Comment threading
- Deployment adapted for Coolify + Traefik

## Setup

Installation and operation follow Plane's own
[self-hosting documentation](https://developers.plane.so/self-hosting/overview)
almost exactly — the only real deviation is our Coolify/Traefik deployment
setup instead of Plane's bundled Caddy proxy.

## License and origin

AGPL-3.0-only. "Plane" is a trademark of Plane Software, Inc. This project
is not affiliated with, and is not endorsed by, Plane Software, Inc.

## Forking Parsec

The code is AGPL-3.0 — feel free to fork it. The name and logo "Parsec"
are not covered by that licence, so please replace the branding with your
own, the way we replaced Plane's. See [FORK.md](./FORK.md) for the rest.
