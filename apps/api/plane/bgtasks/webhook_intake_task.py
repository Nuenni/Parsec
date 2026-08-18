# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Processes inbound Userback webhook payloads into Parsec issues/comments.

Fork-specific addition, absent from the upstream project this was forked from.

Userback's webhook payloads aren't fully documented (https://docs.userback.io/docs/webhooks
only shows one example, for feedback.create). Priority and the feedback/comment id
fields are confirmed from that example; status values and the exact "comment" event
shape are not, so status->state syncing is deliberately NOT implemented here - do not
guess at a mapping that could silently miscategorize issues. Confirm the real shape via
Userback's built-in webhook "Test" feature before extending this.
"""

import json

# Django imports
from django.utils import timezone
from django.utils.html import escape

# Third party imports
from celery import shared_task

# Module imports
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    Intake,
    IntakeIssue,
    Issue,
    IssueAssignee,
    IssueComment,
    ProjectMember,
    State,
    User,
    WebhookFeedbackLink,
    WebhookIntakeConfig,
)
from plane.db.models.state import StateGroup
from plane.utils.exception_logger import log_exception

WEBHOOK_INTAKE_BOT_EMAIL = "webhook-intake@parsec.internal"

# Userback sends priority as a capitalized word ("Urgent") per its one documented
# example; Plane's Issue.priority choices are lowercase. Unrecognized/missing values
# fall back to "none" rather than guessing.
USERBACK_PRIORITY_MAP = {
    "urgent": "urgent",
    "high": "high",
    "medium": "medium",
    "low": "low",
    # Confirmed from real production payloads (2026-08-18), not in Userback's docs.
    "neutral": "none",
}


def _get_webhook_intake_bot_user():
    user, _ = User.objects.get_or_create(
        email=WEBHOOK_INTAKE_BOT_EMAIL,
        defaults={
            "username": "webhook-intake",
            "first_name": "Webhook",
            "last_name": "Intake",
            "is_bot": True,
            "is_password_autoset": True,
        },
    )
    return user


def _map_priority(value):
    if not value:
        return "none"
    return USERBACK_PRIORITY_MAP.get(str(value).strip().lower(), "none")


def _extract_assignee_email(data):
    assignee = data.get("assignee")
    return assignee.get("email") if isinstance(assignee, dict) else None


def _find_member(project_id, email):
    if not email:
        return None
    return (
        ProjectMember.objects.filter(project_id=project_id, member__email__iexact=email, is_active=True)
        .select_related("member")
        .first()
    )


def _feedback_title(data):
    title = data.get("title")
    if title and str(title).strip():
        return str(title).strip()[:255]
    feedback_type = data.get("feedback_type") or "Feedback"
    page = data.get("page") or data.get("url") or ""
    title = f"{feedback_type}: {page}" if page else feedback_type
    return title[:255] or "New feedback"


def _safe_url(value):
    """Only accept http(s) URLs - guards against javascript: hrefs from an untrusted payload."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value if value.lower().startswith(("http://", "https://")) else None


def _extract_media_urls(value):
    """`screenshot` shape is unconfirmed (docs only show one bare example payload) - it's
    been observed as a list, so defensively handle a bare string, a list of strings, and a
    list of dicts under a few plausible key names."""
    if not value:
        return []
    items = value if isinstance(value, list) else [value]
    urls = []
    for item in items:
        if isinstance(item, str):
            urls.append(item)
        elif isinstance(item, dict):
            for key in ("url", "image", "src", "screenshot_url", "file", "path"):
                if item.get(key):
                    urls.append(item[key])
                    break
    return urls


def _feedback_description_html(data):
    parts = []

    description = data.get("description")
    if description and str(description).strip():
        parts.append(f"<p>{escape(str(description).strip())}</p>")

    rows = []
    for label, key in [
        ("Reporter", "email"),
        ("Name", "name"),
        ("Page", "page"),
        ("Category", "category"),
        ("Rating", "rating"),
        ("Browser", "browser"),
    ]:
        value = data.get(key)
        if value:
            rows.append(f"<li><strong>{label}:</strong> {escape(str(value))}</li>")

    share_url = _safe_url(data.get("share_url") or data.get("feedback_url"))
    if share_url:
        rows.append(f'<li><a href="{escape(share_url)}">View in Userback</a></li>')

    attachment_url = _safe_url(data.get("attachment"))
    if attachment_url:
        rows.append(f'<li><a href="{escape(attachment_url)}">Attachment</a></li>')

    if rows:
        parts.append(f"<ul>{''.join(rows)}</ul>")

    screenshot_urls = [url for raw in _extract_media_urls(data.get("screenshot")) if (url := _safe_url(raw))]
    for url in screenshot_urls:
        parts.append(f'<p><img src="{escape(url)}" /></p>')

    return "".join(parts) if parts else "<p>No further details provided.</p>"


def _create_issue_from_feedback(config, data):
    bot = _get_webhook_intake_bot_user()
    intake = Intake.objects.filter(project_id=config.project_id).first()

    triage_state = State.triage_objects.filter(project_id=config.project_id).first()
    if triage_state is None:
        triage_state = State.objects.create(
            name="Triage",
            group="triage",
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            color="#4E5355",
            sequence=65000,
            default=False,
        )

    issue = Issue.objects.create(
        name=_feedback_title(data),
        description_html=_feedback_description_html(data),
        priority=_map_priority(data.get("priority")),
        project_id=config.project_id,
        workspace_id=config.workspace_id,
        state_id=triage_state.id,
        created_by=bot,
        updated_by=bot,
    )

    if intake is not None:
        IntakeIssue.objects.create(
            intake_id=intake.id,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            issue=issue,
            source=config.source,
            extra={"external_feedback_id": data.get("id")},
        )

    # all_objects: a soft-deleted link for this (project, source, external_feedback_id)
    # still holds the unique constraint - re-point it at the new issue instead of
    # hitting an IntegrityError if Userback resends a create for the same feedback id.
    external_feedback_id = str(data.get("id"))
    link = WebhookFeedbackLink.all_objects.filter(
        project_id=config.project_id, source=config.source, external_feedback_id=external_feedback_id
    ).first()
    if link is not None:
        link.issue = issue
        link.deleted_at = None
        link.external_comment_ids = {}
        link.save(update_fields=["issue", "deleted_at", "external_comment_ids"])
    else:
        link = WebhookFeedbackLink.objects.create(
            issue=issue,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            source=config.source,
            external_feedback_id=external_feedback_id,
        )

    member = _find_member(config.project_id, _extract_assignee_email(data))
    if member is not None:
        IssueAssignee.objects.create(
            issue=issue,
            assignee=member.member,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            created_by=bot,
            updated_by=bot,
        )

    issue_activity.delay(
        type="issue.activity.created",
        requested_data=json.dumps({"name": issue.name}),
        actor_id=str(bot.id),
        issue_id=str(issue.id),
        project_id=str(config.project_id),
        current_instance=None,
        epoch=int(timezone.now().timestamp()),
        notification=True,
    )
    return link


def _sync_feedback_update(link, config, data):
    bot = _get_webhook_intake_bot_user()
    issue = link.issue

    if "priority" in data:
        mapped = _map_priority(data.get("priority"))
        if mapped != issue.priority:
            issue.priority = mapped
            issue.updated_by = bot
            issue.save(update_fields=["priority", "updated_by"])

    member = _find_member(config.project_id, _extract_assignee_email(data))
    if member is not None and not IssueAssignee.objects.filter(issue=issue, assignee=member.member).exists():
        IssueAssignee.objects.filter(issue=issue).delete()
        IssueAssignee.objects.create(
            issue=issue,
            assignee=member.member,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            created_by=bot,
            updated_by=bot,
        )


def _cancel_feedback_issue(link, config):
    cancelled_state = State.objects.filter(project_id=config.project_id, group=StateGroup.CANCELLED.value).first()
    if cancelled_state is None:
        log_exception(Exception(f"No Cancelled state in project {config.project_id}, leaving issue state unchanged"))
        return
    bot = _get_webhook_intake_bot_user()
    issue = link.issue
    issue.state = cancelled_state
    issue.updated_by = bot
    issue.save(update_fields=["state", "updated_by"])


def _sync_comment(link, config, action, comment_data):
    bot = _get_webhook_intake_bot_user()
    external_comment_id = str(comment_data.get("id"))

    if action == "create":
        comment_html = f"<p>{comment_data.get('comment') or comment_data.get('body') or ''}</p>"
        comment = IssueComment.objects.create(
            issue=link.issue,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            actor=bot,
            comment_html=comment_html,
            access="EXTERNAL",
            created_by=bot,
            updated_by=bot,
        )
        link.external_comment_ids[external_comment_id] = str(comment.id)
        link.save(update_fields=["external_comment_ids"])
        issue_activity.delay(
            type="comment.activity.created",
            requested_data=json.dumps({"comment_html": comment_html}),
            actor_id=str(bot.id),
            issue_id=str(link.issue_id),
            project_id=str(config.project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
        )
        return

    internal_comment_id = link.external_comment_ids.get(external_comment_id)
    if internal_comment_id is None:
        log_exception(Exception(f"No tracked comment for external id {external_comment_id}, ignoring {action}"))
        return
    comment = IssueComment.objects.filter(id=internal_comment_id).first()
    if comment is None:
        return

    if action == "update":
        comment.comment_html = f"<p>{comment_data.get('comment') or comment_data.get('body') or ''}</p>"
        comment.updated_by = bot
        comment.save(update_fields=["comment_html", "updated_by"])
    elif action == "remove":
        comment.delete()
        link.external_comment_ids.pop(external_comment_id, None)
        link.save(update_fields=["external_comment_ids"])


@shared_task
def process_userback_webhook(config_id, payload):
    config = WebhookIntakeConfig.objects.filter(id=config_id, is_active=True).first()
    if config is None:
        return

    try:
        action = payload.get("action")
        event_type = payload.get("type")
        data = payload.get("data") or {}

        if event_type == "feedback" and action == "create":
            _create_issue_from_feedback(config, data)
            return

        # For a comment event, `data` is the comment - its parent feedback id lives
        # under one of these keys (unconfirmed which, pending a real test payload).
        feedback_id = data.get("id") if event_type == "feedback" else (data.get("feedback") or data.get("feedback_id"))

        link = (
            WebhookFeedbackLink.objects.filter(
                project_id=config.project_id, source=config.source, external_feedback_id=str(feedback_id)
            )
            .select_related("issue")
            .first()
        )
        if link is None:
            log_exception(
                Exception(
                    f"No WebhookFeedbackLink for {config.source} feedback {feedback_id} "
                    f"in project {config.project_id}"
                )
            )
            return

        if event_type == "feedback" and action == "update":
            _sync_feedback_update(link, config, data)
        elif event_type == "feedback" and action == "remove":
            _cancel_feedback_issue(link, config)
        elif event_type == "comment":
            _sync_comment(link, config, action, data)
    except Exception as e:
        log_exception(e)
