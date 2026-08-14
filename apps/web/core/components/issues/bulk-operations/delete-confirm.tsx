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
import { Button } from "@plane/propel/button";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
  onClose: () => void;
  onDeleted: () => void;
};

export const BulkOperationsDeleteConfirm = observer(function BulkOperationsDeleteConfirm(props: Props) {
  const { issueIds, onClose, onDeleted } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { issues } = useIssues(useIssueStoreType());
  const issuesByProject = useIssuesByProject(issue, issueIds);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    setIsDeleting(true);
    try {
      await Promise.all(
        Object.entries(issuesByProject).map(([projectId, ids]) => issues.removeBulkIssues(slug, projectId, ids))
      );
      onDeleted();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "One or more work items could not be deleted. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4">
      <p className="text-14 text-primary">
        Delete {issueIds.length} work item{issueIds.length === 1 ? "" : "s"}?
      </p>
      <p className="mt-1 text-13 text-tertiary">This cannot be undone.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="error-fill" size="sm" onClick={handleDelete} loading={isDeleting}>
          Delete {issueIds.length} work item{issueIds.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
});
