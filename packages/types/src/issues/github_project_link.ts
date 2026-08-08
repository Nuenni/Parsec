/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TGithubProjectLink = {
  id: string;
  project: string;
  repository_full_name: string;
  sync_issues: boolean;
  is_active: boolean;
  webhook_secret: string;
  webhook_url: string;
  created_at: string;
};

export type TGithubProjectLinkCreate = {
  repository_full_name: string;
  sync_issues?: boolean;
};
