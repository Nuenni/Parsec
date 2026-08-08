/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CheckCircle2, CircleDot, GitMerge, GitPullRequestClosed, XCircle, Loader2, X } from "lucide-react";
import type { TGithubPullRequestLink } from "@plane/types";
import { Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";

const STATE_META = {
  open: { label: "Open", icon: CircleDot, className: "text-success-primary bg-success-subtle" },
  merged: { label: "Merged", icon: GitMerge, className: "text-label-indigo-text bg-label-indigo-bg" },
  closed: { label: "Closed", icon: GitPullRequestClosed, className: "text-danger-primary bg-danger-subtle" },
} as const;

const CHECKS_META = {
  none: null,
  pending: { label: "Checks pending", icon: Loader2, className: "text-warning-primary" },
  success: { label: "All checks passed", icon: CheckCircle2, className: "text-success-primary" },
  failure: { label: "Checks failing", icon: XCircle, className: "text-danger-primary" },
} as const;

const REVIEW_STATE_META = {
  approved: { label: "approved", className: "text-success-primary" },
  changes_requested: { label: "changes requested", className: "text-danger-primary" },
  commented: { label: "commented", className: "text-tertiary" },
  dismissed: { label: "dismissed", className: "text-tertiary" },
} as const;

type Props = {
  pullRequest: TGithubPullRequestLink;
  onUnlink?: () => void;
  canUnlink?: boolean;
};

export function GithubPullRequestChip(props: Props) {
  const { pullRequest, onUnlink, canUnlink } = props;
  const stateMeta = STATE_META[pullRequest.state];
  const checksMeta = CHECKS_META[pullRequest.checks_status];
  const reviewers = pullRequest.reviewers ?? [];
  const approvedCount = reviewers.filter((reviewer) => reviewer.state === "approved").length;

  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface-2 p-2.5 hover:bg-layer-1">
      <div className="flex items-center gap-2">
        <a
          href={pullRequest.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span
            className={cn(
              "flex flex-shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-11",
              stateMeta.className
            )}
          >
            <stateMeta.icon className="size-3" />
            {stateMeta.label}
          </span>
          <span className="min-w-0 flex-1 truncate text-13">{pullRequest.title}</span>
          {checksMeta && (
            <span className={cn("flex flex-shrink-0 items-center", checksMeta.className)} title={checksMeta.label}>
              <checksMeta.icon className={cn("size-3.5", pullRequest.checks_status === "pending" && "animate-spin")} />
            </span>
          )}
          <span className="flex-shrink-0 text-11 text-tertiary">#{pullRequest.pr_number}</span>
        </a>
        {canUnlink && onUnlink && (
          <Tooltip tooltipContent="Unlink pull request">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onUnlink();
              }}
              className="flex-shrink-0 rounded p-0.5 text-tertiary hover:bg-layer-2 hover:text-primary"
            >
              <X className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
      {reviewers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 pl-1 text-11 text-tertiary">
          <span>
            Reviewers ({approvedCount}/{reviewers.length} approved):
          </span>
          {reviewers.map((reviewer) => (
            <span key={reviewer.login} className={REVIEW_STATE_META[reviewer.state]?.className}>
              {reviewer.login}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
