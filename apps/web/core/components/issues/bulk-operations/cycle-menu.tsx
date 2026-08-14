/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { ICycle } from "@plane/types";
import { Spinner } from "@plane/ui";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKCyclesMenu } from "@/components/power-k/menus/cycles";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
  onClose: () => void;
};

export const BulkOperationsCycleMenu = observer(function BulkOperationsCycleMenu(props: Props) {
  const { issueIds, onClose } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { issues } = useIssues(useIssueStoreType());
  const { getProjectCycleIds, getCycleById, fetchAllCycles } = useCycle();
  const issuesByProject = useIssuesByProject(issue, issueIds);

  const projectIds = Object.keys(issuesByProject);
  // A cycle list only makes sense within one project - cycles don't span projects.
  const singleProjectId = projectIds.length === 1 ? projectIds[0] : undefined;

  useEffect(() => {
    const slug = workspaceSlug?.toString();
    if (slug && singleProjectId) fetchAllCycles(slug, singleProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleProjectId]);

  if (!singleProjectId) {
    return (
      <div className="px-3 py-4 text-13 text-tertiary">
        Adding to a cycle only works when every selected work item is in the same project.
      </div>
    );
  }

  const cycleIds = getProjectCycleIds(singleProjectId);
  if (!cycleIds) return <Spinner />;
  const cycles = cycleIds.map((cycleId) => getCycleById(cycleId)).filter((cycle): cycle is ICycle => !!cycle);

  const handleSelect = async (cycle: ICycle) => {
    onClose();
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    try {
      await issues.addIssueToCycle(slug, singleProjectId, cycle.id, issuesByProject[singleProjectId]);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "One or more work items could not be added to the cycle. Please try again.",
      });
    }
  };

  return <PowerKCyclesMenu cycles={cycles} onSelect={handleSelect} />;
});
