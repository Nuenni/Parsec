# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError

# Module imports
from .. import BaseViewSet
from plane.app.permissions import allow_permission, ProjectBasePermission, ROLE
from plane.app.serializers import GithubProjectLinkSerializer
from plane.db.models import GithubProjectLink
from rest_framework.response import Response
from rest_framework import status


class GithubProjectLinkViewSet(BaseViewSet):
    """Admin-managed mapping of a GitHub repository to this project (webhook target)."""

    serializer_class = GithubProjectLinkSerializer
    model = GithubProjectLink
    permission_classes = [ProjectBasePermission]

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .order_by("-created_at")
        )

    @allow_permission([ROLE.ADMIN])
    def list(self, request, *args, **kwargs):
        # webhook_secret is returned in full below - restrict to admins, mirroring
        # the pre-existing Webhook feature's admin-only visibility of its secret.
        return super().list(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        try:
            serializer = GithubProjectLinkSerializer(
                data=request.data, context={"request": request}
            )
            if serializer.is_valid():
                serializer.save(project_id=project_id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "This repository is already linked to a project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, *args, **kwargs):
        serializer = GithubProjectLinkSerializer(
            instance=self.get_object(),
            data=request.data,
            context={"request": request},
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
