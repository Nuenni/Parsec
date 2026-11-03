# Parsec

Parsec is a fork of [It's a Plan](https://github.com/croffasia/itsaplan)
(itsaplan), licensed under AGPL-3.0.

Modified since October 2026 by nafdo. Based on itsaplan v1.9.0. Notable
changes:

- Rebranding from "It's a Plan" to "Parsec": the product mark in the
  sidebars (`apps/web/src/ce/BrandMark.tsx`, `ParsecMark.tsx`), the app
  logo, favicon, Apple and PWA icons, the app name (`APP_NAME`), and the
  name in emails, the API title, the GitHub link comment and the passkey
  name. Brand sources are in `assets/parsec/`.
- Team notification providers have their own From address (SMTP and
  Resend). Empty falls back to `EMAIL_FROM`, then to the SMTP username.
- Every outgoing email uses one HTML layout (`emailBody` in
  `packages/mailer`) modelled on Plane's email templates: dark header with
  the Parsec logo, a card with heading, button and fallback link, and a
  footer. The logo is `apps/web/public/parsec-email-logo-v2.png`.
- The CLA workflow is removed: it asks contributors to sign upstream's
  Contributor License Agreement, which does not apply to this fork.
- `publish-images.yml` lowercases the repository name for the GHCR image
  names (`ghcr.io/nuenni/parsec-api`, `-web`, `-worker`, `-bot`).
- Share links can expire (1, 3 or 7 days or a chosen date). Upstream merged
  the same feature as croffasia/itsaplan#786; on the next upstream merge
  take upstream's version and resolve the migration overlap (our
  `0159_share_expiry` vs. upstream `0171_share_expiry`, see PA-15).

The complete source code of the running instance lives in this repository.

The name and logo "Parsec" are not part of the AGPL licensing. This
project is not affiliated with, and is not endorsed by, the authors of
It's a Plan. The paid "Pro" images of It's a Plan are not used and their
features are not unlocked here; what we need beyond the core we build
ourselves.

### About the name

A parsec is the distance at which one astronomical unit subtends an angle
of one arcsecond: you measure an angle and get a distance. The logo does
not try to explain that. It is a geometric mark: four bars on the edges of
a square, each shifted by one corner, with no accent colour. A quarter turn
maps it onto itself, so the loading indicator is the same shape turning.
Details in `assets/parsec/README.md`.

## Contract with FeedbackOS

FeedbackOS (hub.payglue.io, PayGlue/FeedbackOS#25) creates and links
issues through the API and follows their state through webhooks. Nothing
in the code is changed for it, but the following must stay as it is.
Changing any of it breaks the integration silently: it only shows when a
state no longer arrives in the hub.

Webhook headers and signature

- `X-Itsaplan-Signature: t=<seconds>,v1=<hex>`, HMAC-SHA256 over
  `<t>.<raw body>` with the webhook secret (`signPayload` in
  `packages/crypto`). The worker signs every attempt anew, and the hub
  rejects timestamps more than 300 seconds off, so the server clock must be
  right.
- **Do not rename the `X-Itsaplan-*` headers during branding.** If they
  should ever read `X-Parsec-*`, FeedbackOS has to accept both names first.

Webhook payload (`issue.state_changed`)

- Top level: `event`, `createdAt`.
- In `data`: `identifier` (e.g. `PG-42`), `projectId`, `state.name`.

API (header `x-api-key`)

- `GET /projects`: `id`, `ref`, `key`, `name`.
- `GET /projects/{ref}`: `columns` with `id`, `name`, `stateType`,
  `position`.
- `POST /projects/{ref}/issues` with `columnId`, `title`, `description`;
  the response carries `identifier`.
- `POST /projects/{ref}/webhooks` with `url`, `events`; the response
  carries `id` and `secret`.
- `DELETE /webhooks/{id}`.

Web address

- The hub links issues as `<web>/<team>/issue/<KEY-n>`. If that route
  changes, the links in the hub die (the sync keeps working).

Check this list on every upstream merge (PA-11).

## Branches

- `parsec-main`: the default branch and the code that runs. Our changes
  go in here through pull requests.
- `main`: a mirror of upstream `main`, kept for comparison. No own commits.

## Releases and images

A Parsec release is a tag on `parsec-main` named after the upstream release
it is based on, e.g. `v1.9.0-parsec.1`. Run the "Publish images" workflow
with that tag. Coolify runs the images with `VERSION` set to the version
without the `v` (`1.9.0-parsec.1`). Prerelease-style tags do not move
`latest`.

## Working with upstream

Upstream updates are **merged, not rebased**. Rebasing rewrites our history
and makes `rerere` useless. Merge release tags (`git merge v1.10.0`), not
upstream `main`, so the running code always matches a published release
plus our changes.

Set this once after cloning:

    git remote add upstream https://github.com/croffasia/itsaplan.git
    git remote set-url --push upstream DISABLED
    git config rerere.enabled true
    git config merge.ours.driver true

`rerere` remembers resolved merge conflicts and reapplies the resolution on
the next upstream merge. `merge.ours` is needed for the `merge=ours` entries
in `.gitattributes`: binary brand files and `README.md` always keep our
version. Code and text files are never `merge=ours`, because that discards
the whole file on either side, including real upstream fixes. Our code
changes are kept small (the brand seam `@/cloud`, `APP_NAME`) so upstream
merges conflict rarely.

Cadence for upstream merges: immediately for security updates, otherwise
occasionally as needed.

Where possible, our own extensions are also offered upstream as a pull
request, so the fork stays small.
