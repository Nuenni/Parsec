# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Fork-specific addition, not part of upstream Plane.

The email intake used to skip every MIME part marked as an attachment, so a
screenshot or a forwarded conversation arrived as an empty work item. These
tests build messages by hand and check what parse_email_message keeps.
"""

from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import pytest

from plane.bgtasks.email_intake_task import (
    _attached_messages_html,
    _store_attachments,
    parse_email_message,
)


def _mail_with_file(
    body="Hello, see attached.",
    filename="report.pdf",
    data=b"%PDF-1.4 fake",
    maintype="application",
    subtype="pdf",
):
    msg = EmailMessage()
    msg["From"] = "Reader <reader@example.com>"
    msg["Subject"] = "Paywall does not open"
    msg["Message-ID"] = "<one@example.com>"
    msg.set_content(body)
    msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)
    return msg.as_bytes()


def _mail_with_attached_message():
    inner = EmailMessage()
    inner["From"] = "Customer <customer@example.com>"
    inner["Subject"] = "Original question"
    inner["Date"] = "Thu, 04 Sep 2026 12:00:00 +0200"
    inner.set_content("Does PayPal need an account?\nThanks.")

    outer = MIMEMultipart("mixed")
    outer["From"] = "Andre <andre@example.com>"
    outer["Subject"] = "Fwd: conversation"
    outer["Message-ID"] = "<two@example.com>"
    outer.attach(MIMEText("Forwarding this for the record.", "plain"))
    from email.mime.message import MIMEMessage

    part = MIMEMessage(inner)
    part.add_header("Content-Disposition", "attachment", filename="Original question.eml")
    outer.attach(part)
    return outer.as_bytes()


@pytest.mark.unit
def test_file_attachment_is_kept():
    parsed = parse_email_message(_mail_with_file())

    assert parsed["body"].strip() == "Hello, see attached."
    assert len(parsed["attachments"]) == 1
    att = parsed["attachments"][0]
    assert att["filename"] == "report.pdf"
    assert att["content_type"] == "application/pdf"
    assert att["data"] == b"%PDF-1.4 fake"
    assert att["message"] is None


@pytest.mark.unit
def test_attached_message_is_kept_as_file_and_summarised():
    parsed = parse_email_message(_mail_with_attached_message())

    # The outer body stays the outer body; the inner text must not leak into it.
    assert parsed["body"].strip() == "Forwarding this for the record."
    assert len(parsed["attachments"]) == 1
    att = parsed["attachments"][0]
    assert att["filename"] == "Original question.eml"
    assert att["content_type"] == "message/rfc822"
    assert b"Does PayPal need an account?" in att["data"]
    assert att["message"]["subject"] == "Original question"
    assert "customer@example.com" in att["message"]["from"]
    assert att["message"]["body"] == "Does PayPal need an account?\nThanks."


@pytest.mark.unit
def test_attached_message_renders_as_quoted_block():
    parsed = parse_email_message(_mail_with_attached_message())

    html = _attached_messages_html(parsed["attachments"])

    assert html.startswith("<blockquote>")
    assert "<strong>Original question</strong>" in html
    assert "Does PayPal need an account?<br />Thanks." in html
    # Escaped, never raw.
    assert "<script" not in html


@pytest.mark.unit
def test_plain_mail_has_no_attachments():
    msg = EmailMessage()
    msg["From"] = "reader@example.com"
    msg["Subject"] = "Just text"
    msg.set_content("No files here.")

    parsed = parse_email_message(msg.as_bytes())

    assert parsed["attachments"] == []


@pytest.mark.unit
def test_inline_image_is_not_treated_as_attachment():
    msg = EmailMessage()
    msg["From"] = "reader@example.com"
    msg["Subject"] = "Screenshot inline"
    msg.set_content("See below.")
    msg.add_related(b"\x89PNG fake", maintype="image", subtype="png", cid="<img1@example.com>")

    parsed = parse_email_message(msg.as_bytes())

    assert parsed["attachments"] == []


@pytest.mark.unit
@pytest.mark.django_db
def test_store_attachments_uploads_and_creates_assets(monkeypatch, settings):
    from plane.db.models import FileAsset, Issue, State
    from plane.tests.factories import ProjectFactory

    uploaded = []

    class FakeStorage:
        def __init__(self, *args, **kwargs):
            pass

        def upload_file(self, file_obj, object_name, content_type=None, extra_args=None):
            uploaded.append((object_name, content_type, file_obj.read()))
            return True

    monkeypatch.setattr("plane.settings.storage.S3Storage", FakeStorage)
    settings.FILE_SIZE_LIMIT = 1024

    project = ProjectFactory()
    actor = project.workspace.owner
    state = State.objects.create(
        name="Triage", group="triage", project=project, workspace=project.workspace, color="#000", sequence=1
    )
    issue = Issue.objects.create(
        name="Attachment test", project=project, workspace=project.workspace, state=state,
        created_by=actor, updated_by=actor,
    )
    attachments = [
        {"filename": "ok.pdf", "content_type": "application/pdf", "data": b"x" * 10, "message": None},
        {"filename": "too-big.zip", "content_type": "application/zip", "data": b"x" * 2048, "message": None},
        {"filename": "empty.txt", "content_type": "text/plain", "data": b"", "message": None},
    ]

    skipped_html = _store_attachments(issue, attachments, actor)

    assets = FileAsset.objects.filter(issue_id=issue.id, entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT)
    assert assets.count() == 1
    asset = assets.get()
    assert asset.attributes["name"] == "ok.pdf"
    assert asset.is_uploaded is True
    assert str(asset.asset).startswith(f"{issue.workspace_id}/")
    assert len(uploaded) == 1 and uploaded[0][1] == "application/pdf"
    assert "too-big.zip" in skipped_html
    assert "empty.txt" not in skipped_html
