# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    GithubWebhookEndpoint,
    IssueGithubPullRequestsEndpoint,
    IssueGithubCommitsEndpoint,
    GithubProjectLinkViewSet,
    IssueGithubSyncStatusEndpoint,
)

urlpatterns = [
    path(
        "github/webhook/<uuid:link_id>/",
        GithubWebhookEndpoint.as_view(),
        name="github-webhook",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/github-prs/",
        IssueGithubPullRequestsEndpoint.as_view(),
        name="issue-github-pull-requests",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/github-prs/<uuid:pk>/",
        IssueGithubPullRequestsEndpoint.as_view(),
        name="issue-github-pull-request-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/github-commits/",
        IssueGithubCommitsEndpoint.as_view(),
        name="issue-github-commits",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/github-sync-status/",
        IssueGithubSyncStatusEndpoint.as_view(),
        name="issue-github-sync-status",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/github-links/",
        GithubProjectLinkViewSet.as_view({"get": "list", "post": "create"}),
        name="project-github-links",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/github-links/<uuid:pk>/",
        GithubProjectLinkViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-github-link-detail",
    ),
]
