/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// plane imports
import { ChevronRightIcon, PageIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { getPageName, cn } from "@plane/utils";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store";
// local imports
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";

type TPageTreeItemProps = {
  workspaceSlug: string;
  projectId: string;
  pageId: string;
  depth: number;
};

export const PageTreeItem = observer(function PageTreeItem(props: TPageTreeItemProps) {
  const { workspaceSlug, projectId, pageId, depth } = props;
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  // router
  const router = useRouter();
  const pathname = usePathname();
  // store hooks
  const { getPageById, getChildPageIds, createPage } = usePageStore(EPageStoreType.PROJECT);
  // derived values
  const page = getPageById(pageId);
  const childPageIds = getChildPageIds(pageId);
  const hasChildren = childPageIds.length > 0;

  if (!page) return null;

  const redirectionLink = page.getRedirectionLink();
  const isActive = pathname === redirectionLink;

  const handleAddSubPage = async () => {
    if (isCreatingChild) return;
    setIsCreatingChild(true);
    try {
      const newPage = await createPage({ parent: pageId });
      if (newPage?.id) {
        setIsOpen(true);
        router.push(`/${workspaceSlug}/projects/${projectId}/pages/${newPage.id}`);
      }
    } finally {
      setIsCreatingChild(false);
    }
  };

  return (
    <div>
      <SidebarNavItem isActive={isActive} className="group/page-item !py-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5" style={{ paddingLeft: `${depth * 14}px` }}>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn("grid size-4 flex-shrink-0 place-items-center rounded-xs hover:bg-layer-1", {
              invisible: !hasChildren,
            })}
          >
            <ChevronRightIcon
              className={cn("size-3 flex-shrink-0 text-placeholder transition-transform", { "rotate-90": isOpen })}
            />
          </button>
          <Link href={redirectionLink} className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5">
            <PageIcon className="size-3.5 flex-shrink-0 text-tertiary" />
            <span className="truncate text-11 font-medium">{getPageName(page.name)}</span>
          </Link>
        </div>
        <Tooltip tooltipContent="Add sub-page" position="top">
          <button
            type="button"
            onClick={handleAddSubPage}
            disabled={isCreatingChild}
            className="hidden flex-shrink-0 place-items-center rounded-xs p-0.5 text-placeholder group-hover/page-item:grid hover:bg-layer-1 hover:text-secondary"
          >
            <Plus className="size-3" />
          </button>
        </Tooltip>
      </SidebarNavItem>
      {isOpen && hasChildren && (
        <div>
          {childPageIds.map((childId) => (
            <PageTreeItem
              key={childId}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              pageId={childId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});
