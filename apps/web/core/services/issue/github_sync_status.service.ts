/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

export type TIssueGithubSyncStatus =
  | { synced: false }
  | { synced: true; repository_full_name: string; issue_number: string; github_url: string };

export class IssueGithubSyncStatusService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetchSyncStatus(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueGithubSyncStatus> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/github-sync-status/`)
      .then((response) => response?.data ?? { synced: false })
      .catch(() => ({ synced: false }) as const);
  }
}
