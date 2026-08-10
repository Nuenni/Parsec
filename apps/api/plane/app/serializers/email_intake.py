# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import EmailIntakeConfig
from plane.license.utils.encryption import encrypt_data


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
