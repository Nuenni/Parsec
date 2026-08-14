/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { useState } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { getRandomLabelColor } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IIssueLabel } from "@plane/types";
import { Input } from "@plane/ui";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKLabelsMenu } from "@/components/power-k/menus/labels";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
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
  const { getProjectLabels, createLabel } = useLabel();
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const issuesByProject = useIssuesByProject(issue, issueIds);
  const [addedLabelIds, setAddedLabelIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const applyLabel = async (label: IIssueLabel) => {
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

  const handleCreate = async () => {
    const slug = workspaceSlug?.toString();
    const name = newLabelName.trim();
    if (!slug || !name || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const label = await createLabel(slug, singleProjectId, { name, color: getRandomLabelColor() });
      setNewLabelName("");
      setIsCreating(false);
      await applyLabel(label);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The label could not be created. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Command.Group>
        <PowerKModalCommandItem icon={Plus} label="Create label..." onSelect={() => setIsCreating(true)} />
      </Command.Group>
      {isCreating && (
        <form
          className="flex items-center gap-2 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <Input
            placeholder="Label name"
            value={newLabelName}
            onChange={(event) => setNewLabelName(event.target.value)}
            className="w-full text-13"
          />
          <Button type="submit" variant="secondary" size="sm" loading={isSubmitting} disabled={!newLabelName.trim()}>
            Create
          </Button>
        </form>
      )}
      <PowerKLabelsMenu labels={labels ?? []} value={addedLabelIds} onSelect={applyLabel} />
    </>
  );
});
