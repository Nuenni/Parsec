/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

export type TIssueEmailLink = {
  id: string;
  requester_email: string;
  requester_name: string;
};

export class IssueEmailLinkService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetchEmailLink(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueEmailLink | null> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/email-link/`)
      .then((response) => response?.data)
      .catch(() => null);
  }
}
