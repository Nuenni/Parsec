# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""API-key authenticated counterpart to app/views/email_intake.py's
IssueEmailLinkEndpoint, which is session-only and therefore unreachable for
external callers (e.g. a website contact form filing a work item over the
plain REST API with X-Api-Key).

Fork-specific addition, absent from the upstream project this was forked from.
"""

# Django imports
from django.db import IntegrityError

# Third party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from plane.api.serializers import EmailIssueLinkCreateSerializer, EmailIssueLinkSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import EmailIssueLink, Issue

from .base import BaseAPIView


class EmailIssueLinkAPIEndpoint(BaseAPIView):
    """Get or create the email-thread link for a work item.

    A work item has at most one link (`EmailIssueLink.issue` is a
    OneToOneField), so POST is get-or-create rather than a plain create -
    a caller retrying after a timeout must not end up with a second link or
    a 400.
    """

    serializer_class = EmailIssueLinkSerializer
    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        link = EmailIssueLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).first()
        if link is None:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(EmailIssueLinkSerializer(link).data, status=status.HTTP_200_OK)

    def post(self, request, slug, project_id, issue_id):
        existing = EmailIssueLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).first()
        if existing is not None:
            return Response(EmailIssueLinkSerializer(existing).data, status=status.HTTP_200_OK)

        issue = Issue.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=issue_id
        ).first()
        if issue is None:
            return Response({"error": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmailIssueLinkCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save(issue=issue, project_id=project_id)
        except IntegrityError:
            # Lost a race against a concurrent create for the same issue - the
            # other one won, so return it rather than erroring out a retry.
            existing = EmailIssueLink.objects.get(issue_id=issue_id)
            return Response(EmailIssueLinkSerializer(existing).data, status=status.HTTP_200_OK)
        return Response(EmailIssueLinkSerializer(serializer.instance).data, status=status.HTTP_201_CREATED)
