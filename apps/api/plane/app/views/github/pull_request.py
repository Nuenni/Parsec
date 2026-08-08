# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission, allow_permission, ROLE
from plane.app.serializers import GithubPullRequestLinkSerializer
from plane.db.models import GithubPullRequestLink
from rest_framework.response import Response
from rest_framework import status


class IssueGithubPullRequestsEndpoint(BaseAPIView):
    """Pull requests linked to an issue via GitHub webhook sync (read + unlink)."""

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        pull_requests = GithubPullRequestLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).order_by("-created_at")
        serializer = GithubPullRequestLinkSerializer(pull_requests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, issue_id, pk):
        pull_request = GithubPullRequestLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id, pk=pk
        ).first()
        if pull_request is None:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        # Hard delete: repository_full_name+pr_number is unique, so a soft-deleted row
        # would permanently block this PR from ever being (re-)linked by a later webhook.
        pull_request.delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)
