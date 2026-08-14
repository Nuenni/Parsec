/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { PriorityIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TIssuePriorities } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
  onClose: () => void;
};

export const BulkOperationsPriorityMenu = observer(function BulkOperationsPriorityMenu(props: Props) {
  const { issueIds, onClose } = props;
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const issuesByProject = useIssuesByProject(issue, issueIds);

  const handleSelect = async (priority: TIssuePriorities) => {
    onClose();
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    try {
      await Promise.all(
        Object.entries(issuesByProject).map(([projectId, ids]) =>
          issues.bulkUpdateProperties(slug, projectId, { issue_ids: ids, properties: { priority } })
        )
      );
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The priority could not be updated for one or more work items. Please try again.",
      });
    }
  };

  return (
    <Command.Group>
      {ISSUE_PRIORITIES.map((priority) => (
        <PowerKModalCommandItem
          key={priority.key}
          iconNode={<PriorityIcon priority={priority.key} />}
          label={priority.title}
          onSelect={() => handleSelect(priority.key)}
        />
      ))}
    </Command.Group>
  );
});
