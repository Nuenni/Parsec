# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import hashlib
import hmac

# Django imports
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

# Third party imports
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# Module imports
from ..base import BaseAPIView
from plane.db.models import GithubProjectLink
from plane.bgtasks.github_sync_task import (
    sync_pull_request_from_github,
    sync_check_status_from_github,
    sync_issue_from_github,
    sync_issue_comment_from_github,
    sync_issue_field_from_github,
    sync_pr_review_from_github,
    sync_commits_from_github,
)


def _verify_github_signature(secret, body, signature_header):
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@method_decorator(csrf_exempt, name="dispatch")
class GithubWebhookEndpoint(BaseAPIView):
    """Receives GitHub webhook deliveries for a single repository<->project link."""

    permission_classes = [AllowAny]

    def post(self, request, link_id):
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True).first()
        if link is None:
            return Response({"error": "Unknown webhook"}, status=status.HTTP_404_NOT_FOUND)

        signature = request.headers.get("X-Hub-Signature-256")
        if not _verify_github_signature(link.webhook_secret, request.body, signature):
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        link.last_webhook_received_at = timezone.now()
        link.save(update_fields=["last_webhook_received_at"])

        event = request.headers.get("X-GitHub-Event")
        payload = request.data

        if event == "pull_request":
            sync_pull_request_from_github.delay(link_id=str(link.id), payload=payload)
        elif event in ("check_suite", "check_run"):
            sync_check_status_from_github.delay(link_id=str(link.id), event=event, payload=payload)
        elif event == "issues" and payload.get("action") in ("field_added", "field_removed") and link.sync_issues:
            sync_issue_field_from_github.delay(link_id=str(link.id), payload=payload)
        elif event == "issues" and link.sync_issues:
            sync_issue_from_github.delay(link_id=str(link.id), payload=payload)
        elif event == "issue_comment" and link.sync_issues:
            sync_issue_comment_from_github.delay(link_id=str(link.id), payload=payload)
        elif event == "pull_request_review":
            sync_pr_review_from_github.delay(link_id=str(link.id), payload=payload)
        elif event == "push":
            sync_commits_from_github.delay(link_id=str(link.id), payload=payload)
        # Other events (ping, ...) are acknowledged but ignored.

        return Response(status=status.HTTP_204_NO_CONTENT)
