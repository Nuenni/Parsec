/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { TEmailIntakeConfig, TEmailIntakeConfigCreate } from "@plane/types";
import { ToggleSwitch, Tooltip } from "@plane/ui";
// local imports
import { EmailIntakeConfigForm } from "./config-form";

type Props = {
  workspaceSlug: string;
  projectId: string;
  config: TEmailIntakeConfig;
  onUpdate: (data: Partial<TEmailIntakeConfigCreate & { is_active: boolean }>) => Promise<void>;
  onDelete: () => void;
};

export function EmailIntakeConfigItem(props: Props) {
  const { workspaceSlug, projectId, config, onUpdate, onDelete } = props;
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-layer-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <button type="button" className="truncate text-body-sm-medium" onClick={() => setIsEditing((prev) => !prev)}>
          {config.email_address}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-11 text-tertiary">Active</span>
          <ToggleSwitch value={config.is_active} onChange={(value) => onUpdate({ is_active: value })} />
          <Tooltip tooltipContent="Remove this mailbox">
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-tertiary hover:bg-layer-3 hover:text-danger-primary"
            >
              <Trash2 className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {!isEditing && (
        <div className="flex flex-col gap-1 text-11 text-tertiary">
          <span>
            IMAP: {config.imap_host}:{config.imap_port} ({config.imap_password_set ? "configured" : "not set"})
          </span>
          <span>
            SMTP: {config.smtp_host}:{config.smtp_port} ({config.smtp_password_set ? "configured" : "not set"})
          </span>
          {config.last_polled_at && <span>Last polled: {new Date(config.last_polled_at).toLocaleString()}</span>}
        </div>
      )}

      {isEditing && (
        <EmailIntakeConfigForm
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          initialValue={config}
          submitLabel="Save changes"
          onSubmit={async (data) => {
            await onUpdate(data);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
}
