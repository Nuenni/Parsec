/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TEmailIntakeConfig = {
  id: string;
  project: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password_set: boolean;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password_set: boolean;
  smtp_use_tls: boolean;
  from_name: string;
  is_active: boolean;
  last_polled_at: string | null;
  created_at: string;
  html_template: string;
  signature_html: string;
  state_on_customer_reply: string | null;
  state_on_agent_reply: string | null;
};

export type TEmailIntakeConfigCreate = {
  email_address: string;
  imap_host: string;
  imap_port?: number;
  imap_username: string;
  imap_password: string;
  imap_use_ssl?: boolean;
  smtp_host: string;
  smtp_port?: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls?: boolean;
  from_name?: string;
  html_template?: string;
  signature_html?: string;
  state_on_customer_reply?: string | null;
  state_on_agent_reply?: string | null;
};
