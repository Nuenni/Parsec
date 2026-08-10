# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from uuid import uuid4

# Django imports
from django.db import models

# Module imports
from .project import ProjectBaseModel


def generate_github_webhook_secret():
    return "gh_wh_" + uuid4().hex


class GithubProjectLink(ProjectBaseModel):
    """Maps a GitHub repository to a Plane project for PR-linking and/or issue sync."""

    repository_full_name = models.CharField(max_length=255, unique=True)
    webhook_secret = models.CharField(max_length=255, default=generate_github_webhook_secret)
    # False = PR status linking only, True = full bidirectional issue sync
    sync_issues = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # Timestamp of the last successfully signature-verified webhook delivery from GitHub.
    # Drives the connection health indicator in the settings UI - null means no delivery
    # has ever been received (webhook likely not added on the GitHub side yet).
    last_webhook_received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Github Project Link"
        verbose_name_plural = "Github Project Links"
        db_table = "github_project_links"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.repository_full_name} -> {self.project_id}"


class GithubPullRequestLink(ProjectBaseModel):
    """A GitHub pull request matched to a Plane issue by branch/title/body reference."""

    class State(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        MERGED = "merged", "Merged"

    class ChecksStatus(models.TextChoices):
        NONE = "none", "None"
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="github_pull_requests"
    )
    repository_full_name = models.CharField(max_length=255)
    pr_number = models.PositiveIntegerField()
    pr_url = models.URLField(max_length=800)
    title = models.TextField()
    state = models.CharField(max_length=20, choices=State.choices, default=State.OPEN)
    is_draft = models.BooleanField(default=False)
    checks_status = models.CharField(max_length=20, choices=ChecksStatus.choices, default=ChecksStatus.NONE)
    head_branch = models.CharField(max_length=500, blank=True)
    head_sha = models.CharField(max_length=64, blank=True, db_index=True)
    merged_at = models.DateTimeField(null=True, blank=True)
    # [{"login": "octocat", "state": "approved" | "changes_requested" | "commented" | "dismissed"}, ...]
    reviewers = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "Github Pull Request Link"
        verbose_name_plural = "Github Pull Request Links"
        db_table = "github_pull_request_links"
        unique_together = ["repository_full_name", "pr_number"]
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.repository_full_name}#{self.pr_number} -> {self.issue_id}"


class GithubCommitLink(ProjectBaseModel):
    """A GitHub commit (from a push event) matched to a Plane issue by its message."""

    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="github_commits"
    )
    repository_full_name = models.CharField(max_length=255)
    sha = models.CharField(max_length=40, db_index=True)
    message = models.TextField()
    url = models.URLField(max_length=800)
    author_name = models.CharField(max_length=255, blank=True)
    authored_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Github Commit Link"
        verbose_name_plural = "Github Commit Links"
        db_table = "github_commit_links"
        unique_together = ["repository_full_name", "sha", "issue"]
        ordering = ("-authored_at",)

    def __str__(self):
        return f"{self.repository_full_name}@{self.sha[:7]} -> {self.issue_id}"
