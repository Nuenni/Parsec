#!/usr/bin/env node
/**
 * Guards against new references to Plane Software, Inc.'s own infrastructure
 * (plane.so links, the makeplane org, forum/status/social channels, etc.)
 * sneaking back in - the thing three separate audit passes on this fork had
 * to hand-find. See .github/plane-reference-exceptions.txt for what's
 * intentionally, permanently allowed and why.
 *
 * .github/plane-reference-baseline.txt is a different thing: visible-but-
 * unlinked brand-text mentions ("Plane" in an email subject, a JSX string,
 * ...) that are cataloged, real, and deliberately NOT fixed here - that's a
 * separate future cleanup, not a link/contact-channel problem. They're not
 * "fine to stay" like an exception; they're "already known, don't re-flag
 * them every run." Anything not in either file is new and fails the run.
 *
 * Usage:
 *   node .github/scripts/check-plane-references.mjs             # check
 *   node .github/scripts/check-plane-references.mjs --write-baseline
 *     regenerates the baseline from the current (post-exceptions) hits -
 *     only after a deliberate look at what you're accepting, never blindly.
 *
 * Exit code 0 = clean, 1 = unexcepted/un-baselined hits found (file:line + text).
 */

import { readFileSync, readdirSync, lstatSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SEARCH_ROOTS = ["apps", "packages"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".html", ".json"]);
const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".next",
  "build",
  ".turbo",
  ".vite",
  "coverage",
  "__pycache__",
  ".venv",
]);
const EXCEPTIONS_FILE = join(ROOT, ".github", "plane-reference-exceptions.txt");
const BASELINE_FILE = join(ROOT, ".github", "plane-reference-baseline.txt");
const STEM_RE = /plane/i;
const WRITE_BASELINE = process.argv.includes("--write-baseline");

function loadExceptions() {
  const raw = readFileSync(EXCEPTIONS_FILE, "utf8");
  const pathExceptions = [];
  const lineExceptions = [];
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(path|line):(.+?)\s+#\s+(.+)$/);
    if (!match) {
      throw new Error(
        `Malformed exceptions line (expected "path:<pattern> # reason" or "line:<pattern> # reason"): ${rawLine}`
      );
    }
    const [, type, pattern, reason] = match;
    const entry = { pattern, reason, regex: new RegExp(pattern) };
    if (type === "path") pathExceptions.push(entry);
    else lineExceptions.push(entry);
  }
  return { pathExceptions, lineExceptions };
}

function baselineKey(file, text) {
  return `${file}\t${text}`;
}

function loadBaseline() {
  let raw;
  try {
    raw = readFileSync(BASELINE_FILE, "utf8");
  } catch {
    return new Set();
  }
  const keys = new Set();
  for (const rawLine of raw.split("\n")) {
    if (!rawLine || rawLine.startsWith("#")) continue;
    keys.add(rawLine);
  }
  return keys;
}

function walk(dir, files) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) continue; // avoid double-scanning (e.g. packages/i18n/locales -> src/locales) and symlink cycles
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(extname(name))) {
      files.push(full);
    }
  }
}

function main() {
  const { pathExceptions, lineExceptions } = loadExceptions();
  const files = [];
  for (const root of SEARCH_ROOTS) {
    walk(join(ROOT, root), files);
  }

  const afterExceptions = [];
  for (const absPath of files) {
    const relPath = relative(ROOT, absPath).split("\\").join("/");
    if (pathExceptions.some((e) => e.regex.test(relPath))) continue;

    const content = readFileSync(absPath, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!STEM_RE.test(line)) continue;
      if (lineExceptions.some((e) => e.regex.test(line))) continue;
      afterExceptions.push({ file: relPath, lineNo: i + 1, text: line.trim() });
    }
  }

  if (WRITE_BASELINE) {
    const keys = [...new Set(afterExceptions.map((h) => baselineKey(h.file, h.text)))].toSorted();
    const header =
      "# This is NOT the exceptions list. plane-reference-exceptions.txt is for references that\n" +
      "# are correct and may stay forever (our own package namespace, license headers, the docs\n" +
      "# links we deliberately kept) - an entry there is a decision, made once, done.\n" +
      "#\n" +
      "# This file is a debt ledger. Every line below is a known, already-reviewed reference to\n" +
      "# Plane infrastructure that is real and still unfixed - visible brand text with no link,\n" +
      "# or a link that's part of a larger, separately-scoped cleanup (e.g. the paid-tier upsell\n" +
      "# UI family: edition badge, upgrade modal, active-cycles paywall). An entry here is not a\n" +
      "# free pass, it's an IOU. This list should shrink as those cleanups happen, not grow as a\n" +
      "# place to dump anything inconvenient to fix under time pressure. See the audit report for\n" +
      "# what's tracked here and why. If a hit doesn't clearly belong in either file, it belongs\n" +
      "# in a report, not silently in this one.\n" +
      "# Regenerated via: node .github/scripts/check-plane-references.mjs --write-baseline\n" +
      "# Format: <file>\\t<exact matched line, trimmed>\n";
    writeFileSync(BASELINE_FILE, header + keys.join("\n") + "\n");
    console.log(`Wrote ${keys.length} baseline entries to ${relative(ROOT, BASELINE_FILE)}.`);
    return 0;
  }

  const baseline = loadBaseline();
  const hits = afterExceptions.filter((h) => !baseline.has(baselineKey(h.file, h.text)));

  if (hits.length === 0) {
    console.log(
      `plane-reference guard: clean. (${afterExceptions.length - hits.length} known/baselined hit(s) not re-flagged.)`
    );
    return 0;
  }

  console.error(
    `plane-reference guard: ${hits.length} new, un-baselined reference(s) to Plane infrastructure found.\n`
  );
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.lineNo}: ${hit.text}`);
  }
  console.error(
    `\nEach of these needs a decision, not a formality:\n` +
      `- If it's fine to stay permanently (our own package scope, a license header, ...), add it to\n` +
      `  .github/plane-reference-exceptions.txt with a one-line reason.\n` +
      `- If it's visible brand text with no link, already-known technical debt for a future cleanup,\n` +
      `  regenerate .github/plane-reference-baseline.txt (--write-baseline) after reviewing the diff.\n` +
      `- Otherwise, fix the reference.\n` +
      `Either file is a documented decision, not a rubber stamp - don't add an entry just to make CI pass.`
  );
  return 1;
}

process.exit(main());
