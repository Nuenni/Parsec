# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError

# Module imports
from .base import BaseAPIView, BaseViewSet
from plane.app.permissions import allow_permission, ProjectBasePermission, ProjectEntityPermission, ROLE
from plane.app.serializers import EmailIntakeConfigSerializer, EmailIssueLinkCreateSerializer
from plane.bgtasks.email_intake_task import list_imap_folders, test_imap_connection, test_smtp_connection
from plane.db.models import EmailIntakeConfig, EmailIssueLink, Issue
from plane.license.utils.encryption import decrypt_data
from rest_framework.response import Response
from rest_framework import status


class EmailIntakeConfigViewSet(BaseViewSet):
    """Admin-managed IMAP/SMTP config for a project's support mailbox."""

    serializer_class = EmailIntakeConfigSerializer
    model = EmailIntakeConfig
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
        data = request.data
        imap_error = test_imap_connection(
            data.get("imap_host"),
            data.get("imap_port", 993),
            data.get("imap_username"),
            data.get("imap_password"),
            data.get("imap_use_ssl", True),
            data.get("imap_folder", "INBOX"),
        )
        if imap_error:
            return Response({"imap_password": f"Could not connect to IMAP: {imap_error}"}, status=status.HTTP_400_BAD_REQUEST)
        smtp_error = test_smtp_connection(
            data.get("smtp_host"),
            data.get("smtp_port", 587),
            data.get("smtp_username"),
            data.get("smtp_password"),
            data.get("smtp_use_tls", True),
        )
        if smtp_error:
            return Response({"smtp_password": f"Could not connect to SMTP: {smtp_error}"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = EmailIntakeConfigSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data

        connection_fields_touched = any(
            field in data
            for field in ["imap_host", "imap_port", "imap_username", "imap_password", "imap_use_ssl", "imap_folder"]
        )
        if connection_fields_touched:
            imap_password = data.get("imap_password") or decrypt_data(instance.imap_password)
            imap_error = test_imap_connection(
                data.get("imap_host", instance.imap_host),
                data.get("imap_port", instance.imap_port),
                data.get("imap_username", instance.imap_username),
                imap_password,
                data.get("imap_use_ssl", instance.imap_use_ssl),
                data.get("imap_folder", instance.imap_folder),
            )
            if imap_error:
                return Response(
                    {"imap_password": f"Could not connect to IMAP: {imap_error}"}, status=status.HTTP_400_BAD_REQUEST
                )

        connection_fields_touched = any(
            field in data
            for field in ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_use_tls"]
        )
        if connection_fields_touched:
            smtp_password = data.get("smtp_password") or decrypt_data(instance.smtp_password)
            smtp_error = test_smtp_connection(
                data.get("smtp_host", instance.smtp_host),
                data.get("smtp_port", instance.smtp_port),
                data.get("smtp_username", instance.smtp_username),
                smtp_password,
                data.get("smtp_use_tls", instance.smtp_use_tls),
            )
            if smtp_error:
                return Response(
                    {"smtp_password": f"Could not connect to SMTP: {smtp_error}"}, status=status.HTTP_400_BAD_REQUEST
                )

        serializer = EmailIntakeConfigSerializer(instance=instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN])
    def list_imap_folders_action(self, request, slug, project_id):
        data = request.data
        password = data.get("imap_password")
        config_id = data.get("id")
        if not password and config_id:
            instance = EmailIntakeConfig.objects.filter(pk=config_id, project_id=project_id).first()
            if instance is not None:
                password = decrypt_data(instance.imap_password)
        folders, error = list_imap_folders(
            data.get("imap_host"),
            data.get("imap_port", 993),
            data.get("imap_username"),
            password,
            data.get("imap_use_ssl", True),
        )
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"folders": folders}, status=status.HTTP_200_OK)


class IssueEmailLinkEndpoint(BaseAPIView):
    """Whether an issue originated from (or is linked to) an email thread.

    GET is read-only. POST is update-or-create so a logged-in user can fill
    in (or correct) the requester email/name from the issue properties
    sidebar for a work item that didn't arrive through the email intake
    pipeline - unlike EmailIssueLinkAPIEndpoint's get-or-create, a second
    POST here is expected to overwrite the previous value rather than be a
    no-op retry.
    """

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        link = EmailIssueLink.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).first()
        if link is None:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "id": str(link.id),
                "requester_email": link.requester_email,
                "requester_name": link.requester_name,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, slug, project_id, issue_id):
        issue = Issue.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=issue_id
        ).first()
        if issue is None:
            return Response({"error": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        # all_objects, not objects: a soft-deleted EmailIssueLink still holds the
        # OneToOneField's unique DB constraint, so treating it as "no existing
        # record" here would hit an IntegrityError trying to insert a second row
        # for the same issue instead of restoring and updating the old one.
        existing = EmailIssueLink.all_objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).first()

        serializer = EmailIssueLinkCreateSerializer(
            instance=existing, data=request.data, partial=existing is not None
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            if existing is not None:
                serializer.save(deleted_at=None)
            else:
                serializer.save(issue=issue, project_id=project_id)
        except IntegrityError:
            # Lost a race against a concurrent create for the same issue - the
            # other one won, so return it rather than erroring out a retry.
            existing = EmailIssueLink.all_objects.get(issue_id=issue_id)
            return Response(
                {
                    "id": str(existing.id),
                    "requester_email": existing.requester_email,
                    "requester_name": existing.requester_name,
                },
                status=status.HTTP_200_OK,
            )

        link = serializer.instance
        return Response(
            {
                "id": str(link.id),
                "requester_email": link.requester_email,
                "requester_name": link.requester_name,
            },
            status=status.HTTP_200_OK if existing is not None else status.HTTP_201_CREATED,
        )
