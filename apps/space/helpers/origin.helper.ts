/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Resolves the origin a visitor actually reached the app on, for use in absolute
 * metadata URLs. Parsec is served behind a reverse proxy that terminates TLS, so
 * `request.url` carries the internal http:// origin and the forwarded headers are
 * the only source for the public one.
 */
export function getPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const forwarded = (name: string) => request.headers.get(name)?.split(",")[0]?.trim() || undefined;
  const protocol = forwarded("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = forwarded("x-forwarded-host") ?? url.host;
  return `${protocol}://${host}`;
}
