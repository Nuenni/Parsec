/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@plane/propel/button";
import type { TEmailIntakeConfig, TEmailIntakeConfigCreate } from "@plane/types";
import { Input } from "@plane/ui";
// services
import { ProjectStateService } from "@/services/project/project-state.service";

const projectStateService = new ProjectStateService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  initialValue?: TEmailIntakeConfig;
  onSubmit: (data: TEmailIntakeConfigCreate) => Promise<void>;
  submitLabel: string;
};

const emptyForm: TEmailIntakeConfigCreate = {
  email_address: "",
  imap_host: "",
  imap_port: 993,
  imap_username: "",
  imap_password: "",
  imap_use_ssl: true,
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_use_tls: true,
  from_name: "",
  html_template: "",
  signature_html: "",
  state_on_customer_reply: null,
  state_on_agent_reply: null,
};

export function EmailIntakeConfigForm(props: Props) {
  const { workspaceSlug, projectId, initialValue, onSubmit, submitLabel } = props;
  const { data: states } = useSWR(workspaceSlug && projectId ? `PROJECT_STATES_${projectId}` : null, () =>
    projectStateService.getStates(workspaceSlug, projectId)
  );
  const [form, setForm] = useState<TEmailIntakeConfigCreate>(
    initialValue
      ? {
          email_address: initialValue.email_address,
          imap_host: initialValue.imap_host,
          imap_port: initialValue.imap_port,
          imap_username: initialValue.imap_username,
          imap_password: "",
          imap_use_ssl: initialValue.imap_use_ssl,
          smtp_host: initialValue.smtp_host,
          smtp_port: initialValue.smtp_port,
          smtp_username: initialValue.smtp_username,
          smtp_password: "",
          smtp_use_tls: initialValue.smtp_use_tls,
          from_name: initialValue.from_name,
          html_template: initialValue.html_template,
          signature_html: initialValue.signature_html,
          state_on_customer_reply: initialValue.state_on_customer_reply,
          state_on_agent_reply: initialValue.state_on_agent_reply,
        }
      : emptyForm
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = <K extends keyof TEmailIntakeConfigCreate>(key: K, value: TEmailIntakeConfigCreate[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = initialValue
    ? true
    : form.email_address.trim() &&
      form.imap_host.trim() &&
      form.imap_username.trim() &&
      form.imap_password.trim() &&
      form.smtp_host.trim() &&
      form.smtp_username.trim() &&
      form.smtp_password.trim();

  const selectClassName = "rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="email-intake-address" className="text-11 text-tertiary">
            Mailbox address
          </label>
          <Input
            id="email-intake-address"
            value={form.email_address}
            onChange={(event) => update("email_address", event.target.value)}
            placeholder="support@yourdomain.com"
            className="px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email-intake-from-name" className="text-11 text-tertiary">
            From name
          </label>
          <Input
            id="email-intake-from-name"
            value={form.from_name}
            onChange={(event) => update("from_name", event.target.value)}
            placeholder="Support"
            className="px-3 py-2"
          />
        </div>
      </div>

      <div className="border-t border-subtle pt-3">
        <h6 className="mb-2 text-13 font-medium">IMAP (incoming)</h6>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            value={form.imap_host}
            onChange={(event) => update("imap_host", event.target.value)}
            placeholder="IMAP host"
            className="px-3 py-2"
          />
          <Input
            type="number"
            value={form.imap_port}
            onChange={(event) => update("imap_port", Number(event.target.value))}
            placeholder="Port"
            className="px-3 py-2"
          />
          <Input
            value={form.imap_username}
            onChange={(event) => update("imap_username", event.target.value)}
            placeholder="Username"
            className="px-3 py-2"
          />
          <Input
            type="password"
            value={form.imap_password}
            onChange={(event) => update("imap_password", event.target.value)}
            placeholder={initialValue ? "•••• (leave blank to keep current)" : "Password"}
            className="px-3 py-2"
          />
        </div>
      </div>

      <div className="border-t border-subtle pt-3">
        <h6 className="mb-2 text-13 font-medium">SMTP (outgoing)</h6>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            value={form.smtp_host}
            onChange={(event) => update("smtp_host", event.target.value)}
            placeholder="SMTP host"
            className="px-3 py-2"
          />
          <Input
            type="number"
            value={form.smtp_port}
            onChange={(event) => update("smtp_port", Number(event.target.value))}
            placeholder="Port"
            className="px-3 py-2"
          />
          <Input
            value={form.smtp_username}
            onChange={(event) => update("smtp_username", event.target.value)}
            placeholder="Username"
            className="px-3 py-2"
          />
          <Input
            type="password"
            value={form.smtp_password}
            onChange={(event) => update("smtp_password", event.target.value)}
            placeholder={initialValue ? "•••• (leave blank to keep current)" : "Password"}
            className="px-3 py-2"
          />
        </div>
      </div>

      <div className="border-t border-subtle pt-3">
        <h6 className="mb-2 text-13 font-medium">Status automation</h6>
        <p className="mb-2 text-11 text-tertiary">
          Reuses this project&apos;s own states. Leave a dropdown on &quot;Don&apos;t change&quot; to skip that
          automation.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="email-intake-state-customer" className="text-11 text-tertiary">
              When a customer replies by email
            </label>
            <select
              id="email-intake-state-customer"
              className={selectClassName}
              value={form.state_on_customer_reply ?? ""}
              onChange={(event) => update("state_on_customer_reply", event.target.value || null)}
            >
              <option value="">Don&apos;t change</option>
              {states?.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="email-intake-state-agent" className="text-11 text-tertiary">
              When a teammate replies externally
            </label>
            <select
              id="email-intake-state-agent"
              className={selectClassName}
              value={form.state_on_agent_reply ?? ""}
              onChange={(event) => update("state_on_agent_reply", event.target.value || null)}
            >
              <option value="">Don&apos;t change</option>
              {states?.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-subtle pt-3">
        <h6 className="mb-2 text-13 font-medium">Email template</h6>
        <p className="mb-2 text-11 text-tertiary">
          Optional. Paste custom HTML to replace the default look. Available placeholders:{" "}
          <code className="text-tertiary">{"{{ brand_name }}"}</code>,{" "}
          <code className="text-tertiary">{"{{ heading }}"}</code>,{" "}
          <code className="text-tertiary">{"{{ body }}"}</code>,{" "}
          <code className="text-tertiary">{"{{ signature }}"}</code>. Leave blank to use the built-in template.
        </p>
        <textarea
          value={form.html_template}
          onChange={(event) => update("html_template", event.target.value)}
          placeholder="<div>...</div>"
          rows={6}
          className="font-mono w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 p-2 text-11 focus:outline-none"
        />
        <label htmlFor="email-intake-signature" className="mt-3 mb-1 block text-11 text-tertiary">
          Signature (HTML, appended to every email)
        </label>
        <textarea
          id="email-intake-signature"
          value={form.signature_html}
          onChange={(event) => update("signature_html", event.target.value)}
          placeholder="<p>-- <br>The Support Team</p>"
          rows={3}
          className="font-mono w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 p-2 text-11 focus:outline-none"
        />
      </div>

      <div>
        <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
