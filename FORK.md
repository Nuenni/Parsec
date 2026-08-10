# Parsec

Parsec is a fork of [Plane](https://github.com/makeplane/plane), licensed
under AGPL-3.0-only.

Modified since August 2026 by nafdo. Notable changes:

- Rebranding from "Plane" to "Parsec" across the web, admin, and space
  apps, as well as transactional emails
- GitHub integration built from scratch: bidirectional issue/comment/label
  sync, PR status linking, sync of GitHub Issue Fields (Priority, Effort),
  auth via our own GitHub App instead of a personal access token
- Email support inbox: inbound requests via IMAP polling, replies over SMTP
- Frontend added for page nesting and page labels that already existed in
  the backend; comment threading (replies) added in the frontend
- Deployment adapted for Coolify + Traefik as the self-hosting environment
- Various bugfixes (among others: S3 storage, the page-nesting API, avatar
  icons in notification emails)

The complete source code of the running instance lives in this repository.

"Plane" is a trademark of Plane Software, Inc. This project is not
affiliated with, and is not endorsed by, Plane Software, Inc. The name and
logo "Parsec" are not part of the AGPL licensing.

## Working with upstream

Upstream updates are **merged, not rebased** — rebasing rewrites our
history and makes `rerere` worthless.

Set this once after cloning:

    git config rerere.enabled true

Git then remembers resolved merge conflicts and reapplies the same
resolution automatically on the next upstream merge. This setting is local
and can't be distributed via the repository.

Binary brand files and `README.md` additionally use `merge=ours` (see
`.gitattributes`) — this also requires a local setting that can't be
distributed via the repository:

    git config merge.ours.driver true

Cadence for upstream merges: immediately for security updates, otherwise
occasionally as needed.

## Deployment notes

`web` and `admin` are served by the nginx config under
`apps/*/nginx/nginx.conf`. Both now set `absolute_redirect off;` and
`port_in_redirect off;` - behind Traefik terminating TLS, nginx's own
directory-redirect (`/some-path` -> `/some-path/`) otherwise builds an
absolute `Location` from its own `$scheme`/listen port, leaking an internal
`http://host:3000/...` URL to clients instead of a relative path.

`space` does **not** use nginx in production - its Docker image runs
`react-router-serve` directly (see `Dockerfile.space`'s final stage).
`apps/space/nginx/nginx.conf` still exists in the repo (unmodified from
upstream) but isn't part of the deployed image; don't assume a change there
takes effect.
