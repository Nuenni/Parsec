# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseViewSet
from plane.app.permissions import allow_permission, ProjectBasePermission, ROLE
from plane.app.serializers import WebhookIntakeConfigSerializer
from plane.db.models import WebhookIntakeConfig, WebhookIntakeSource
from plane.db.models.webhook_intake import _generate_webhook_token
from rest_framework.response import Response
from rest_framework import status


class WebhookIntakeConfigViewSet(BaseViewSet):
    """Admin-managed inbound-webhook config for a project (e.g. Userback feedback intake).

    One config per (project, source) - see WebhookIntakeConfig's unique constraint.
    The webhook_token is generated server-side and only ever read, never written by a
    client; rotating it is a dedicated action rather than a field update, since the old
    URL must stop working the moment a new one is issued.
    """

    serializer_class = WebhookIntakeConfigSerializer
    model = WebhookIntakeConfig
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
    def create(self, request, slug, project_id):
        source = request.data.get("source", WebhookIntakeSource.USERBACK)
        # all_objects, not objects: a soft-deleted config still holds the
        # (project, source) unique constraint, so treating it as "no existing record"
        # here would hit an IntegrityError trying to insert a second row instead of
        # restoring the old one (same class of bug fixed for EmailIssueLink in #22).
        existing = WebhookIntakeConfig.all_objects.filter(project_id=project_id, source=source).first()
        if existing is not None:
            if existing.deleted_at is not None:
                existing.deleted_at = None
                existing.is_active = True
                existing.save(update_fields=["deleted_at", "is_active"])
            return Response(WebhookIntakeConfigSerializer(existing).data, status=status.HTTP_200_OK)

        config = WebhookIntakeConfig.objects.create(project_id=project_id, source=source)
        return Response(WebhookIntakeConfigSerializer(config).data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WebhookIntakeConfigSerializer(instance=instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def rotate_token(self, request, slug, project_id, pk):
        instance = self.get_object()
        instance.webhook_token = _generate_webhook_token()
        instance.save(update_fields=["webhook_token"])
        return Response(WebhookIntakeConfigSerializer(instance).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
