# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import secrets

# Django imports
from django.db import models

# Module imports
from .project import ProjectBaseModel


def _generate_webhook_token():
    return secrets.token_urlsafe(32)


class WebhookIntakeSource(models.TextChoices):
    USERBACK = "USERBACK", "Userback"


class WebhookIntakeConfig(ProjectBaseModel):
    """Per-project config for an inbound webhook from a third-party feedback/support tool.

    Named generically (not "Userback...") since the receiving endpoint and bot-user
    pattern are meant to be reused for other inbound-webhook sources later - only the
    payload parsing in the endpoint is source-specific. The URL is the only credential
    (Userback doesn't sign its webhook requests), so `webhook_token` must stay
    unguessable and is never shown again once rotated.
    """

    source = models.CharField(max_length=30, choices=WebhookIntakeSource.choices, default=WebhookIntakeSource.USERBACK)
    webhook_token = models.CharField(max_length=64, unique=True, default=_generate_webhook_token)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Webhook Intake Config"
        verbose_name_plural = "Webhook Intake Configs"
        db_table = "webhook_intake_configs"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=["project", "source"], name="unique_webhook_intake_source_per_project")
        ]

    def __str__(self):
        return f"{self.source} -> {self.project_id}"


class WebhookFeedbackLink(ProjectBaseModel):
    """Tracks the external feedback item (and its comments) behind a webhook-sourced issue."""

    issue = models.OneToOneField(
        "db.Issue", on_delete=models.CASCADE, related_name="webhook_feedback_link"
    )
    source = models.CharField(max_length=30, choices=WebhookIntakeSource.choices, default=WebhookIntakeSource.USERBACK)
    external_feedback_id = models.CharField(max_length=255)
    # {external_comment_id: plane_comment_id}, so a later comment.update/comment.remove
    # event can find the comment it should edit/delete instead of creating a duplicate.
    external_comment_ids = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Webhook Feedback Link"
        verbose_name_plural = "Webhook Feedback Links"
        db_table = "webhook_feedback_links"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["project", "source", "external_feedback_id"],
                name="unique_webhook_feedback_link_per_source",
            )
        ]

    def __str__(self):
        return f"{self.source}:{self.external_feedback_id} -> {self.issue_id}"
