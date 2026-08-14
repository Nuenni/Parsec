/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useMember } from "@/hooks/store/use-member";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKMembersMenu } from "@/components/power-k/menus/members";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
};

// Multi-select, unlike status/priority: picking a person applies immediately
// (added to every selected issue, never removing an existing assignee - the
// same union-with-existing semantics bulkUpdateProperties already applies
// client-side) but does not close the menu, so several people can be added
// in one visit. Mirrors the single-issue power-k assignee menu's
// closeOnSelect: false.
export const BulkOperationsAssigneeMenu = observer(function BulkOperationsAssigneeMenu(props: Props) {
  const { issueIds } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { project: projectMember } = useMember();
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const issuesByProject = useIssuesByProject(issue, issueIds);
  const [addedAssigneeIds, setAddedAssigneeIds] = useState<string[]>([]);

  const projectIds = Object.keys(issuesByProject);
  // A member list only makes sense when the whole selection is one project -
  // project membership doesn't line up across projects the way state names do.
  const singleProjectId = projectIds.length === 1 ? projectIds[0] : undefined;
  const memberIds = singleProjectId
    ? (projectMember.getProjectMemberIds(singleProjectId, true) ?? undefined)
    : undefined;

  if (!singleProjectId) {
    return (
      <div className="px-3 py-4 text-13 text-tertiary">
        Assigning only works when every selected work item is in the same project.
      </div>
    );
  }

  const handleSelect = async (assigneeId: string) => {
    setAddedAssigneeIds((prev) => (prev.includes(assigneeId) ? prev : [...prev, assigneeId]));
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    try {
      await issues.bulkUpdateProperties(slug, singleProjectId, {
        issue_ids: issuesByProject[singleProjectId],
        properties: { assignee_ids: [assigneeId] },
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The assignee could not be added for one or more work items. Please try again.",
      });
    }
  };

  return <PowerKMembersMenu userIds={memberIds} value={addedAssigneeIds} handleSelect={handleSelect} />;
});
