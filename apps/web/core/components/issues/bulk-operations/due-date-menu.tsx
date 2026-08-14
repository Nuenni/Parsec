/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Calendar } from "@plane/propel/calendar";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { EIssuesStoreType } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { useIssuesByProject } from "./use-issues-by-project";

// updateIssueDates lives on IBaseIssuesStore, which every issue-store variant
// extends except the workspace-draft one - bulk due-date-setting on a
// drafts view isn't a real scenario, so narrowing the type here (like
// base-gantt-root.tsx does for the same method) is accurate, not a workaround.
type TDatableIssuesStoreType = Exclude<EIssuesStoreType, EIssuesStoreType.WORKSPACE_DRAFT>;

type Props = {
  issueIds: string[];
  onClose: () => void;
};

export const BulkOperationsDueDateMenu = observer(function BulkOperationsDueDateMenu(props: Props) {
  const { issueIds, onClose } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { issues } = useIssues(useIssueStoreType() as TDatableIssuesStoreType);
  const issuesByProject = useIssuesByProject(issue, issueIds);

  const handleSelect = async (date: Date | undefined) => {
    onClose();
    const slug = workspaceSlug?.toString();
    const targetDate = renderFormattedPayloadDate(date);
    if (!slug || !targetDate) return;
    try {
      await Promise.all(
        Object.entries(issuesByProject).map(([projectId, ids]) =>
          issues.updateIssueDates(
            slug,
            ids.map((id) => ({ id, target_date: targetDate })),
            projectId
          )
        )
      );
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The due date could not be updated for one or more work items. Please try again.",
      });
    }
  };

  return (
    <div className="p-2">
      <Calendar
        className="rounded-md border border-subtle p-3"
        captionLayout="dropdown"
        mode="single"
        showOutsideDays
        fixedWeeks
        onSelect={handleSelect}
      />
    </div>
  );
});
