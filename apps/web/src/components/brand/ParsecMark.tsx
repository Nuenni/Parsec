// The Parsec mark in currentColor (assets/parsec/parsec-mark-current.svg), so it
// takes the text colour of its place, hover and active states included. The
// favicon with light and dark variants is `app/icon.svg`.
export default function ParsecMark({ className }: { className?: string }) {
  return (
    <svg viewBox="92 92 328 328" fill="none" aria-hidden="true" className={className}>
      <rect x="92" y="92" width="214" height="88" rx="28" fill="currentColor" />
      <rect x="332" y="92" width="88" height="214" rx="28" fill="currentColor" />
      <rect x="206" y="332" width="214" height="88" rx="28" fill="currentColor" />
      <rect x="92" y="206" width="88" height="214" rx="28" fill="currentColor" />
    </svg>
  );
}
