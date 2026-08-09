/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader } from "@plane/ui";
// services
import { EmailIntakeConfigService } from "@/services/project/email-intake-config.service";
// local imports
import { EmailIntakeConfigForm } from "./config-form";
import { EmailIntakeConfigItem } from "./config-item";

const emailIntakeConfigService = new EmailIntakeConfigService();

// The API returns field-keyed errors (e.g. {"imap_password": "Could not connect..."})
// for connection-test failures, or {"error": "..."} for generic ones.
function extractErrorMessage(error: any): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error.error) return error.error;
  const firstValue = Object.values(error)[0];
  if (Array.isArray(firstValue)) return String(firstValue[0]);
  if (typeof firstValue === "string") return firstValue;
  return "Something went wrong.";
}

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

export function EmailIntakeSettingsRoot(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;

  const swrKey = workspaceSlug && projectId ? `PROJECT_EMAIL_INTAKE_CONFIGS_${projectId}` : null;
  const { data: configs, mutate } = useSWR(swrKey, () => emailIntakeConfigService.list(workspaceSlug, projectId));

  const handleCreate = async (data: Parameters<typeof emailIntakeConfigService.create>[2]) => {
    try {
      await emailIntakeConfigService.create(workspaceSlug, projectId, data);
      mutate();
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "Mailbox connected." });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
    }
  };

  const handleUpdate = async (configId: string, data: Parameters<typeof emailIntakeConfigService.update>[3]) => {
    try {
      await emailIntakeConfigService.update(workspaceSlug, projectId, configId, data);
      mutate();
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
      throw error;
    }
  };

  const handleDelete = async (configId: string) => {
    await emailIntakeConfigService.destroy(workspaceSlug, projectId, configId);
    mutate();
  };

  if (!configs) {
    return (
      <Loader className="space-y-3">
        <Loader.Item height="80px" />
      </Loader>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && configs.length === 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
          <h5 className="text-body-sm-medium">Connect a support mailbox</h5>
          <EmailIntakeConfigForm
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            submitLabel="Connect mailbox"
            onSubmit={handleCreate}
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {configs.length === 0 && <p className="text-13 text-tertiary">No mailbox connected yet.</p>}
        {configs.map((config) => (
          <EmailIntakeConfigItem
            key={config.id}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            config={config}
            onUpdate={(data) => handleUpdate(config.id, data)}
            onDelete={() => handleDelete(config.id)}
          />
        ))}
      </div>
    </div>
  );
}
