/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
import type { TEmailIntakeConfig, TEmailIntakeConfigCreate } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class EmailIntakeConfigService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TEmailIntakeConfig[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/email-intake-configs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TEmailIntakeConfigCreate): Promise<TEmailIntakeConfig> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/email-intake-configs/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    configId: string,
    data: Partial<TEmailIntakeConfigCreate & { is_active: boolean }>
  ): Promise<TEmailIntakeConfig> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/email-intake-configs/${configId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(workspaceSlug: string, projectId: string, configId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/email-intake-configs/${configId}/`
    ).catch((error) => {
      throw error?.response?.data;
    });
  }
}
