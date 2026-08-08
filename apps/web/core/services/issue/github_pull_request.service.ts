/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
import type { TGithubPullRequestLink } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class GithubPullRequestService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string, issueId: string): Promise<TGithubPullRequestLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/github-prs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async unlink(workspaceSlug: string, projectId: string, issueId: string, pullRequestId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/github-prs/${pullRequestId}/`
    ).catch((error) => {
      throw error?.response?.data;
    });
  }
}
