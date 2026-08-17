# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import EmailIntakeConfig, EmailIssueLink
from plane.license.utils.encryption import encrypt_data

# from_name is combined with email_address into "Name <email>" when sending (see
# email_intake_task._send_threaded_email). If the address is pasted into this field
# too - e.g. "Support <support@x.com>" - that combination doubles up into an
# unparseable header, so strip any trailing "<...>" the user already included.
TRAILING_ANGLE_ADDRESS_RE = re.compile(r"\s*<[^<>]*>\s*$")


class EmailIntakeConfigSerializer(BaseSerializer):
    # Write-only: accepted on create/update, never stored as plaintext, never read back.
    imap_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    imap_password_set = serializers.SerializerMethodField()
    smtp_password_set = serializers.SerializerMethodField()

    class Meta:
        model = EmailIntakeConfig
        fields = [
            "id",
            "project",
            "email_address",
            "imap_host",
            "imap_port",
            "imap_username",
            "imap_password",
            "imap_password_set",
            "imap_use_ssl",
            "imap_folder",
            "smtp_host",
            "smtp_port",
            "smtp_username",
            "smtp_password",
            "smtp_password_set",
            "smtp_use_tls",
            "from_name",
            "is_active",
            "last_polled_at",
            "created_at",
            "html_template",
            "signature_html",
            "state_on_customer_reply",
            "state_on_agent_reply",
        ]
        read_only_fields = ["id", "project", "last_polled_at", "created_at"]

    def validate_from_name(self, value):
        return TRAILING_ANGLE_ADDRESS_RE.sub("", value).strip()

    def get_imap_password_set(self, obj):
        return bool(obj.imap_password)

    def get_smtp_password_set(self, obj):
        return bool(obj.smtp_password)

    def create(self, validated_data):
        validated_data["imap_password"] = encrypt_data(validated_data.get("imap_password", ""))
        validated_data["smtp_password"] = encrypt_data(validated_data.get("smtp_password", ""))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Only overwrite a password if a new one was actually submitted, so leaving the
        # field blank in the settings UI keeps the existing credential.
        if validated_data.get("imap_password"):
            validated_data["imap_password"] = encrypt_data(validated_data["imap_password"])
        else:
            validated_data.pop("imap_password", None)
        if validated_data.get("smtp_password"):
            validated_data["smtp_password"] = encrypt_data(validated_data["smtp_password"])
        else:
            validated_data.pop("smtp_password", None)
        return super().update(instance, validated_data)


class EmailIssueLinkCreateSerializer(BaseSerializer):
    """Get-or-create/update the requester email for a work item from the app UI.

    Counterpart to plane.api.serializers.EmailIssueLinkCreateSerializer, which
    serves the API-key authenticated path (PG-266/ghost-glue). Kept separate
    since app views never import from the api package.
    """

    class Meta:
        model = EmailIssueLink
        fields = ["requester_email", "requester_name"]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "message_ids",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
