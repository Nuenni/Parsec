/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CopyIcon, RefreshCw, Trash2 } from "lucide-react";
import useSWR from "swr";
// plane imports
import { API_BASE_URL } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { Loader, ToggleSwitch } from "@plane/ui";
import { copyTextToClipboard } from "@plane/utils";
// services
import { WebhookIntakeConfigService } from "@/services/project/webhook-intake-config.service";

const webhookIntakeConfigService = new WebhookIntakeConfigService();

function extractErrorMessage(error: any): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error.error) return error.error;
  return "Something went wrong.";
}

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

export function WebhookIntakeSettingsRoot(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;

  const swrKey = workspaceSlug && projectId ? `PROJECT_WEBHOOK_INTAKE_CONFIGS_${projectId}` : null;
  const { data: configs, mutate } = useSWR(swrKey, () => webhookIntakeConfigService.list(workspaceSlug, projectId));

  const handleEnable = async () => {
    try {
      await webhookIntakeConfigService.create(workspaceSlug, projectId, "USERBACK");
      mutate();
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
    }
  };

  const handleToggleActive = async (configId: string, is_active: boolean) => {
    try {
      await webhookIntakeConfigService.update(workspaceSlug, projectId, configId, { is_active });
      mutate();
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
    }
  };

  const handleRotateToken = async (configId: string) => {
    try {
      await webhookIntakeConfigService.rotateToken(workspaceSlug, projectId, configId);
      mutate();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Token rotated",
        message: "The old webhook URL stopped working - update Userback with the new one below.",
      });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      await webhookIntakeConfigService.destroy(workspaceSlug, projectId, configId);
      mutate();
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: extractErrorMessage(error) });
    }
  };

  const handleCopy = (url: string) => {
    copyTextToClipboard(url)
      .then(() => setToast({ type: TOAST_TYPE.SUCCESS, title: "Copied", message: "Webhook URL copied to clipboard." }))
      .catch(() => setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not copy the URL." }));
  };

  if (!configs) {
    return (
      <Loader className="space-y-3">
        <Loader.Item height="80px" />
      </Loader>
    );
  }

  const userbackConfig = configs.find((config) => config.source === "USERBACK");
  const webhookUrl = userbackConfig
    ? `${API_BASE_URL}/api/v1/hooks/webhook-intake/${projectId}/${userbackConfig.webhook_token}/`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
        <div className="flex items-center justify-between gap-4">
          <h5 className="text-body-sm-medium">Userback</h5>
          {userbackConfig && (
            <div className="flex items-center gap-3">
              <span className="text-11 text-tertiary">Active</span>
              <ToggleSwitch
                value={userbackConfig.is_active}
                onChange={(value) => handleToggleActive(userbackConfig.id, value)}
              />
              {isAdmin && (
                <Tooltip tooltipContent="Disconnect Userback">
                  <button
                    type="button"
                    onClick={() => handleDelete(userbackConfig.id)}
                    className="rounded p-1 text-tertiary hover:bg-layer-3 hover:text-danger-primary"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <p className="text-11 text-tertiary">
          Turns Userback feedback into work items here automatically. New feedback creates a work item; assignee,
          priority, and comments stay in sync as they change in Userback; deleted feedback cancels the linked work item.
        </p>

        {!userbackConfig && isAdmin && (
          <Button variant="secondary" onClick={handleEnable} className="w-fit">
            Get webhook URL
          </Button>
        )}

        {webhookUrl && (
          <div className="flex flex-col gap-2">
            <div className="flex h-8 max-w-2xl items-center justify-between gap-2 rounded-sm border border-subtle px-2">
              <p className="truncate text-11 select-all">{webhookUrl}</p>
              <div className="flex shrink-0 items-center gap-2">
                <Tooltip tooltipContent="Copy webhook URL">
                  <button type="button" onClick={() => handleCopy(webhookUrl)} className="grid place-items-center">
                    <CopyIcon className="size-3.5 text-tertiary" />
                  </button>
                </Tooltip>
                {isAdmin && (
                  <Tooltip tooltipContent="Rotate token - invalidates the URL above">
                    <button
                      type="button"
                      onClick={() => handleRotateToken(userbackConfig!.id)}
                      className="grid place-items-center"
                    >
                      <RefreshCw className="size-3.5 text-tertiary" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            <p className="text-11 text-tertiary">
              Paste this into Userback under Project &gt; Connect &gt; Webhook. Enable: New feedback is added, Feedback
              assigned, Feedback priority is changed, Feedback is deleted, New comment is added to a feedback, Comment
              is updated, Comment is deleted. Leave &quot;Feedback status is changed&quot; and &quot;Feedback is
              voted&quot; unchecked - status sync isn&apos;t supported yet, and votes aren&apos;t relevant here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
