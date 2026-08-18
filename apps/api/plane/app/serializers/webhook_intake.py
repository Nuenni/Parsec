# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from plane.db.models import WebhookIntakeConfig


class WebhookIntakeConfigSerializer(BaseSerializer):
    class Meta:
        model = WebhookIntakeConfig
        fields = ["id", "project", "source", "webhook_token", "is_active", "created_at"]
        read_only_fields = ["id", "project", "source", "webhook_token", "created_at"]
