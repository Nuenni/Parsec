/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Fork-specific addition, absent from the upstream project this was forked from.
 */

import { useMemo } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { StateGroupIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { EIssueServiceType } from "@plane/types";
import type { IState } from "@plane/types";
import { Spinner } from "@plane/ui";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { useIssuesByProject } from "./use-issues-by-project";

type Props = {
  issueIds: string[];
  onClose: () => void;
};

export const BulkOperationsStatusMenu = observer(function BulkOperationsStatusMenu(props: Props) {
  const { issueIds, onClose } = props;
  // params
  const { workspaceSlug } = useParams();
  // store hooks
  const { getProjectStateIds, getStateById } = useProjectState();
  const { issue } = useIssueDetail(EIssueServiceType.ISSUES);
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const issuesByProject = useIssuesByProject(issue, issueIds);

  const projectIds = Object.keys(issuesByProject);

  // Only statuses that exist (by name) in every selected project can apply
  // to the whole selection at once - showing one project's states and
  // silently skipping issues in another would look like a bug.
  const commonStates = useMemo(() => {
    if (projectIds.length === 0) return [];
    const perProjectStates = projectIds.map((projectId) => {
      const stateIds = getProjectStateIds(projectId) ?? [];
      return stateIds.map((stateId) => getStateById(stateId)).filter((state): state is IState => !!state);
    });
    const [firstProjectStates, ...restProjectStates] = perProjectStates;
    return firstProjectStates.filter((candidate) =>
      restProjectStates.every((states) => states.some((state) => state.name === candidate.name))
    );
  }, [projectIds, getProjectStateIds, getStateById]);

  if (projectIds.length === 0) return <Spinner />;

  const handleSelect = async (stateName: string) => {
    onClose();
    const slug = workspaceSlug?.toString();
    if (!slug) return;
    try {
      await Promise.all(
        projectIds.map((projectId) => {
          const stateForProject = getProjectStateIds(projectId)
            ?.map((stateId) => getStateById(stateId))
            .find((state) => state?.name === stateName);
          if (!stateForProject) return Promise.resolve();
          return issues.bulkUpdateProperties(slug, projectId, {
            issue_ids: issuesByProject[projectId],
            properties: { state_id: stateForProject.id },
          });
        })
      );
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "The status could not be updated for one or more work items. Please try again.",
      });
    }
  };

  return (
    <Command.Group>
      {commonStates.map((state) => (
        <PowerKModalCommandItem
          key={state.name}
          iconNode={<StateGroupIcon stateGroup={state.group} color={state.color} className="size-3.5 shrink-0" />}
          label={state.name}
          onSelect={() => handleSelect(state.name)}
        />
      ))}
    </Command.Group>
  );
});
