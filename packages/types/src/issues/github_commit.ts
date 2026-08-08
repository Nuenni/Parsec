/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TGithubCommitLink = {
  id: string;
  issue: string;
  repository_full_name: string;
  sha: string;
  message: string;
  url: string;
  author_name: string;
  authored_at: string | null;
  created_at: string;
};
