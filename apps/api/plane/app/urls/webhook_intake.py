# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import WebhookIntakeConfigViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/webhook-intake-configs/",
        WebhookIntakeConfigViewSet.as_view({"get": "list", "post": "create"}),
        name="project-webhook-intake-configs",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/webhook-intake-configs/<uuid:pk>/",
        WebhookIntakeConfigViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-webhook-intake-config-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/webhook-intake-configs/<uuid:pk>/rotate-token/",
        WebhookIntakeConfigViewSet.as_view({"post": "rotate_token"}),
        name="project-webhook-intake-config-rotate-token",
    ),
]
