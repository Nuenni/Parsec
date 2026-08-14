/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Upstream gates this behind a paid subscription plan. Parsec has no such
// tier to gate against, so bulk operations are simply always on.
export const useBulkOperationStatus = () => true;
