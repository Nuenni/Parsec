/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
// types
import type { TPageNavigationTabs } from "@plane/types";
// components
import { ListLayout } from "@/components/core/list";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// local imports
import { PageListBlock } from "./block";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PagesListRoot = observer(function PagesListRoot(props: TPagesListRoot) {
  const { pageType, storeType } = props;
  // states
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // store hooks
  const { getCurrentProjectFilteredPageIdsByTab, getPageById, getChildPageIds } = usePageStore(storeType);
  // derived values
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);

  if (!filteredPageIds) return <></>;

  // Nest pages that have a parent under that parent, matching the sidebar page
  // tree. A page whose parent got filtered/searched out (or belongs to a
  // different tab) is treated as a root so it never disappears from the list.
  const filteredSet = new Set(filteredPageIds);
  const rootPageIds = filteredPageIds.filter((pageId) => {
    const page = getPageById(pageId);
    return !page?.parent || !filteredSet.has(page.parent);
  });

  const toggleExpand = (pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const renderPageAndChildren = (pageId: string, depth: number) => {
    const childPageIds = getChildPageIds(pageId).filter((childId) => filteredSet.has(childId));
    const isExpanded = expandedIds.has(pageId);
    return (
      <Fragment key={pageId}>
        <PageListBlock
          pageId={pageId}
          storeType={storeType}
          depth={depth}
          hasChildren={childPageIds.length > 0}
          isExpanded={isExpanded}
          onToggleExpand={() => toggleExpand(pageId)}
        />
        {isExpanded && childPageIds.map((childId) => renderPageAndChildren(childId, depth + 1))}
      </Fragment>
    );
  };

  return <ListLayout>{rootPageIds.map((pageId) => renderPageAndChildren(pageId, 0))}</ListLayout>;
});
