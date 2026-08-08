/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, Loader, ToggleSwitch } from "@plane/ui";
// services
import { GithubProjectLinkService } from "@/services/project/github-link.service";
// local imports
import { GithubProjectLinkItem } from "./link-item";

const githubProjectLinkService = new GithubProjectLinkService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

export function GithubProjectSettingsRoot(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [syncIssues, setSyncIssues] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const swrKey = workspaceSlug && projectId ? `PROJECT_GITHUB_LINKS_${projectId}` : null;
  const { data: links, mutate } = useSWR(swrKey, () => githubProjectLinkService.list(workspaceSlug, projectId));

  const handleCreate = async () => {
    if (!repositoryFullName.trim()) return;
    setIsCreating(true);
    try {
      await githubProjectLinkService.create(workspaceSlug, projectId, {
        repository_full_name: repositoryFullName.trim(),
        sync_issues: syncIssues,
      });
      setRepositoryFullName("");
      setSyncIssues(false);
      mutate();
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "Repository linked." });
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: error?.error ?? "Could not link this repository.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (linkId: string, data: { sync_issues?: boolean; is_active?: boolean }) => {
    await githubProjectLinkService.update(workspaceSlug, projectId, linkId, data);
    mutate();
  };

  const handleDelete = async (linkId: string) => {
    await githubProjectLinkService.destroy(workspaceSlug, projectId, linkId);
    mutate();
  };

  if (!links) {
    return (
      <Loader className="space-y-3">
        <Loader.Item height="80px" />
        <Loader.Item height="80px" />
      </Loader>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
          <h5 className="text-body-sm-medium">Link a GitHub repository</h5>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={repositoryFullName}
              onChange={(event) => setRepositoryFullName(event.target.value)}
              placeholder="owner/repository"
              className="w-full px-3 py-2 md:max-w-xs"
            />
            <div className="flex items-center gap-2 text-13">
              <ToggleSwitch value={syncIssues} onChange={setSyncIssues} />
              Sync issues both ways
            </div>
            <Button onClick={handleCreate} loading={isCreating} disabled={!repositoryFullName.trim()}>
              Add repository
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {links.length === 0 && <p className="text-13 text-tertiary">No GitHub repository linked yet.</p>}
        {links.map((link) => (
          <GithubProjectLinkItem
            key={link.id}
            link={link}
            onToggleSyncIssues={(value) => handleUpdate(link.id, { sync_issues: value })}
            onToggleActive={(value) => handleUpdate(link.id, { is_active: value })}
            onDelete={() => handleDelete(link.id)}
          />
        ))}
      </div>
    </div>
  );
}
