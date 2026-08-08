/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { GitMerge } from "lucide-react";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent } from "./";

type TIssueGithubPrActivity = { activityId: string; ends: "top" | "bottom" | undefined };

export const IssueGithubPrActivity = observer(function IssueGithubPrActivity(props: TIssueGithubPrActivity) {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<GitMerge size={14} className="text-label-indigo-text" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        <span>linked </span>
        <a
          href={activity.old_value ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {activity.new_value}
        </a>
      </>
    </IssueActivityBlockComponent>
  );
});
