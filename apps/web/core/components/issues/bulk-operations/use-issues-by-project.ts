/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { useMemo } from "react";
import type { IIssueDetail } from "@/store/issue/issue-details/root.store";

/**
 * Groups a bulk selection's issue ids by their project, since every bulk
 * endpoint here (state/priority/assignees/labels/dates/cycle/delete) is
 * scoped to one project at a time. Most selections come from a single
 * project's list/spreadsheet/gantt view, but a workspace-level "All Issues"
 * view can span several - grouping here means every caller issues one call
 * per project instead of guessing or silently dropping the other issues.
 */
export function useIssuesByProject(issue: IIssueDetail["issue"], issueIds: string[]): Record<string, string[]> {
  return useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const issueId of issueIds) {
      const projectId = issue.getIssueById(issueId)?.project_id;
      if (!projectId) continue;
      (grouped[projectId] ??= []).push(issueId);
    }
    return grouped;
  }, [issue, issueIds]);
}
