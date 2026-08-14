/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific: upstream gates the real bulk-actions toolbar behind a paid
 * plan and only ships an upgrade banner in the community edition (see the
 * removed BulkOperationsUpgradeBanner). Parsec has no such tier, so this is
 * a from-scratch bar rather than something unlocked.
 */

import { useState } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Contrast, Tag, Trash2, UserPlus, UserRoundCheck, X } from "lucide-react";
import { Command as CommandIcon } from "lucide-react";
import { CalendarDays, Signal } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useUser } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { BulkOperationsAssigneeMenu } from "./assignee-menu";
import { BulkOperationsCycleMenu } from "./cycle-menu";
import { BulkOperationsDeleteConfirm } from "./delete-confirm";
import { BulkOperationsDueDateMenu } from "./due-date-menu";
import { BulkOperationsLabelsMenu } from "./labels-menu";
import { BulkOperationsPriorityMenu } from "./priority-menu";
import { BulkOperationsStatusMenu } from "./status-menu";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

type TPage = "root" | "status" | "priority" | "assignee" | "labels" | "cycle" | "due-date" | "delete";

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { selectionHelpers } = props;
  // store hooks
  const { isSelectionActive, selectedEntityIds } = useMultipleSelectStore();
  const { data: currentUser } = useUser();
  const { workspaceSlug } = useParams();
  const { issue } = useIssueDetail();
  const { issues } = useIssues(useIssueStoreType());
  const issuesByProject = useIssuesByProject(issue, selectedEntityIds);
  // states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [page, setPage] = useState<TPage>("root");

  if (!isSelectionActive || selectionHelpers.isSelectionDisabled) return null;

  const closeMenu = () => {
    setIsMenuOpen(false);
    setTimeout(() => setPage("root"), 200);
  };

  const handleDeleted = () => {
    closeMenu();
    selectionHelpers.handleClearSelection();
  };

  const handleAssignToMe = async () => {
    closeMenu();
    const slug = workspaceSlug?.toString();
    if (!slug || !currentUser) return;
    try {
      await Promise.all(
        Object.entries(issuesByProject).map(([projectId, ids]) =>
          issues.bulkUpdateProperties(slug, projectId, {
            issue_ids: ids,
            properties: { assignee_ids: [currentUser.id] },
          })
        )
      );
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "One or more work items could not be assigned to you. Please try again.",
      });
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-8 z-20 flex justify-center">
      <div className="flex items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-2 shadow-raised-200">
        <span className="text-13 font-medium text-primary">{selectedEntityIds.length} selected</span>
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-13 text-secondary hover:bg-surface-2"
        >
          <CommandIcon className="size-3" />
          Actions
        </button>
        <button
          type="button"
          onClick={selectionHelpers.handleClearSelection}
          className="rounded-md p-1 text-secondary hover:bg-surface-2"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {isMenuOpen && (
        <>
          {/* Backdrop, click to close - same treatment as the power-k modal */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default bg-backdrop"
            onClick={closeMenu}
          />
          <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
            <div className="w-full max-w-md rounded-lg border border-subtle bg-surface-1 shadow-raised-200">
              <Command
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (page === "root") closeMenu();
                    else setPage("root");
                  }
                }}
              >
                <Command.List className="vertical-scrollbar scrollbar-sm max-h-96 overflow-scroll p-1 outline-none">
                  {page === "root" && (
                    <Command.Group>
                      <PowerKModalCommandItem
                        icon={UserPlus}
                        label="Assign to..."
                        onSelect={() => setPage("assignee")}
                      />
                      {currentUser && (
                        <PowerKModalCommandItem
                          icon={UserRoundCheck}
                          label="Assign to me"
                          onSelect={handleAssignToMe}
                        />
                      )}
                      <PowerKModalCommandItem label="Change status..." onSelect={() => setPage("status")} />
                      <PowerKModalCommandItem
                        icon={Signal}
                        label="Set priority..."
                        onSelect={() => setPage("priority")}
                      />
                      <PowerKModalCommandItem
                        icon={Tag}
                        label="Change or add labels..."
                        onSelect={() => setPage("labels")}
                      />
                      <PowerKModalCommandItem
                        icon={Contrast}
                        label="Add to cycle..."
                        onSelect={() => setPage("cycle")}
                      />
                      <PowerKModalCommandItem
                        icon={CalendarDays}
                        label="Set due date..."
                        onSelect={() => setPage("due-date")}
                      />
                      <PowerKModalCommandItem icon={Trash2} label="Delete issues" onSelect={() => setPage("delete")} />
                    </Command.Group>
                  )}
                  {page === "status" && <BulkOperationsStatusMenu issueIds={selectedEntityIds} onClose={closeMenu} />}
                  {page === "priority" && (
                    <BulkOperationsPriorityMenu issueIds={selectedEntityIds} onClose={closeMenu} />
                  )}
                  {page === "assignee" && <BulkOperationsAssigneeMenu issueIds={selectedEntityIds} />}
                  {page === "labels" && <BulkOperationsLabelsMenu issueIds={selectedEntityIds} />}
                  {page === "cycle" && <BulkOperationsCycleMenu issueIds={selectedEntityIds} onClose={closeMenu} />}
                  {page === "due-date" && (
                    <BulkOperationsDueDateMenu issueIds={selectedEntityIds} onClose={closeMenu} />
                  )}
                  {page === "delete" && (
                    <BulkOperationsDeleteConfirm
                      issueIds={selectedEntityIds}
                      onClose={() => setPage("root")}
                      onDeleted={handleDeleted}
                    />
                  )}
                </Command.List>
              </Command>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
