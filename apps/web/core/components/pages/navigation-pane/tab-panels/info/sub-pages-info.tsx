/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { PageIcon } from "@plane/propel/icons";
import { getPageName } from "@plane/utils";
// hooks
import { EPageStoreType, usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  page: TPageInstance;
  disabled?: boolean;
};

export const PageNavigationPaneInfoTabSubPagesInfo = observer(function PageNavigationPaneInfoTabSubPagesInfo(
  props: Props
) {
  const { page, disabled = false } = props;
  // states
  const [isCreating, setIsCreating] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug } = useParams();
  // translation
  const { t } = useTranslation();
  // store hooks
  const { getPageById, getChildPageIds, createPage } = usePageStore(EPageStoreType.PROJECT);
  // derived values
  const projectId = page.project_ids?.[0];
  const ancestorPages = (() => {
    const chain: TPageInstance[] = [];
    const visited = new Set<string>();
    let current = page.parent ? getPageById(page.parent) : undefined;
    while (current?.id && !visited.has(current.id)) {
      visited.add(current.id);
      chain.unshift(current);
      current = current.parent ? getPageById(current.parent) : undefined;
    }
    return chain;
  })();
  const childPageIds = page.id ? getChildPageIds(page.id) : [];

  const handleAddSubPage = async () => {
    if (!page.id || !workspaceSlug || !projectId || isCreating) return;
    setIsCreating(true);
    try {
      const newPage = await createPage({ parent: page.id });
      if (newPage?.id) router.push(`/${workspaceSlug}/projects/${projectId}/pages/${newPage.id}/`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mt-4">
      {ancestorPages.length > 0 && (
        <div className="mb-3">
          <p className="text-11 font-medium text-tertiary">{t("page_navigation_pane.tabs.info.sub_pages.parent")}</p>
          <div className="mt-2 flex flex-col gap-1">
            {ancestorPages.map((ancestor, index) => (
              <Link
                key={ancestor.id}
                href={ancestor.getRedirectionLink()}
                className="flex items-center gap-1.5 text-13 font-medium text-secondary hover:text-primary"
                style={{ paddingLeft: `${index * 12}px` }}
              >
                <PageIcon className="size-3.5 flex-shrink-0 text-tertiary" />
                <span className="truncate">{getPageName(ancestor.name)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-11 font-medium text-tertiary">{t("page_navigation_pane.tabs.info.sub_pages.label")}</p>
        {!disabled && (
          <button
            type="button"
            onClick={handleAddSubPage}
            disabled={isCreating}
            className="grid size-4 place-items-center rounded-xs text-placeholder hover:bg-layer-1 hover:text-secondary"
          >
            <Plus className="size-3" />
          </button>
        )}
      </div>
      {childPageIds.length === 0 ? (
        <p className="mt-2 text-13 font-medium text-placeholder">
          {t("page_navigation_pane.tabs.info.sub_pages.empty")}
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {childPageIds.map((childId) => {
            const childPage = getPageById(childId);
            if (!childPage) return null;
            return (
              <Link
                key={childId}
                href={childPage.getRedirectionLink()}
                className="flex items-center gap-1.5 text-13 font-medium text-secondary hover:text-primary"
              >
                <PageIcon className="size-3.5 flex-shrink-0 text-tertiary" />
                <span className="truncate">{getPageName(childPage.name)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});
