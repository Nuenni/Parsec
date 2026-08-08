/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { GitCommitHorizontal } from "lucide-react";
import type { TGithubCommitLink } from "@plane/types";

type Props = {
  commit: TGithubCommitLink;
};

export function GithubCommitChip(props: Props) {
  const { commit } = props;
  const firstLine = commit.message.split("\n")[0];

  return (
    <a
      href={commit.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md bg-surface-2 p-2.5 hover:bg-layer-1"
    >
      <GitCommitHorizontal className="size-3.5 flex-shrink-0 text-tertiary" />
      <span className="min-w-0 flex-1 truncate text-13">{firstLine}</span>
      {commit.author_name && <span className="flex-shrink-0 text-11 text-tertiary">{commit.author_name}</span>}
      <span className="flex-shrink-0 rounded-sm bg-layer-2 px-1 py-0.5 text-11 text-tertiary">
        {commit.sha.slice(0, 7)}
      </span>
    </a>
  );
}
