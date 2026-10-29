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

The complete source code of the running instance lives in this repository.

The name and logo "Parsec" are not part of the AGPL licensing. This
project is not affiliated with, and is not endorsed by, the authors of
It's a Plan. The paid "Pro" images of It's a Plan are not used and their
features are not unlocked here; what we need beyond the core we build
ourselves.

### About the name

A parsec is the distance at which one astronomical unit subtends an angle
of one arcsecond: you measure an angle and get a distance. The logo uses
the same idea: an observer point, a measured arc, and the angle mark that
closes it.

## Branches

- `parsec-main`: the default branch and the code that runs. Our changes
  go in here through pull requests.
- `main`: a mirror of upstream `main`, kept for comparison. No own commits.

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
