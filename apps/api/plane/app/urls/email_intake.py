# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import EmailIntakeConfigViewSet, IssueEmailLinkEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/email-intake-configs/",
        EmailIntakeConfigViewSet.as_view({"get": "list", "post": "create"}),
        name="project-email-intake-configs",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/email-intake-configs/<uuid:pk>/",
        EmailIntakeConfigViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-email-intake-config-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/email-intake-configs/list-imap-folders/",
        EmailIntakeConfigViewSet.as_view({"post": "list_imap_folders_action"}),
        name="project-email-intake-list-imap-folders",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/email-link/",
        IssueEmailLinkEndpoint.as_view(),
        name="issue-email-link",
    ),
]
