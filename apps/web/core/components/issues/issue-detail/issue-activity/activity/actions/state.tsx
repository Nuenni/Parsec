/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// hooks
import { StateGroupIcon } from "@plane/propel/icons";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";
// icons

type TIssueStateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueStateActivity = observer(function IssueStateActivity(props: TIssueStateActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();

  const activity = getActivityById(activityId);
  const newState = getStateById(activity?.new_identifier);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={
        newState ? (
          <StateGroupIcon stateGroup={newState.group} color={newState.color} className="h-4 w-4 flex-shrink-0" />
        ) : (
          <StateGroupIcon stateGroup="unstarted" className="h-4 w-4 flex-shrink-0" />
        )
      }
      activityId={activityId}
      ends={ends}
    >
      <>
        set the state to <span className="font-medium text-primary">{activity.new_value}</span>
        {showIssue ? ` for ` : ``}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
