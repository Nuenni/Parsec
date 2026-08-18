# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Inbound webhook receiver for third-party feedback/support tools (Userback first).

Fork-specific addition, absent from the upstream project this was forked from.

Unlike every other endpoint in this codebase, this one is intentionally
unauthenticated (AllowAny, no session/API-key) - Userback's webhook config has no
field for custom headers, so an API key can't be sent. The `webhook_token` embedded
in the URL itself is the only credential; treat it like a bearer secret (unguessable,
rotatable, never logged in plaintext).
"""

# Rest Framework imports
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

# Module imports
from plane.bgtasks.webhook_intake_task import process_userback_webhook
from plane.db.models import WebhookIntakeConfig
from plane.utils.exception_logger import log_exception


class WebhookIntakeEndpoint(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, project_id, token):
        config = WebhookIntakeConfig.objects.filter(
            project_id=project_id, webhook_token=token, is_active=True
        ).first()
        if config is None:
            # Same response whether the project/token is wrong or just inactive -
            # don't give a prober signal about which part failed.
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            payload = request.data
        except Exception as e:
            log_exception(e)
            return Response({"error": "Invalid payload"}, status=status.HTTP_400_BAD_REQUEST)

        # Process async and acknowledge immediately - Userback expects a fast response
        # and may retry on timeout, which would otherwise risk duplicate processing.
        process_userback_webhook.delay(config_id=str(config.id), payload=payload)
        return Response(status=status.HTTP_202_ACCEPTED)
