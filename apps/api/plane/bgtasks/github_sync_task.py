# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
import os
import re
from datetime import datetime

# Third party imports
import requests
from celery import shared_task
from django.utils import timezone

# Module imports
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    GithubCommitLink,
    GithubProjectLink,
    GithubPullRequestLink,
    Issue,
    IssueActivity,
    IssueComment,
    IssueLabel,
    Label,
    State,
    User,
)
from plane.utils.exception_logger import log_exception

GITHUB_SYNC_BOT_EMAIL = "github-sync@parsec.internal"
GITHUB_API_BASE_URL = "https://api.github.com"

# Matches issue keys like "PG-237" in PR titles, branch names, or issue bodies.
ISSUE_KEY_RE = re.compile(r"\b([A-Z]{2,10})-(\d+)\b")

# Matches GitHub/Linear-style closing keywords, e.g. "Closes PG-237", "fixes PG-1".
CLOSE_KEYWORD_RE = re.compile(
    r"\b(?:close[sd]?|fixe[sd]?|resolve[sd]?)\s+([A-Z]{2,10})-(\d+)\b", re.IGNORECASE
)


def _get_sync_bot_user():
    user, _ = User.objects.get_or_create(
        email=GITHUB_SYNC_BOT_EMAIL,
        defaults={
            "username": "github-sync",
            "first_name": "GitHub",
            "last_name": "Sync",
            "is_bot": True,
            "is_password_autoset": True,
        },
    )
    return user


def _find_linked_issue(link, *texts):
    """Look up an Issue in link.project by scanning texts for a "<IDENTIFIER>-<number>" key.

    Scoped to link.project (never a global identifier lookup) so an ambiguous/duplicate
    project identifier elsewhere in the workspace can't cause a wrong match.
    """
    for text in texts:
        if not text:
            continue
        for _prefix, number in ISSUE_KEY_RE.findall(text):
            issue = Issue.objects.filter(project_id=link.project_id, sequence_id=int(number)).first()
            if issue:
                return issue
    return None


def _find_closing_issue(link, *texts):
    """Like _find_linked_issue, but only matches an explicit closing keyword

    ("Closes PG-1", "Fixes PG-1", "Resolves PG-1") - used to gate auto-closing an
    issue on PR merge, so a PR that merely references an issue in passing never
    closes it.
    """
    for text in texts:
        if not text:
            continue
        for _prefix, number in CLOSE_KEYWORD_RE.findall(text):
            issue = Issue.objects.filter(project_id=link.project_id, sequence_id=int(number)).first()
            if issue:
                return issue
    return None


def _post_bot_comment(issue, comment_html):
    bot = _get_sync_bot_user()
    IssueComment.objects.create(
        issue=issue,
        project_id=issue.project_id,
        workspace_id=issue.workspace_id,
        actor=bot,
        comment_html=comment_html,
        created_by=bot,
        updated_by=bot,
    )


@shared_task
def sync_pull_request_from_github(link_id, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True).first()
        if link is None:
            return

        pr = payload.get("pull_request") or {}
        action = payload.get("action")
        if action not in ("opened", "edited", "reopened", "closed", "synchronize", "ready_for_review"):
            return

        issue = _find_linked_issue(link, pr.get("title"), pr.get("head", {}).get("ref"), pr.get("body"))
        if issue is None:
            return

        state = GithubPullRequestLink.State.OPEN
        if pr.get("merged"):
            state = GithubPullRequestLink.State.MERGED
        elif pr.get("state") == "closed":
            state = GithubPullRequestLink.State.CLOSED

        merged_at = None
        if pr.get("merged_at"):
            merged_at = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))

        pr_link, created = GithubPullRequestLink.objects.update_or_create(
            repository_full_name=link.repository_full_name,
            pr_number=pr.get("number"),
            defaults={
                "workspace_id": link.workspace_id,
                "project_id": link.project_id,
                "issue": issue,
                "pr_url": pr.get("html_url", ""),
                "title": pr.get("title", ""),
                "state": state,
                "is_draft": bool(pr.get("draft")),
                "head_branch": pr.get("head", {}).get("ref", ""),
                "head_sha": pr.get("head", {}).get("sha", ""),
                "merged_at": merged_at,
            },
        )

        if created:
            bot = _get_sync_bot_user()
            IssueActivity.objects.create(
                issue=issue,
                project_id=issue.project_id,
                workspace_id=issue.workspace_id,
                actor=bot,
                verb="created",
                field="github_pr",
                old_value=pr_link.pr_url,
                new_value=f"{link.repository_full_name}#{pr_link.pr_number}: {pr_link.title}",
                comment=f"linked pull request {link.repository_full_name}#{pr_link.pr_number}",
                epoch=int(timezone.now().timestamp()),
            )
        elif action == "closed" and state == GithubPullRequestLink.State.MERGED:
            closing_issue = _find_closing_issue(link, pr.get("title"), pr.get("body"))
            closed_note = ""
            if closing_issue is not None and closing_issue.id == issue.id:
                target_state = (
                    State.objects.filter(project_id=link.project_id, group="completed").first()
                    or State.objects.filter(project_id=link.project_id, group="cancelled").first()
                )
                if target_state and issue.state_id != target_state.id:
                    old_state_id = issue.state_id
                    issue.state = target_state
                    issue.save(update_fields=["state"])
                    closed_note = f' Issue moved to <strong>{target_state.name}</strong>.'
                    bot = _get_sync_bot_user()
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
            _post_bot_comment(
                issue,
                f'<p>Pull request <a href="{pr_link.pr_url}" target="_blank" rel="noopener noreferrer">'
                f"{link.repository_full_name}#{pr_link.pr_number}</a> was merged.{closed_note}</p>",
            )
        elif action == "closed" and state == GithubPullRequestLink.State.CLOSED:
            _post_bot_comment(
                issue,
                f'<p>Pull request <a href="{pr_link.pr_url}" target="_blank" rel="noopener noreferrer">'
                f"{link.repository_full_name}#{pr_link.pr_number}</a> was closed without merging.</p>",
            )
    except Exception as e:
        log_exception(e)


@shared_task
def sync_check_status_from_github(link_id, event, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True).first()
        if link is None:
            return

        node = payload.get(event.replace("_run", "_suite")) or payload.get("check_suite") or payload.get("check_run")
        if not node:
            return
        head_sha = node.get("head_sha")
        if not head_sha:
            return

        conclusion = node.get("conclusion")
        status_value = node.get("status")
        if status_value != "completed":
            checks_status = GithubPullRequestLink.ChecksStatus.PENDING
        elif conclusion == "success":
            checks_status = GithubPullRequestLink.ChecksStatus.SUCCESS
        elif conclusion in (None,):
            checks_status = GithubPullRequestLink.ChecksStatus.PENDING
        else:
            checks_status = GithubPullRequestLink.ChecksStatus.FAILURE

        GithubPullRequestLink.objects.filter(
            repository_full_name=link.repository_full_name, head_sha=head_sha
        ).update(checks_status=checks_status)
    except Exception as e:
        log_exception(e)


@shared_task
def sync_pr_review_from_github(link_id, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True).first()
        if link is None or payload.get("action") != "submitted":
            return

        pr = payload.get("pull_request") or {}
        review = payload.get("review") or {}
        pr_link = GithubPullRequestLink.objects.filter(
            repository_full_name=link.repository_full_name, pr_number=pr.get("number")
        ).first()
        if pr_link is None:
            return

        login = (review.get("user") or {}).get("login")
        state = (review.get("state") or "").lower()
        if not login or not state:
            return

        reviewers = [r for r in (pr_link.reviewers or []) if r.get("login") != login]
        reviewers.append({"login": login, "state": state})
        pr_link.reviewers = reviewers
        pr_link.save(update_fields=["reviewers"])
    except Exception as e:
        log_exception(e)


@shared_task
def sync_commits_from_github(link_id, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True).first()
        if link is None:
            return

        for commit in payload.get("commits", []):
            issue = _find_linked_issue(link, commit.get("message"))
            if issue is None:
                continue

            authored_at = None
            if commit.get("timestamp"):
                authored_at = datetime.fromisoformat(commit["timestamp"].replace("Z", "+00:00"))

            GithubCommitLink.objects.update_or_create(
                repository_full_name=link.repository_full_name,
                sha=commit.get("id", ""),
                issue=issue,
                defaults={
                    "workspace_id": link.workspace_id,
                    "project_id": link.project_id,
                    "message": commit.get("message", ""),
                    "url": commit.get("url", ""),
                    "author_name": (commit.get("author") or {}).get("name", ""),
                    "authored_at": authored_at,
                },
            )
    except Exception as e:
        log_exception(e)


@shared_task
def sync_issue_from_github(link_id, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True, sync_issues=True).first()
        if link is None:
            return

        gh_issue = payload.get("issue") or {}
        # PRs also fire "issues"-shaped webhook payloads on some events; skip those.
        if gh_issue.get("pull_request"):
            return

        action = payload.get("action")
        if action not in ("opened", "edited", "closed", "reopened", "labeled", "unlabeled"):
            return

        bot = _get_sync_bot_user()
        external_id = f"{link.repository_full_name}#{gh_issue.get('number')}"

        issue = Issue.objects.filter(project_id=link.project_id, external_source="github", external_id=external_id).first()

        if issue is None:
            default_state = State.objects.filter(project_id=link.project_id, default=True).first()
            issue = Issue.objects.create(
                project_id=link.project_id,
                workspace_id=link.workspace_id,
                name=(gh_issue.get("title") or "Untitled")[:255],
                description_html=gh_issue.get("body") or "<p></p>",
                state=default_state,
                external_source="github",
                external_id=external_id,
                created_by=bot,
                updated_by=bot,
            )
        else:
            issue.name = (gh_issue.get("title") or issue.name)[:255]
            if gh_issue.get("body"):
                issue.description_html = gh_issue["body"]
            issue.updated_by = bot
            issue.save(update_fields=["name", "description_html", "updated_by"])

        # Open/closed -> a state in the matching group, if the project has one.
        target_group = "completed" if gh_issue.get("state") == "closed" else "backlog"
        target_state = State.objects.filter(project_id=link.project_id, group=target_group).first()
        if target_state and issue.state_id != target_state.id:
            issue.state = target_state
            issue.save(update_fields=["state"])

        # Mirror GitHub labels onto the issue (create matching Plane labels by name if missing).
        gh_label_names = {label_data["name"] for label_data in gh_issue.get("labels", [])}
        if gh_label_names or action in ("labeled", "unlabeled"):
            label_ids = []
            for label_name in gh_label_names:
                label, _ = Label.objects.get_or_create(
                    project_id=link.project_id,
                    workspace_id=link.workspace_id,
                    name=label_name,
                    defaults={"color": "#60646C", "created_by": bot, "updated_by": bot},
                )
                label_ids.append(label.id)
            IssueLabel.objects.filter(issue=issue).exclude(label_id__in=label_ids).delete()
            existing_label_ids = set(IssueLabel.objects.filter(issue=issue).values_list("label_id", flat=True))
            IssueLabel.objects.bulk_create(
                [
                    IssueLabel(
                        issue=issue,
                        label_id=label_id,
                        project_id=link.project_id,
                        workspace_id=link.workspace_id,
                        created_by=bot,
                        updated_by=bot,
                    )
                    for label_id in label_ids
                    if label_id not in existing_label_ids
                ]
            )
    except Exception as e:
        log_exception(e)


@shared_task
def sync_issue_comment_from_github(link_id, payload):
    try:
        link = GithubProjectLink.objects.filter(pk=link_id, is_active=True, sync_issues=True).first()
        if link is None or payload.get("action") != "created":
            return

        gh_issue = payload.get("issue") or {}
        gh_comment = payload.get("comment") or {}
        external_issue_id = f"{link.repository_full_name}#{gh_issue.get('number')}"

        issue = Issue.objects.filter(
            project_id=link.project_id, external_source="github", external_id=external_issue_id
        ).first()
        if issue is None:
            return

        external_comment_id = str(gh_comment.get("id"))
        if IssueComment.objects.filter(
            issue=issue, external_source="github", external_id=external_comment_id
        ).exists():
            return

        bot = _get_sync_bot_user()
        author = (gh_comment.get("user") or {}).get("login", "someone")
        body_html = gh_comment.get("body_html") or f"<p>{gh_comment.get('body', '')}</p>"
        comment_html = f"<p><em>@{author} commented on GitHub:</em></p>{body_html}"

        IssueComment.objects.create(
            issue=issue,
            project_id=link.project_id,
            workspace_id=link.workspace_id,
            actor=bot,
            comment_html=comment_html,
            external_source="github",
            external_id=external_comment_id,
            created_by=bot,
            updated_by=bot,
        )
    except Exception as e:
        log_exception(e)


# ---------------------------------------------------------------------------
# Outbound: Parsec -> GitHub. Only ever acts on issues with external_source
# "github" (i.e. issues that originated from a synced repo), and is a no-op
# if GITHUB_SYNC_TOKEN isn't configured (e.g. local dev without a real repo).
# ---------------------------------------------------------------------------


def _github_bot_user_id():
    return _get_sync_bot_user().id


def _github_api_request(method, path, **kwargs):
    token = os.environ.get("GITHUB_SYNC_TOKEN")
    if not token:
        return None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    response = requests.request(method, f"{GITHUB_API_BASE_URL}{path}", headers=headers, timeout=10, **kwargs)
    response.raise_for_status()
    return response


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def sync_comment_to_github(self, comment_id):
    try:
        from plane.utils.html_processor import strip_tags

        comment = IssueComment.objects.select_related("issue", "actor").filter(pk=comment_id).first()
        if comment is None:
            return
        issue = comment.issue
        # Only comments explicitly marked "external" are posted to a (likely public)
        # GitHub repo - mirrors the same access-gated behavior as email sync.
        if (
            issue.external_source != "github"
            or comment.actor_id == _github_bot_user_id()
            or comment.access != "EXTERNAL"
        ):
            return

        repository_full_name, _, number = issue.external_id.rpartition("#")
        body = strip_tags(comment.comment_html) or comment.comment_stripped
        author_name = comment.actor.display_name if comment.actor else "Someone"
        _github_api_request(
            "POST",
            f"/repos/{repository_full_name}/issues/{number}/comments",
            json={"body": f"**{author_name}** commented in Parsec:\n\n{body}"},
        )
    except Exception as e:
        log_exception(e)
        raise


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def sync_issue_state_to_github(self, issue_id, is_closed):
    try:
        issue = Issue.objects.select_related("state").filter(pk=issue_id).first()
        if issue is None or issue.external_source != "github" or issue.updated_by_id == _github_bot_user_id():
            return
        repository_full_name, _, number = issue.external_id.rpartition("#")
        _github_api_request(
            "PATCH",
            f"/repos/{repository_full_name}/issues/{number}",
            json={"state": "closed" if is_closed else "open"},
        )
    except Exception as e:
        log_exception(e)
        raise


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def sync_issue_labels_to_github(self, issue_id):
    try:
        issue = Issue.objects.filter(pk=issue_id).first()
        if issue is None or issue.external_source != "github" or issue.updated_by_id == _github_bot_user_id():
            return
        repository_full_name, _, number = issue.external_id.rpartition("#")
        label_names = list(
            IssueLabel.objects.filter(issue=issue).values_list("label__name", flat=True)
        )
        _github_api_request(
            "PUT",
            f"/repos/{repository_full_name}/issues/{number}/labels",
            json={"labels": label_names},
        )
    except Exception as e:
        log_exception(e)
        raise
