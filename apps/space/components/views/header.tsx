/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Link } from "react-router";
import parsecMark from "@/app/assets/images/parsec-mark.svg?url";

export function AuthHeader() {
  return (
    <div className="sticky top-0 flex w-full flex-shrink-0 items-center justify-between gap-6">
      <Link to="/" className="flex items-center gap-2">
        <img src={parsecMark} alt="Parsec" height={20} width={20} />
        <span className="text-body-sm-semibold text-primary">Parsec</span>
      </Link>
    </div>
  );
}
