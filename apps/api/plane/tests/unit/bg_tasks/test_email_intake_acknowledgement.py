# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Fork-specific addition, not part of upstream Plane.

A requester who writes to an intake address gets a receipt with the ticket
number, in the same thread, and only when a person sent the mail.
"""

from email.message import EmailMessage
from types import SimpleNamespace

import pytest

from plane.bgtasks import email_intake_task as task
from plane.bgtasks.email_intake_task import _is_automated_sender, _send_acknowledgement, parse_email_message


def _message(from_addr="Reader <reader@example.com>", **headers):
    msg = EmailMessage()
    msg["From"] = from_addr
    msg["Subject"] = "Paywall does not open"
    for key, value in headers.items():
        msg[key.replace("_", "-")] = value
    msg.set_content("Hello")
    return msg


@pytest.mark.unit
def test_person_is_not_automated():
    msg = _message()
    assert _is_automated_sender(msg, "reader@example.com") is False
    assert parse_email_message(msg.as_bytes())["is_automated"] is False


@pytest.mark.unit
@pytest.mark.parametrize(
    "headers",
    [
        {"Auto_Submitted": "auto-replied"},
        {"Auto_Submitted": "auto-generated"},
        {"Precedence": "bulk"},
        {"X_Autoreply": "yes"},
    ],
)
def test_auto_responders_are_automated(headers):
    msg = _message(**headers)
    assert _is_automated_sender(msg, "reader@example.com") is True


@pytest.mark.unit
def test_auto_submitted_no_is_a_person():
    msg = _message(Auto_Submitted="no")
    assert _is_automated_sender(msg, "reader@example.com") is False


@pytest.mark.unit
@pytest.mark.parametrize(
    "address",
    ["noreply@shop.example", "no-reply@x.example", "MAILER-DAEMON@mx.example", "postmaster@x.example"],
)
def test_machine_addresses_are_automated(address):
    assert _is_automated_sender(_message(), address) is True


def _fixtures():
    config = SimpleNamespace(
        email_address="support@example.com", from_name="Support", html_template="", signature_html=""
    )
    link = SimpleNamespace(message_ids=["<cust@example.com>"], requester_email="reader@example.com")
    issue = SimpleNamespace(name="Paywall does not open", sequence_id=34, project=SimpleNamespace(identifier="SUP"))
    return config, link, issue


@pytest.mark.unit
def test_acknowledgement_carries_ticket_number_and_threads(monkeypatch):
    sent = {}

    def fake_send(config, link, subject, plain_body, html_body=None, inline_images=None):
        sent.update(subject=subject, plain=plain_body, html=html_body)

    monkeypatch.setattr(task, "_send_threaded_email", fake_send)
    config, link, issue = _fixtures()

    _send_acknowledgement(config, link, issue, {"from_email": "reader@example.com", "is_automated": False})

    assert sent["subject"] == "Re: Paywall does not open [SUP-34]"
    assert "SUP-34" in sent["plain"]
    assert "reply to this email" in sent["plain"]
    assert "SUP-34" in sent["html"]


@pytest.mark.unit
def test_no_acknowledgement_for_automated_or_own_address(monkeypatch):
    calls = []
    monkeypatch.setattr(task, "_send_threaded_email", lambda *a, **k: calls.append(a))
    config, link, issue = _fixtures()

    _send_acknowledgement(config, link, issue, {"from_email": "noreply@x.example", "is_automated": True})
    _send_acknowledgement(config, link, issue, {"from_email": "support@example.com", "is_automated": False})

    assert calls == []


@pytest.mark.unit
def test_send_failure_is_logged_not_raised(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("smtp down")

    logged = []
    monkeypatch.setattr(task, "_send_threaded_email", boom)
    monkeypatch.setattr(task, "log_exception", lambda e: logged.append(e))
    config, link, issue = _fixtures()

    _send_acknowledgement(config, link, issue, {"from_email": "reader@example.com", "is_automated": False})

    assert len(logged) == 1
