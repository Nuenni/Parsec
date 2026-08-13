# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.db.models import EmailIssueLink

from .base import BaseSerializer


class EmailIssueLinkSerializer(BaseSerializer):
    """Full serializer for an issue's email thread link."""

    class Meta:
        model = EmailIssueLink
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class EmailIssueLinkCreateSerializer(BaseSerializer):
    """Serializer for linking an existing work item to an email thread.

    Used by external callers (e.g. a website contact form that files an
    issue over the plain REST API) that have no IMAP-sourced Message-ID yet
    - `message_ids` defaults to empty and fills in once a real reply comes
    back through the email intake pipeline.
    """

    class Meta:
        model = EmailIssueLink
        fields = ["requester_email", "requester_name"]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "message_ids",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
