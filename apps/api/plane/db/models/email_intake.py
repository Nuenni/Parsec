# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from .project import ProjectBaseModel


class EmailIntakeConfig(ProjectBaseModel):
    """Per-project IMAP/SMTP config for polling a support mailbox and replying to it.

    Passwords are stored Fernet-encrypted (see plane.license.utils.encryption) and are
    never returned by the API once set - the settings UI only shows whether one is
    configured, never the value.
    """

    email_address = models.EmailField()
    imap_host = models.CharField(max_length=255)
    imap_port = models.PositiveIntegerField(default=993)
    imap_username = models.CharField(max_length=255)
    imap_password = models.TextField(blank=True)
    imap_use_ssl = models.BooleanField(default=True)
    # IMAP mailbox/folder to poll. Defaults to INBOX, but a mailbox shared via an alias
    # (e.g. a Fastmail alias landing in the same inbox as personal mail) needs a
    # dedicated folder - set up a server-side filter rule to move alias mail there,
    # then point this at that folder name.
    imap_folder = models.CharField(max_length=255, default="INBOX")
    smtp_host = models.CharField(max_length=255)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_username = models.CharField(max_length=255)
    smtp_password = models.TextField(blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    from_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    last_polled_at = models.DateTimeField(null=True, blank=True)

    # Optional raw HTML override for outbound emails. Supports {{ heading }}, {{ body }},
    # {{ brand_name }}, {{ signature }} placeholders. Falls back to the built-in template
    # when blank.
    html_template = models.TextField(blank=True)
    signature_html = models.TextField(blank=True)

    # Optional state automation: which state to move an issue to when the customer
    # replies by email, and when a team member replies externally from Parsec. Reuses
    # this project's own states rather than introducing a separate status concept.
    state_on_customer_reply = models.ForeignKey(
        "db.State", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    state_on_agent_reply = models.ForeignKey(
        "db.State", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name = "Email Intake Config"
        verbose_name_plural = "Email Intake Configs"
        db_table = "email_intake_configs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.email_address} -> {self.project_id}"


class EmailIssueLink(ProjectBaseModel):
    """Tracks the email thread (requester + Message-IDs) behind an email-sourced issue."""

    issue = models.OneToOneField(
        "db.Issue", on_delete=models.CASCADE, related_name="email_link"
    )
    requester_email = models.EmailField()
    requester_name = models.CharField(max_length=255, blank=True)
    # every Message-ID seen in this thread (inbound and outbound), used to build the
    # References header on replies and to match a later inbound reply back to this issue
    message_ids = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "Email Issue Link"
        verbose_name_plural = "Email Issue Links"
        db_table = "email_issue_links"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.requester_email} -> {self.issue_id}"
