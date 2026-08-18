/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TWebhookIntakeSource = "USERBACK";

export type TWebhookIntakeConfig = {
  id: string;
  project: string;
  source: TWebhookIntakeSource;
  webhook_token: string;
  is_active: boolean;
  created_at: string;
};
