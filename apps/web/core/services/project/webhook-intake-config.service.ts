/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
import type { TWebhookIntakeConfig, TWebhookIntakeSource } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class WebhookIntakeConfigService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TWebhookIntakeConfig[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/webhook-intake-configs/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, source: TWebhookIntakeSource): Promise<TWebhookIntakeConfig> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/webhook-intake-configs/`, { source })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    configId: string,
    data: { is_active: boolean }
  ): Promise<TWebhookIntakeConfig> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/webhook-intake-configs/${configId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async rotateToken(workspaceSlug: string, projectId: string, configId: string): Promise<TWebhookIntakeConfig> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/webhook-intake-configs/${configId}/rotate-token/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(workspaceSlug: string, projectId: string, configId: string): Promise<void> {
    await this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/webhook-intake-configs/${configId}/`
    ).catch((error) => {
      throw error?.response?.data;
    });
  }
}
