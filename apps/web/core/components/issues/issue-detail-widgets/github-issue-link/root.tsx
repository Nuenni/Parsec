/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { Github } from "lucide-react";
// services
import { IssueGithubSyncStatusService } from "@/services/issue/github_sync_status.service";

const issueGithubSyncStatusService = new IssueGithubSyncStatusService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export function GithubIssueLinkChip(props: Props) {
  const { workspaceSlug, projectId, issueId } = props;

  const swrKey = workspaceSlug && projectId && issueId ? `ISSUE_GITHUB_SYNC_STATUS_${issueId}` : null;
  const { data } = useSWR(swrKey, () =>
    issueGithubSyncStatusService.fetchSyncStatus(workspaceSlug, projectId, issueId)
  );

  if (!data?.synced) return null;

  return (
    <div className="py-1 text-11">
      <a
        href={data.github_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md bg-surface-2 p-2.5 hover:bg-layer-1"
      >
        <Github className="size-3.5 flex-shrink-0 text-tertiary" />
        <span className="min-w-0 flex-1 truncate text-13">{data.repository_full_name}</span>
        <span className="flex-shrink-0 text-11 text-tertiary">#{data.issue_number}</span>
      </a>
    </div>
  );
}
