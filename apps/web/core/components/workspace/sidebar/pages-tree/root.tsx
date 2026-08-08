/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store";
// local imports
import { PageTreeItem } from "./page-tree-item";

type TProjectPagesTreeProps = {
  workspaceSlug: string;
  projectId: string;
  isOpen: boolean;
};

export const ProjectPagesTree = observer(function ProjectPagesTree(props: TProjectPagesTreeProps) {
  const { workspaceSlug, projectId, isOpen } = props;
  // states
  const [hasFetched, setHasFetched] = useState(false);
  // store hooks
  const { fetchPagesList, getCurrentProjectRootPageIds } = usePageStore(EPageStoreType.PROJECT);
  // derived values
  const rootPageIds = getCurrentProjectRootPageIds(projectId);

  useEffect(() => {
    if (!isOpen || hasFetched || !workspaceSlug || !projectId) return;
    setHasFetched(true);
    fetchPagesList(workspaceSlug, projectId).catch(() => setHasFetched(false));
  }, [isOpen, hasFetched, workspaceSlug, projectId, fetchPagesList]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col gap-0.5 pt-0.5">
      {rootPageIds.map((pageId) => (
        <PageTreeItem key={pageId} workspaceSlug={workspaceSlug} projectId={projectId} pageId={pageId} depth={1} />
      ))}
    </div>
  );
});
