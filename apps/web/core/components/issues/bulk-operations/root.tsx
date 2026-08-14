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
import { X } from "lucide-react";
import { Command as CommandIcon } from "lucide-react";
// hooks
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { BulkOperationsStatusMenu } from "./status-menu";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

type TPage = "root" | "status";

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { selectionHelpers } = props;
  // store hooks
  const { isSelectionActive, selectedEntityIds } = useMultipleSelectStore();
  // states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [page, setPage] = useState<TPage>("root");

  if (!isSelectionActive || selectionHelpers.isSelectionDisabled) return null;

  const closeMenu = () => {
    setIsMenuOpen(false);
    setTimeout(() => setPage("root"), 200);
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
                    if (page === "status") setPage("root");
                    else closeMenu();
                  }
                }}
              >
                <Command.List className="vertical-scrollbar scrollbar-sm max-h-72 overflow-scroll p-1 outline-none">
                  {page === "root" && (
                    <Command.Group>
                      <PowerKModalCommandItem label="Change status..." onSelect={() => setPage("status")} />
                    </Command.Group>
                  )}
                  {page === "status" && <BulkOperationsStatusMenu issueIds={selectedEntityIds} onClose={closeMenu} />}
                </Command.List>
              </Command>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
