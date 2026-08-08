/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import type { E_SORT_ORDER, TActivityFilters, EActivityFilterType } from "@plane/constants";
import { BASE_ACTIVITY_FILTER_TYPES, filterActivityOnSelectedFilters } from "@plane/constants";
import type { TCommentsOperations } from "@plane/types";
// components
import { CommentCard } from "@/components/comments/card/root";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueActivityItem } from "./activity/activity-list";
import { IssueActivityLoader } from "./loader";

type TIssueActivityCommentRoot = {
  workspaceSlug: string;
  projectId: string;
  isIntakeIssue: boolean;
  issueId: string;
  selectedFilters: TActivityFilters[];
  activityOperations: TCommentsOperations;
  showAccessSpecifier?: boolean;
  disabled?: boolean;
  sortOrder: E_SORT_ORDER;
};

export const IssueActivityCommentRoot = observer(function IssueActivityCommentRoot(props: TIssueActivityCommentRoot) {
  const {
    workspaceSlug,
    isIntakeIssue,
    issueId,
    selectedFilters,
    activityOperations,
    showAccessSpecifier,
    projectId,
    disabled,
    sortOrder,
  } = props;
  // store hooks
  const {
    activity: { getActivityAndCommentsByIssueId },
    comment: { getCommentById },
  } = useIssueDetail();
  // derived values
  const activityAndComments = getActivityAndCommentsByIssueId(issueId, sortOrder);

  if (!activityAndComments) return <IssueActivityLoader />;

  if (activityAndComments.length <= 0) return null;

  const filteredActivityAndComments = filterActivityOnSelectedFilters(activityAndComments, selectedFilters);

  // Replies are comments with a `parent` set. Group them under their parent instead
  // of rendering them at their own position in the flat chronological feed.
  const repliesByParentId: Record<string, ReturnType<typeof getCommentById>[]> = {};
  filteredActivityAndComments.forEach((activityComment) => {
    if (activityComment.activity_type !== "COMMENT") return;
    const comment = getCommentById(activityComment.id);
    if (!comment || !comment.parent) return;
    (repliesByParentId[comment.parent] ??= []).push(comment);
  });
  Object.values(repliesByParentId).forEach((replies) =>
    replies.sort((a, b) => new Date(a?.created_at ?? 0).getTime() - new Date(b?.created_at ?? 0).getTime())
  );

  return (
    <div>
      {filteredActivityAndComments.map((activityComment, index) => {
        const comment = getCommentById(activityComment.id);
        // rendered nested under its parent instead, skip at the top level
        if (activityComment.activity_type === "COMMENT" && comment?.parent) return null;
        const ends = index === 0 ? "top" : index === filteredActivityAndComments.length - 1 ? "bottom" : undefined;
        return activityComment.activity_type === "COMMENT" ? (
          <div key={activityComment.id}>
            <CommentCard
              workspaceSlug={workspaceSlug}
              entityId={issueId}
              comment={comment}
              activityOperations={activityOperations}
              ends={ends}
              showAccessSpecifier={!!showAccessSpecifier}
              showCopyLinkOption={!isIntakeIssue}
              disabled={disabled}
              projectId={projectId}
              enableReplies
            />
            {repliesByParentId[activityComment.id]?.map((reply) => (
              <CommentCard
                key={reply?.id}
                workspaceSlug={workspaceSlug}
                entityId={issueId}
                comment={reply}
                activityOperations={activityOperations}
                ends={undefined}
                showAccessSpecifier={!!showAccessSpecifier}
                showCopyLinkOption={!isIntakeIssue}
                disabled={disabled}
                projectId={projectId}
                enableReplies
                isReply
              />
            ))}
          </div>
        ) : BASE_ACTIVITY_FILTER_TYPES.includes(activityComment.activity_type as EActivityFilterType) ? (
          <IssueActivityItem key={activityComment.id} activityId={activityComment.id} ends={ends} />
        ) : null;
      })}
    </div>
  );
});
