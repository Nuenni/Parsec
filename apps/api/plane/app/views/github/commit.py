# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.app.serializers import GithubCommitLinkSerializer
from plane.db.models import GithubCommitLink
from rest_framework.response import Response
from rest_framework import status


class IssueGithubCommitsEndpoint(BaseAPIView):
    """Read-only: commits linked to an issue via a GitHub push webhook."""

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        commits = GithubCommitLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).order_by("-authored_at")
        serializer = GithubCommitLinkSerializer(commits, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
