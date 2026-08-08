/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ChevronRightIcon, PageIcon } from "@plane/propel/icons";
// plane imports
import { getPageName, cn } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { BlockItemAction } from "@/components/pages/list/block-item-action";
import { PageLabelChips } from "@/components/pages/list/page-label-chips";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePage } from "@/hooks/store";

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
  depth?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export const PageListBlock = observer(function PageListBlock(props: TPageListBlock) {
  const { pageId, storeType, depth = 0, hasChildren = false, isExpanded = false, onToggleExpand } = props;
  // refs
  const parentRef = useRef(null);
  // hooks
  const page = usePage({
    pageId,
    storeType,
  });
  const { isMobile } = usePlatformOS();
  // handle page check
  if (!page) return null;
  // derived values
  const { name, logo_props, label_ids, getRedirectionLink } = page;

  return (
    <ListItem
      prependTitleElement={
        <div className="flex flex-shrink-0 items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          {depth > 0 || hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand?.();
              }}
              className={cn("grid size-4 flex-shrink-0 place-items-center rounded-xs hover:bg-layer-1", {
                invisible: !hasChildren,
              })}
            >
              <ChevronRightIcon
                className={cn("size-3 flex-shrink-0 text-placeholder transition-transform", {
                  "rotate-90": isExpanded,
                })}
              />
            </button>
          ) : null}
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={16} type="lucide" />
          ) : (
            <PageIcon className="h-4 w-4 text-tertiary" />
          )}
        </div>
      }
      title={getPageName(name)}
      appendTitleElement={<PageLabelChips labelIds={label_ids} />}
      itemLink={getRedirectionLink()}
      actionableItems={<BlockItemAction page={page} parentRef={parentRef} storeType={storeType} />}
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
