# Parsec brand assets (v2)

The source files for the Parsec mark. They replace the first Parsec mark.

## The mark

Four bars on the edges of a square, each shifted by one corner. It is a
geometric mark and does not try to illustrate the name.

A quarter turn maps the shape onto itself, so the loading indicator is the
same shape turning, and the animation loops without a visible jump.

## Colour

None, on purpose: Parsec carries no accent colour.

| Role | Hex |
| --- | --- |
| Mark on light backgrounds | `#111827` |
| Mark on dark backgrounds | `#f8fafc` |
| Badge background (app icon) | `#111827` |

## Files

```
parsec-mark.svg            mark, dark            → light surfaces
parsec-mark-light.svg      mark, light           → dark surfaces
parsec-mark-current.svg    mark in currentColor  → sidebar, inherits text colour
parsec-favicon.svg         switches with prefers-color-scheme
parsec-icon.svg            badge (rounded square) → app icon
parsec-icon-maskable.svg   PWA maskable, full bleed with safe zone
parsec-loader.svg          animated, dark
parsec-loader-light.svg    animated, light
parsec-logo-light.svg      mark plus wordmark, for light backgrounds
parsec-logo-dark.svg       mark plus wordmark, for dark backgrounds
preview.png                overview

png/parsec-mark-{16..1024}.png        transparent, dark
png/parsec-mark-light-{16..1024}.png  transparent, light
png/parsec-icon-{16..512}.png         badge, incl. 180 (Apple) / 192 / 512 (PWA)
png/parsec-icon-maskable-512.png
png/parsec-logo-{light,dark}[@2x,@4x].png

favicon.ico                           16 / 32 / 48 / 64 in one file
gif/parsec-loader-{dark,light}.gif     256 px, 24 frames, 30 ms
gif/parsec-loader-{dark,light}-128.gif 128 px
```

The GIFs have an opaque background (`#0b1120` or white), because GIF
transparency leaves fringes on soft edges. Render them again for a loading
screen with a different background. Prefer `parsec-loader.svg` where
possible: about 1 KB instead of 60, scales without loss and respects
`prefers-reduced-motion`.

## Where they are used

| Place | File in the app | Source |
| --- | --- | --- |
| Sidebar and header | `apps/web/src/components/brand/ParsecMark.tsx` | `parsec-mark-current.svg`, inlined |
| Favicon | `apps/web/src/app/icon.svg` | `parsec-favicon.svg` |
| Favicon fallback | `apps/web/src/app/favicon.ico` | 16/32/48/64 badge |
| Apple touch icon | `apps/web/src/app/apple-icon.png` | badge, 180 px |
| PWA icons | `apps/web/public/icon-{192,512}.png`, `icon-maskable-512.png` | badge |
| Email header | `apps/web/public/parsec-email-logo.png` | `parsec-logo-dark`, 2x |
| README | `README.md` | `parsec-logo-{light,dark}.svg` |

The name and logo "Parsec" are not covered by the AGPL, see `FORK.md`.
