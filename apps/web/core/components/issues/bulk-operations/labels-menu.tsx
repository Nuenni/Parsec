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
import type { IIssueLabel } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKLabelsMenu } from "@/components/power-k/menus/labels";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
};

// Same "add, don't close" pattern as the assignee menu - picking a label
// applies immediately to every selected issue without removing labels
// already there, and the menu stays open for adding more than one.
export const BulkOperationsLabelsMenu = observer(function BulkOperationsLabelsMenu(props: Props) {
  const { issueIds } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { getProjectLabels } = useLabel();
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const issuesByProject = useIssuesByProject(issue, issueIds);
  const [addedLabelIds, setAddedLabelIds] = useState<string[]>([]);

  const projectIds = Object.keys(issuesByProject);
  // Labels are project-scoped, same restriction as the assignee menu.
  const singleProjectId = projectIds.length === 1 ? projectIds[0] : undefined;
  const labels = singleProjectId ? getProjectLabels(singleProjectId) : undefined;

  if (!singleProjectId) {
    return (
      <div className="px-3 py-4 text-13 text-tertiary">
        Labelling only works when every selected work item is in the same project.
      </div>
    );
  }

  const handleSelect = async (label: IIssueLabel) => {
    setAddedLabelIds((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]));
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    try {
      await issues.bulkUpdateProperties(slug, singleProjectId, {
        issue_ids: issuesByProject[singleProjectId],
        properties: { label_ids: [label.id] },
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The label could not be added for one or more work items. Please try again.",
      });
    }
  };

  return <PowerKLabelsMenu labels={labels ?? []} value={addedLabelIds} onSelect={handleSelect} />;
});
