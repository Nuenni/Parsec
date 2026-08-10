# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.urls import reverse

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import GithubCommitLink, GithubProjectLink, GithubPullRequestLink


class GithubPullRequestLinkSerializer(BaseSerializer):
    class Meta:
        model = GithubPullRequestLink
        fields = [
            "id",
            "issue",
            "repository_full_name",
            "pr_number",
            "pr_url",
            "title",
            "state",
            "is_draft",
            "checks_status",
            "head_branch",
            "merged_at",
            "reviewers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class GithubCommitLinkSerializer(BaseSerializer):
    class Meta:
        model = GithubCommitLink
        fields = [
            "id",
            "issue",
            "repository_full_name",
            "sha",
            "message",
            "url",
            "author_name",
            "authored_at",
            "created_at",
        ]
        read_only_fields = fields


class GithubProjectLinkSerializer(BaseSerializer):
    webhook_url = serializers.SerializerMethodField()

    class Meta:
        model = GithubProjectLink
        fields = [
            "id",
            "project",
            "repository_full_name",
            "sync_issues",
            "is_active",
            "webhook_secret",
            "webhook_url",
            "last_webhook_received_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "webhook_secret",
            "webhook_url",
            "last_webhook_received_at",
            "created_at",
        ]

    def get_webhook_url(self, obj):
        request = self.context.get("request")
        if request is None or obj.pk is None:
            return None
        path = reverse("github-webhook", kwargs={"link_id": obj.pk})
        return request.build_absolute_uri(path)
