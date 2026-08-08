/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TGithubPullRequestState = "open" | "closed" | "merged";

export type TGithubChecksStatus = "none" | "pending" | "success" | "failure";

export type TGithubReviewState = "approved" | "changes_requested" | "commented" | "dismissed";

export type TGithubReviewer = {
  login: string;
  state: TGithubReviewState;
};

export type TGithubPullRequestLink = {
  id: string;
  issue: string;
  repository_full_name: string;
  pr_number: number;
  pr_url: string;
  title: string;
  state: TGithubPullRequestState;
  is_draft: boolean;
  checks_status: TGithubChecksStatus;
  head_branch: string;
  merged_at: string | null;
  reviewers: TGithubReviewer[];
  created_at: string;
  updated_at: string;
};
