/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
import type { TGithubProjectLink, TGithubProjectLinkCreate } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class GithubProjectLinkService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TGithubProjectLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-links/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TGithubProjectLinkCreate): Promise<TGithubProjectLink> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-links/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TGithubProjectLinkCreate & { is_active: boolean }>
  ): Promise<TGithubProjectLink> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-links/${linkId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(workspaceSlug: string, projectId: string, linkId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-links/${linkId}/`).catch(
      (error) => {
        throw error?.response?.data;
      }
    );
  }
}
