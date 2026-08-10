/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";

export function AuthFooter() {
  return (
    <div className="flex flex-col items-center gap-6">
      <span className="text-13 whitespace-nowrap text-tertiary">
        Forked from{" "}
        <a
          href="https://github.com/makeplane/plane"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-secondary"
        >
          Plane
        </a>{" "}
        - modified for our needs by NAFDO.
      </span>
    </div>
  );
}
