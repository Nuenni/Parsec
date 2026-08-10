/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { CopyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TGithubProjectLink } from "@plane/types";
import { ToggleSwitch, Tooltip } from "@plane/ui";
import { calculateTimeAgo, copyTextToClipboard } from "@plane/utils";

// Consider the connection "healthy" if a webhook delivery was received recently -
// GitHub retries failed deliveries and re-pings on save, so a long silence usually
// means the webhook was never added (or was removed) on the GitHub side.
const HEALTHY_WINDOW_MS = 24 * 60 * 60 * 1000;

function getConnectionHealth(lastWebhookReceivedAt: string | null) {
  if (!lastWebhookReceivedAt) {
    return {
      color: "bg-danger-solid",
      label:
        "Not connected yet - no webhook delivery received. Add the webhook URL below in the GitHub repo's Settings > Webhooks.",
    };
  }
  const isRecent = Date.now() - new Date(lastWebhookReceivedAt).getTime() < HEALTHY_WINDOW_MS;
  if (isRecent) {
    return {
      color: "bg-success-solid",
      label: `Connected - last event received ${calculateTimeAgo(lastWebhookReceivedAt)}`,
    };
  }
  return {
    color: "bg-warning-solid",
    label: `No recent activity - last event received ${calculateTimeAgo(lastWebhookReceivedAt)}`,
  };
}

type Props = {
  link: TGithubProjectLink;
  onToggleSyncIssues: (value: boolean) => void;
  onToggleActive: (value: boolean) => void;
  onDelete: () => void;
};

export function GithubProjectLinkItem(props: Props) {
  const { link, onToggleSyncIssues, onToggleActive, onDelete } = props;
  const [showSecret, setShowSecret] = useState(false);

  const handleCopy = (value: string, label: string) => {
    copyTextToClipboard(value).then(() =>
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Copied", message: `${label} copied to clipboard.` })
    );
  };

  const health = getConnectionHealth(link.last_webhook_received_at);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-layer-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <h5 className="truncate text-body-sm-medium">{link.repository_full_name}</h5>
        <div className="flex items-center gap-3">
          <Tooltip tooltipContent={health.label}>
            <span className={`size-2 flex-shrink-0 rounded-full ${health.color}`} />
          </Tooltip>
          <span className="text-11 text-tertiary">Active</span>
          <ToggleSwitch value={link.is_active} onChange={onToggleActive} />
          <Tooltip tooltipContent="Remove this repository link">
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-13">Sync GitHub issues into this project</p>
          <p className="text-11 text-tertiary">
            Off = pull request status linking only. On = issues/comments opened on GitHub sync into Parsec, and changes
            made here sync back.
          </p>
        </div>
        <ToggleSwitch value={link.sync_issues} onChange={onToggleSyncIssues} />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-subtle pt-3">
        <p className="text-11 text-tertiary">Webhook URL - add this in the GitHub repo's Settings &gt; Webhooks</p>
        <div className="flex h-8 items-center justify-between gap-2 rounded-sm border border-subtle-1 bg-layer-1 px-2">
          <p className="truncate text-11">{link.webhook_url}</p>
          <button type="button" className="flex-shrink-0" onClick={() => handleCopy(link.webhook_url, "Webhook URL")}>
            <CopyIcon className="size-3 text-tertiary" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-11 text-tertiary">Webhook secret - use as the GitHub webhook's "Secret" field</p>
        <div className="flex h-8 items-center justify-between gap-2 rounded-sm border border-subtle-1 bg-layer-1 px-2">
          <p className="truncate text-11">{showSecret ? link.webhook_secret : "•".repeat(24)}</p>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={() => setShowSecret((prev) => !prev)}>
              {showSecret ? <EyeOff className="size-3 text-tertiary" /> : <Eye className="size-3 text-tertiary" />}
            </button>
            <button type="button" onClick={() => handleCopy(link.webhook_secret, "Webhook secret")}>
              <CopyIcon className="size-3 text-tertiary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
