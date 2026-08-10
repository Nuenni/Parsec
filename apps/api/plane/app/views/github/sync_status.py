# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import GithubProjectLink, Issue
from rest_framework.response import Response
from rest_framework import status


class IssueGithubSyncStatusEndpoint(BaseAPIView):
    """Whether an issue is actively comment-synced with GitHub - true only for issues
    that originated from a GitHub webhook (external_source="github") on a project whose
    GithubProjectLink still has sync_issues enabled. Drives the internal/external
    comment toggle, mirroring the same toggle for email-linked issues.
    """

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        issue = Issue.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=issue_id
        ).first()
        if issue is None or issue.external_source != "github":
            return Response({"synced": False}, status=status.HTTP_200_OK)
        repository_full_name, _, _ = (issue.external_id or "").rpartition("#")
        is_linked = GithubProjectLink.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            repository_full_name=repository_full_name,
            is_active=True,
            sync_issues=True,
        ).exists()
        return Response({"synced": is_linked}, status=status.HTTP_200_OK)
