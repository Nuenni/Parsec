# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Fork-specific addition, not part of upstream Plane."""

from django.urls import path

from plane.api.views import EmailIssueLinkAPIEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/email-link/",
        EmailIssueLinkAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-email-link",
    ),
]
