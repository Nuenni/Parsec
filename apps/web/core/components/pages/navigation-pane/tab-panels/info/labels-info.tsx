/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { LabelDropdown } from "@/components/issues/issue-layouts/properties/label-dropdown";
// hooks
import { useLabel } from "@/hooks/store/use-label";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  page: TPageInstance;
  disabled?: boolean;
};

const PageLabelChip = observer(function PageLabelChip(props: { labelId: string }) {
  const { getLabelById } = useLabel();
  const label = getLabelById(props.labelId);
  if (!label) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-layer-2 px-2 py-0.5 text-caption-sm-medium">
      <span className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
    </span>
  );
});

export const PageNavigationPaneInfoTabLabelsInfo = observer(function PageNavigationPaneInfoTabLabelsInfo(props: Props) {
  const { page, disabled = false } = props;
  // translation
  const { t } = useTranslation();
  // derived values
  const labelIds = page.label_ids ?? [];
  const projectId = page.project_ids?.[0];

  if (!projectId) return null;

  const handleChange = (ids: string[]) => {
    page.update({ labels: ids, label_ids: ids });
  };

  return (
    <div className="mt-4">
      <p className="text-11 font-medium text-tertiary">{t("common.labels")}</p>
      <div className="mt-2">
        <LabelDropdown
          projectId={projectId}
          value={labelIds}
          onChange={handleChange}
          disabled={disabled}
          fullWidth
          renderByDefault
          label={
            <div className="flex min-h-5 w-full flex-wrap items-center gap-1.5 text-left">
              {labelIds.length === 0 ? (
                <span className="text-13 font-medium text-placeholder">{t("common.none")}</span>
              ) : (
                labelIds.map((labelId) => <PageLabelChip key={labelId} labelId={labelId} />)
              )}
            </div>
          }
        />
      </div>
    </div>
  );
});
