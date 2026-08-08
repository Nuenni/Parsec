/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
// plane imports
import { ChevronRightIcon } from "@plane/propel/icons";
import { Collapsible } from "@plane/ui";
import { cn } from "@plane/utils";
// services
import { GithubCommitService } from "@/services/issue/github_commit.service";
// local imports
import { GithubCommitChip } from "./commit-chip";

const githubCommitService = new GithubCommitService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export function GithubCommitsCollapsible(props: Props) {
  const { workspaceSlug, projectId, issueId } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { data: commits } = useSWR(
    workspaceSlug && projectId && issueId ? `ISSUE_GITHUB_COMMITS_${issueId}` : null,
    () => githubCommitService.list(workspaceSlug, projectId, issueId),
    { refreshInterval: 30000 }
  );

  if (!commits || commits.length === 0) return null;

  return (
    <div className="py-1 text-11">
      <Collapsible
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        title={
          <div className="flex w-full items-center justify-between gap-2 py-1.5">
            <h4>
              Commits <span className="text-tertiary">({commits.length})</span>
            </h4>
            <ChevronRightIcon className={cn("size-3 flex-shrink-0 transition-transform", { "rotate-90": isOpen })} />
          </div>
        }
        buttonClassName="w-full"
      >
        <div className="flex flex-col gap-2">
          {commits.map((commit) => (
            <GithubCommitChip key={commit.id} commit={commit} />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}
