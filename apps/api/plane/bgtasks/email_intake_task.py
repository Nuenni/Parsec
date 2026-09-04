# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import email
import html as _html
import imaplib
import io
import json
import re
import uuid
from email.header import decode_header
from email.utils import formataddr, parseaddr

# Django imports
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from django.utils.html import strip_tags

# Third party imports
from celery import shared_task

# Module imports
from plane.app.serializers import IssueCommentSerializer
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    EmailIntakeConfig,
    EmailIssueLink,
    FileAsset,
    Intake,
    IntakeIssue,
    Issue,
    IssueComment,
    State,
    User,
)
from plane.license.utils.encryption import decrypt_data
from plane.utils.exception_logger import log_exception

EMAIL_INTAKE_BOT_EMAIL = "email-intake@parsec.internal"

# Splits off quoted history / signatures from a reply body. Not exhaustive, but
# covers the common clients (Gmail, Outlook, Apple Mail) well enough for MVP.
QUOTE_SPLIT_RE = re.compile(
    r"\n\s*(>.*|On .{0,80} wrote:|-{2,}\s*Original Message\s*-{2,}|Am .{0,80} schrieb.*:)",
    re.IGNORECASE,
)

# config.from_name is meant to be a bare display name ("Support"), but if it was
# saved with the address already appended ("Support <support@x.com>") combining it
# with email_address below would double up into an unparseable header - strip it.
TRAILING_ANGLE_ADDRESS_RE = re.compile(r"\s*<[^<>]*>\s*$")


def _quote_mailbox(name):
    """imaplib.select() does not quote the mailbox name itself, so folder names with
    spaces or special characters (e.g. Fastmail's "[06] PayGlue/Support") break the
    IMAP command unless wrapped as an IMAP quoted-string ourselves.
    """
    escaped = name.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _decode_mime_header(value):
    if not value:
        return ""
    parts = decode_header(value)
    decoded = ""
    for text, charset in parts:
        if isinstance(text, bytes):
            decoded += text.decode(charset or "utf-8", errors="replace")
        else:
            decoded += text
    return decoded


def _html_to_text(html):
    """Renders HTML email bodies down to readable plain text - unlike Django's
    strip_tags(), this actually drops <style>/<script>/<head> element content instead
    of leaving CSS/JS text behind, and collapses the layout whitespace HTML emails
    are typically full of.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["style", "script", "head", "title"]):
        tag.decompose()
    lines = [line.strip() for line in soup.get_text(separator="\n").splitlines()]
    return "\n\n".join(line for line in lines if line)


def _extract_plain_text_body(msg):
    if msg.is_multipart():
        text_part = None
        html_part = None
        for part in _walk_outside_attached_messages(msg):
            content_type = part.get_content_type()
            if part.get_content_disposition() == "attachment":
                continue
            if content_type == "text/plain" and text_part is None:
                text_part = part
            elif content_type == "text/html" and html_part is None:
                html_part = part
        chosen = text_part or html_part
        if chosen is None:
            return ""
        payload = chosen.get_payload(decode=True) or b""
        charset = chosen.get_content_charset() or "utf-8"
        body = payload.decode(charset, errors="replace")
        return _html_to_text(body) if chosen is html_part else body
    else:
        payload = msg.get_payload(decode=True) or b""
        charset = msg.get_content_charset() or "utf-8"
        body = payload.decode(charset, errors="replace")
        return _html_to_text(body) if msg.get_content_type() == "text/html" else body


def _walk_outside_attached_messages(msg):
    """Like msg.walk(), but does not descend into attached messages.

    A forwarded conversation arrives as message/rfc822 parts, each with its own
    text body. msg.walk() would yield those inner bodies too, and an outer mail
    without a text part of its own would then get the attachment's text as its
    body. The attached messages are handled separately, see _extract_attachments.
    """
    yield msg
    if msg.get_content_type() == "message/rfc822":
        return
    if msg.is_multipart():
        for part in msg.get_payload():
            yield from _walk_outside_attached_messages(part)


def _extract_attachments(msg):
    """Every MIME part that is a real attachment, as a list of dicts.

    Inline images (Content-ID, no attachment disposition) are left alone, they
    belong to the HTML body. An attached message (message/rfc822, what mail
    clients produce when a conversation is forwarded as files) is kept as a file
    and additionally parsed, so its text can be shown in the work item.
    """
    if not msg.is_multipart():
        return []
    attachments = []
    for part in _walk_outside_attached_messages(msg):
        is_message = part.get_content_type() == "message/rfc822"
        if part.get_content_disposition() != "attachment" and not is_message:
            continue
        if part.is_multipart() and not is_message:
            continue
        filename = _decode_mime_header(part.get_filename() or "") or (
            "attached-message.eml" if is_message else "attachment"
        )
        if is_message:
            inner = part.get_payload()
            inner = inner[0] if isinstance(inner, list) and inner else None
            data = inner.as_bytes() if inner is not None else b""
            message = _summarize_attached_message(inner) if inner is not None else None
        else:
            data = part.get_payload(decode=True) or b""
            message = None
        attachments.append(
            {
                "filename": filename,
                "content_type": "message/rfc822" if is_message else part.get_content_type(),
                "data": data,
                "message": message,
            }
        )
    return attachments


def _summarize_attached_message(inner):
    """Subject, sender, date and body of an attached message, for the work item text."""
    _name, from_email = parseaddr(_decode_mime_header(inner.get("From", "")))
    return {
        "subject": _decode_mime_header(inner.get("Subject", "")),
        "from": _decode_mime_header(inner.get("From", "")) or from_email,
        "date": (inner.get("Date") or "").strip(),
        "body": _extract_plain_text_body(inner).strip(),
    }


def _attached_messages_html(attachments):
    """The attached messages as quoted blocks under the body, oldest first as
    they arrived. Everything is escaped; the mail body itself is not, and that
    is a separate matter."""
    blocks = []
    for att in attachments:
        message = att.get("message")
        if not message or not (message["body"] or message["subject"]):
            continue
        header = " · ".join(x for x in (message["from"], message["date"]) if x)
        body = _html.escape(message["body"]).replace("\n", "<br />")
        blocks.append(
            "<blockquote>"
            f"<p><strong>{_html.escape(message['subject'] or att['filename'])}</strong>"
            + (f"<br />{_html.escape(header)}" if header else "")
            + f"</p><p>{body}</p></blockquote>"
        )
    return "".join(blocks)


def _store_attachments(issue, attachments, actor):
    """Files from the mail become issue attachments, uploaded straight into the
    object store. Over the size limit means a line in the description instead of
    a file, the limit is the same one the upload endpoint enforces. Returns the
    HTML for those skipped files, empty when everything fit."""
    from plane.settings.storage import S3Storage
    from plane.utils.path_validator import sanitize_filename

    if not attachments:
        return ""
    storage = S3Storage()
    skipped = []
    for att in attachments:
        size = len(att["data"])
        name = sanitize_filename(att["filename"]) or "attachment"
        if size == 0:
            continue
        if size > settings.FILE_SIZE_LIMIT:
            skipped.append((name, size))
            continue
        asset_key = f"{issue.workspace_id}/{uuid.uuid4().hex}-{name}"
        if not storage.upload_file(io.BytesIO(att["data"]), asset_key, content_type=att["content_type"]):
            skipped.append((name, size))
            continue
        FileAsset.objects.create(
            attributes={"name": name, "type": att["content_type"], "size": size},
            asset=asset_key,
            size=size,
            workspace_id=issue.workspace_id,
            created_by=actor,
            issue_id=issue.id,
            project_id=issue.project_id,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            is_uploaded=True,
        )
    if not skipped:
        return ""
    items = "".join(f"<li>{_html.escape(n)} ({s // 1024} KB)</li>" for n, s in skipped)
    return f"<p>Attachments not stored (over the size limit):</p><ul>{items}</ul>"


def _strip_quoted_reply(body):
    match = QUOTE_SPLIT_RE.search(body)
    if match:
        body = body[: match.start()]
    return body.strip()


def parse_email_message(raw_bytes):
    """Pure function: raw RFC822 bytes -> a dict of the fields we care about.

    Kept free of any IMAP/DB access so it can be unit-tested directly against a
    hand-crafted message without a live mailbox.
    """
    msg = email.message_from_bytes(raw_bytes)
    from_name, from_email = parseaddr(_decode_mime_header(msg.get("From", "")))
    subject = _decode_mime_header(msg.get("Subject", ""))
    message_id = (msg.get("Message-ID") or "").strip()
    in_reply_to = (msg.get("In-Reply-To") or "").strip() or None
    references = (msg.get("References") or "").split()
    body = _strip_quoted_reply(_extract_plain_text_body(msg))
    return {
        "from_email": from_email,
        "from_name": from_name,
        "subject": subject,
        "message_id": message_id,
        "in_reply_to": in_reply_to,
        "references": references,
        "body": body,
        "attachments": _extract_attachments(msg),
    }


def _get_intake_bot_user():
    user, _ = User.objects.get_or_create(
        email=EMAIL_INTAKE_BOT_EMAIL,
        defaults={
            "username": "email-intake",
            "first_name": "Email",
            "last_name": "Intake",
            "is_bot": True,
            "is_password_autoset": True,
        },
    )
    return user


def process_parsed_email(config, parsed):
    """Given a parsed inbound email and its EmailIntakeConfig, either append it to an
    existing thread or create a new PENDING intake issue. Returns the affected Issue.
    """
    if parsed["message_id"] and _message_id_seen(config.project_id, parsed["message_id"]):
        return None

    thread_ids = {mid for mid in ([parsed["in_reply_to"]] + parsed["references"]) if mid}
    bot = _get_intake_bot_user()

    existing_link = _find_link_by_message_ids(config.project_id, thread_ids) if thread_ids else None

    attachments = parsed.get("attachments") or []

    if existing_link is not None:
        extra_html = _attached_messages_html(attachments)
        extra_html += _store_attachments(existing_link.issue, attachments, bot)
        comment = IssueComment.objects.create(
            issue=existing_link.issue,
            project_id=config.project_id,
            workspace_id=config.workspace_id,
            actor=bot,
            comment_html=f"<p>{parsed['body']}</p>{extra_html}",
            access="EXTERNAL",
            created_by=bot,
            updated_by=bot,
        )
        issue_activity.delay(
            type="comment.activity.created",
            requested_data=json.dumps(IssueCommentSerializer(comment).data, cls=DjangoJSONEncoder),
            actor_id=str(bot.id),
            issue_id=str(existing_link.issue_id),
            project_id=str(config.project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
        )
        if parsed["message_id"]:
            existing_link.message_ids = list(existing_link.message_ids or []) + [parsed["message_id"]]
            existing_link.save(update_fields=["message_ids"])
        _move_issue_state(existing_link.issue, config.state_on_customer_reply, bot)
        return existing_link.issue

    intake = Intake.objects.filter(project_id=config.project_id).first()
    if intake is None:
        log_exception(Exception(f"No Intake found for project {config.project_id}, skipping email"))
        return None

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
        name=(parsed["subject"] or "New support request")[:255],
        description_html=f"<p>{parsed['body']}</p>{_attached_messages_html(attachments)}",
        project_id=config.project_id,
        workspace_id=config.workspace_id,
        state_id=triage_state.id,
        created_by=bot,
        updated_by=bot,
    )
    skipped_html = _store_attachments(issue, attachments, bot)
    if skipped_html:
        issue.description_html += skipped_html
        issue.save(update_fields=["description_html"])
    IntakeIssue.objects.create(
        intake_id=intake.id,
        project_id=config.project_id,
        workspace_id=config.workspace_id,
        issue=issue,
        source="EMAIL",
        source_email=parsed["from_email"],
        extra={"message_id": parsed["message_id"]},
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
    EmailIssueLink.objects.create(
        issue=issue,
        project_id=config.project_id,
        workspace_id=config.workspace_id,
        requester_email=parsed["from_email"],
        requester_name=parsed["from_name"],
        message_ids=[parsed["message_id"]] if parsed["message_id"] else [],
    )
    return issue


def _find_link_by_message_ids(project_id, thread_ids):
    # message_ids is a plain JSONField (list), not ArrayField, so Postgres __overlap
    # isn't available - match in Python instead.
    for link in EmailIssueLink.objects.filter(project_id=project_id).only("id", "message_ids", "issue_id"):
        if thread_ids.intersection(link.message_ids or []):
            return link
    return None


def _message_id_seen(project_id, message_id):
    """Whether this exact message was already turned into an issue or comment.

    The IMAP poll fetches ALL messages in the folder rather than just UNSEEN ones,
    because mail rules that auto-mark-as-read (e.g. so the inbox doesn't show an
    unread badge) would otherwise hide new mail from the poller entirely. This check
    is what keeps re-fetching the same mail idempotent.
    """
    for link in EmailIssueLink.objects.filter(project_id=project_id).only("message_ids"):
        if message_id in (link.message_ids or []):
            return True
    return False


def test_imap_connection(host, port, username, password, use_ssl, folder="INBOX"):
    """Returns None on success, or an error message string."""
    try:
        connection = (
            imaplib.IMAP4_SSL(host, port, timeout=10) if use_ssl else imaplib.IMAP4(host, port, timeout=10)
        )
        try:
            connection.login(username, password)
            typ, _ = connection.select(_quote_mailbox(folder or "INBOX"))
            if typ != "OK":
                return f"Mailbox '{folder}' not found - check the folder name (case-sensitive)"
        finally:
            connection.logout()
        return None
    except Exception as e:
        return str(e)


def list_imap_folders(host, port, username, password, use_ssl):
    """Returns (folder_names, None) on success, or (None, error_message) on failure.

    Lets the settings UI offer a dropdown of real folders instead of requiring the
    folder name to be typed by hand (folder names/hierarchy separators vary by
    provider, e.g. Fastmail labels showing up as top-level IMAP folders).
    """
    try:
        connection = (
            imaplib.IMAP4_SSL(host, port, timeout=10) if use_ssl else imaplib.IMAP4(host, port, timeout=10)
        )
        try:
            connection.login(username, password)
            typ, mailbox_lines = connection.list()
            if typ != "OK":
                return None, "Could not list mailboxes"
            folders = []
            for line in mailbox_lines:
                if not line:
                    continue
                decoded = line.decode("utf-8", errors="replace") if isinstance(line, bytes) else line
                match = re.search(r'"([^"]*)"\s*$', decoded) or re.search(r"\s(\S+)$", decoded)
                if match:
                    folders.append(match.group(1))
            return folders, None
        finally:
            connection.logout()
    except Exception as e:
        return None, str(e)


def test_smtp_connection(host, port, username, password, use_tls):
    """Returns None on success, or an error message string."""
    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=host,
            port=port,
            username=username,
            password=password,
            use_tls=use_tls,
            timeout=10,
        )
        connection.open()
        connection.close()
        return None
    except Exception as e:
        return str(e)


@shared_task
def poll_email_intake_inboxes():
    for config in EmailIntakeConfig.objects.filter(is_active=True):
        try:
            _poll_single_inbox(config)
        except Exception as e:
            log_exception(e)


def _poll_single_inbox(config):
    connection = imaplib.IMAP4_SSL(config.imap_host, config.imap_port) if config.imap_use_ssl else imaplib.IMAP4(config.imap_host, config.imap_port)
    try:
        connection.login(config.imap_username, decrypt_data(config.imap_password))
        connection.select(_quote_mailbox(config.imap_folder or "INBOX"))
        # Not UNSEEN: mail rules that auto-mark-as-read on arrival (e.g. to keep an
        # inbox unread-badge clean) would otherwise hide mail from us before we ever
        # see it. Idempotency comes from _message_id_seen() instead.
        _, message_numbers = connection.search(None, "ALL")
        for num in message_numbers[0].split():
            _, msg_data = connection.fetch(num, "(RFC822)")
            raw_bytes = msg_data[0][1]
            try:
                parsed = parse_email_message(raw_bytes)
                if parsed["from_email"]:
                    process_parsed_email(config, parsed)
            except Exception as e:
                log_exception(e)
            connection.store(num, "+FLAGS", "\\Seen")
        config.last_polled_at = timezone.now()
        config.save(update_fields=["last_polled_at"])
    finally:
        try:
            connection.logout()
        except Exception:
            pass


def _build_email_connection(config):
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=config.smtp_host,
        port=config.smtp_port,
        username=config.smtp_username,
        password=decrypt_data(config.smtp_password),
        use_tls=config.smtp_use_tls,
    )


# Matches Plane's rich-text editor image blocks, e.g.
# <image-component data-id="..." src="<file-asset-id>" ...></image-component>
# `src` here is a FileAsset id, not a URL - strip_tags() would silently drop this
# entirely, which is why images never made it into outbound emails before.
IMAGE_COMPONENT_RE = re.compile(r'<image-component[^>]*\ssrc="([0-9a-fA-F-]+)"[^>]*>\s*</image-component>')

# Placeholders use {{ mustache }} style (not Python str.format) so a pasted custom
# template's own CSS braces (e.g. "{color:red}") never get misinterpreted.
EMAIL_HTML_TEMPLATE = """\
<div style="background:#0f172a;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="padding:0 0 24px 0;">
      <span style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:#f1f5f9;">{{ brand_name }}</span>
    </div>
    <div style="background:#1e293b;border-radius:12px;padding:32px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#6366f1;text-transform:uppercase;">{{ eyebrow }}</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;">{{ heading }}</p>
      <div style="font-size:14px;color:#cbd5e1;line-height:1.7;">{{ body }}</div>
      {{ signature }}
    </div>
    <div style="padding:20px 0 0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#475569;">{{ brand_name }}</p>
    </div>
  </div>
</div>
"""


def _extract_inline_images(comment_html):
    """Replaces Plane image blocks with cid-referenced <img> tags and returns the
    (asset bytes) to attach inline. Returns (rewritten_html, attachments) where
    attachments is a list of (cid, filename, content_type, data) tuples.
    """
    from plane.db.models import FileAsset
    from plane.utils.parsec_s3_storage import ParsecS3Storage

    attachments = []

    def _replace(match):
        asset_id = match.group(1)
        asset = FileAsset.objects.filter(pk=asset_id).first()
        if asset is None or not asset.asset:
            return ""
        data, content_type = ParsecS3Storage().get_object_bytes(asset.asset.name)
        if data is None:
            return ""
        cid = f"{asset_id}@parsec"
        filename = (asset.attributes or {}).get("name") or f"{asset_id}.png"
        attachments.append((cid, filename, content_type or "image/png", data))
        return f'<img src="cid:{cid}" style="max-width:100%;border-radius:8px;margin:8px 0;" />'

    return IMAGE_COMPONENT_RE.sub(_replace, comment_html), attachments


def _render_email_html(config, eyebrow, heading, body_html):
    brand_name = config.from_name or config.email_address
    template = config.html_template.strip() or EMAIL_HTML_TEMPLATE
    replacements = {
        "brand_name": brand_name,
        "eyebrow": eyebrow,
        "heading": heading,
        "body": body_html,
        "signature": config.signature_html or "",
    }
    for name, value in replacements.items():
        # Tolerate a custom template's placeholder spacing varying from the
        # canonical "{{ name }}" (e.g. "{{name}}" or "{{ name}}") so a minor
        # typo doesn't leak a literal, unreplaced placeholder into the email.
        template = re.sub(r"\{\{\s*" + name + r"\s*\}\}", lambda _match: value, template)
    return template


def _send_threaded_email(config, link, subject, plain_body, html_body=None, inline_images=None):
    from email.mime.image import MIMEImage
    from email.utils import make_msgid

    new_message_id = make_msgid()
    references = " ".join(link.message_ids or [])
    display_name = TRAILING_ANGLE_ADDRESS_RE.sub("", config.from_name).strip() if config.from_name else ""
    from_email = formataddr((display_name, config.email_address)) if display_name else config.email_address

    email_message = EmailMultiAlternatives(
        subject=subject,
        body=plain_body,
        from_email=from_email,
        to=[link.requester_email],
        connection=_build_email_connection(config),
        headers={
            "Message-ID": new_message_id,
            "In-Reply-To": (link.message_ids or [None])[-1] or "",
            "References": references,
        },
    )
    if html_body:
        email_message.attach_alternative(html_body, "text/html")
    if inline_images:
        email_message.mixed_subtype = "related"
        for cid, filename, _content_type, data in inline_images:
            image = MIMEImage(data)
            image.add_header("Content-ID", f"<{cid}>")
            image.add_header("Content-Disposition", "inline", filename=filename)
            email_message.attach(image)
    email_message.send()

    link.message_ids = list(link.message_ids or []) + [new_message_id]
    link.save(update_fields=["message_ids"])


def _move_issue_state(issue, target_state, bot):
    """Moves an issue to target_state (no-op if already there) and logs it as a proper
    activity entry, mirroring the state-change hooks in the GitHub sync task."""
    if target_state is None or issue.state_id == target_state.id:
        return
    old_state_id = issue.state_id
    issue.state = target_state
    issue.save(update_fields=["state"])
    issue_activity.delay(
        type="issue.activity.updated",
        requested_data=json.dumps({"state_id": str(target_state.id)}),
        actor_id=str(bot.id),
        issue_id=str(issue.id),
        project_id=str(issue.project_id),
        current_instance=json.dumps({"state_id": str(old_state_id)}),
        epoch=int(timezone.now().timestamp()),
        notification=True,
    )


@shared_task
def sync_comment_to_email(comment_id):
    try:
        comment = IssueComment.objects.select_related("issue", "actor").filter(pk=comment_id).first()
        if comment is None or comment.access != "EXTERNAL":
            return
        link = EmailIssueLink.objects.filter(issue_id=comment.issue_id).first()
        if link is None:
            return
        bot = _get_intake_bot_user()
        if comment.actor_id == bot.id:
            return
        config = EmailIntakeConfig.objects.filter(project_id=comment.project_id, is_active=True).first()
        if config is None:
            return
        html_with_images, inline_images = _extract_inline_images(comment.comment_html)
        plain_body = strip_tags(html_with_images) or comment.comment_stripped
        html_body = _render_email_html(
            config, eyebrow="New reply", heading=comment.issue.name, body_html=html_with_images
        )
        _send_threaded_email(
            config, link, f"Re: {comment.issue.name}", plain_body, html_body=html_body, inline_images=inline_images
        )
        _move_issue_state(comment.issue, config.state_on_agent_reply, bot)
    except Exception as e:
        log_exception(e)


@shared_task
def sync_issue_state_to_email(issue_id, new_state_name):
    try:
        issue = Issue.objects.filter(pk=issue_id).first()
        if issue is None:
            return
        link = EmailIssueLink.objects.filter(issue_id=issue_id).first()
        if link is None:
            return
        config = EmailIntakeConfig.objects.filter(project_id=issue.project_id, is_active=True).first()
        if config is None:
            return
        plain_body = f"Your ticket status changed to: {new_state_name}"
        html_body = _render_email_html(
            config,
            eyebrow="Status update",
            heading=issue.name,
            body_html=f'<p style="margin:0;">Your ticket status changed to <strong style="color:#f1f5f9;">{new_state_name}</strong>.</p>',
        )
        _send_threaded_email(config, link, f"Re: {issue.name}", plain_body, html_body=html_body)
    except Exception as e:
        log_exception(e)
