/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tooltip } from "@plane/propel/tooltip";
// hooks
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  labelIds: string[] | undefined;
  maxRender?: number;
};

export const PageLabelChips = observer(function PageLabelChips(props: Props) {
  const { labelIds, maxRender = 2 } = props;
  const { getLabelById } = useLabel();

  if (!labelIds || labelIds.length === 0) return null;

  const visibleIds = labelIds.slice(0, maxRender);
  const overflowCount = labelIds.length - visibleIds.length;

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
      {visibleIds.map((labelId) => {
        const label = getLabelById(labelId);
        if (!label) return null;
        return (
          <Tooltip key={labelId} tooltipContent={label.name} position="top">
            <span className="flex max-w-[120px] items-center gap-1.5 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-caption-sm-regular text-secondary">
              <span className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
              <span className="truncate">{label.name}</span>
            </span>
          </Tooltip>
        );
      })}
      {overflowCount > 0 && (
        <span className="rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-caption-sm-regular text-secondary">
          +{overflowCount}
        </span>
      )}
    </div>
  );
});
