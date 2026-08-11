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

### About the name

A parsec is the distance at which one astronomical unit subtends an angle
of one arcsecond — you measure an angle and get a distance. That idea is
also what the logo is built on: an observer point, a measured arc, and the
angle mark that closes it.

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

## Links to Plane infrastructure

Links to Plane's own documentation (docs.plane.so) stay in the UI - it
largely describes the product we actually run, we have no documentation of
our own, and removing the links would make the instance worse without
anyone gaining anything. Removed instead: every contact channel (support,
forum, bug report, status page, social) and product/marketing links, since
those pointed users at a company we have no relationship with.

## Terms of Service / Privacy Policy notice in the Space app

The upstream notice linking to Plane's Terms of Service and Privacy Policy
was removed from Space's sign-in/sign-up screen - it named a third-party
company as the party whose terms users were agreeing to. A replacement
isn't necessary as long as external sign-up stays disabled; if it's ever
turned on, this needs to be reassessed. The email support intake isn't
affected by this - that processing is already covered by the existing
privacy policy and the Hetzner data-processing agreement.

## Deployment notes

`web` and `admin` are served by the nginx config under
`apps/*/nginx/nginx.conf`. Both now set `absolute_redirect off;` and
`port_in_redirect off;` - behind Traefik terminating TLS, nginx's own
directory-redirect (`/some-path` -> `/some-path/`) otherwise builds an
absolute `Location` from its own `$scheme`/listen port, leaking an internal
`http://host:3000/...` URL to clients instead of a relative path. Both
files were a 0-diff match against upstream before this change.

`space` does **not** use nginx in production - its Docker image runs
`react-router-serve` directly (see `Dockerfile.space`'s final stage).
`apps/space/nginx/nginx.conf` still exists in the repo (unmodified from
upstream) but isn't part of the deployed image; don't assume a change there
takes effect. This matters for any future nginx change too: it only ever
needs to touch `web` and `admin`.

## Upsell and billing

The workspace edition badge (sidebar) and the Active Cycles page's upgrade
banner were removed entirely, not just de-linked - both had "Upgrade"
buttons that opened real, working checkout pages at app.plane.so. On a
self-hosted instance that's not a branding issue, it's a way for someone to
pay Plane Software, Inc. real money for a license that unlocks nothing
here.

The billing comparison page (workspace settings -> Billing) still has the
same kind of upgrade content, including its own working checkout button -
left in place for now because it's only reachable by a workspace admin who
actively navigates to Settings, and today that's a single person. This is
a deliberate, temporary risk acceptance, not an oversight - revisit if that
changes.

## Working with automated find-and-replace across this codebase

Any future pass that mechanically replaces "Plane" with "Parsec" (or
similar) needs a human reviewing the diff before it's committed, not just
before it's designed. A word-boundary-safe find-and-replace pass in this
repo still corrupted, in one run: S3-hosted image URLs in email templates
(real assets on Plane's infrastructure, not ours to rename), the "forked
from Plane" AGPL attribution line (renaming it to "forked from Parsec"
makes the required notice nonsensical), `tsconfig.json` path aliases
(`@/plane-editor/*`) and every import statement using them, icon-registry
lookup keys and file-path re-exports, a functional reserved-workspace-slug
blocklist, Celery/Django internal process and URL names, and i18n JSON
**keys** (not just values - a key rename breaks every `t("...")` call site
that references it).

The rule for next time: "Plane" is an identifier in many places in this
codebase, not a brand name, and nothing distinguishes the two syntactically.
Text replacement has to be manual, scoped to strings actually rendered to a
user, one file at a time - never a blind pattern match across the tree.

## `lint --fix` needs a diff review too

`pnpm exec oxlint --fix` once rewrote working code while "fixing" an
unrelated warning - it collapsed `await Promise.all([x])` into `[await x]`,
which is not equivalent (no `Promise.all` semantics, the resolved value is
discarded into an array). This had nothing to do with the lint rule that
triggered it. Treat `--fix` output the same as any other code change: read
the diff before staging, don't assume "the linter did it" means it's safe.
