/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { ChevronRightIcon } from "@plane/propel/icons";
import { Collapsible } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// services
import { GithubPullRequestService } from "@/services/issue/github_pull_request.service";
// local imports
import { GithubPullRequestChip } from "./pr-chip";

const githubPullRequestService = new GithubPullRequestService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export function GithubPullRequestsCollapsible(props: Props) {
  const { workspaceSlug, projectId, issueId } = props;
  const [isOpen, setIsOpen] = useState(true);
  const { allowPermissions } = useUserPermissions();
  const canUnlink = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const swrKey = workspaceSlug && projectId && issueId ? `ISSUE_GITHUB_PRS_${issueId}` : null;
  const { data: pullRequests, mutate } = useSWR(
    swrKey,
    () => githubPullRequestService.list(workspaceSlug, projectId, issueId),
    { refreshInterval: 30000 }
  );

  if (!pullRequests || pullRequests.length === 0) return null;

  const handleUnlink = async (pullRequestId: string) => {
    await githubPullRequestService.unlink(workspaceSlug, projectId, issueId, pullRequestId);
    mutate();
  };

  return (
    <div className="py-1 text-11">
      <Collapsible
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        title={
          <div className="flex w-full items-center justify-between gap-2 py-1.5">
            <h4>Pull requests</h4>
            <ChevronRightIcon className={cn("size-3 flex-shrink-0 transition-transform", { "rotate-90": isOpen })} />
          </div>
        }
        buttonClassName="w-full"
      >
        <div className="flex flex-col gap-2">
          {pullRequests.map((pr) => (
            <GithubPullRequestChip
              key={pr.id}
              pullRequest={pr}
              canUnlink={canUnlink}
              onUnlink={() => handleUnlink(pr.id)}
            />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}
