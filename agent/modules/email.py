"""
Email automation module — Gmail send, search, read, reply.

Contract: exposes TOOL_DEFINITIONS and dispatch() so the registry
can load this module automatically.
"""

import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any

from googleapiclient.discovery import build

from agent.auth import get_credentials


def _gmail_service():
    return build("gmail", "v1", credentials=get_credentials())


TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "send_email",
        "description": (
            "Send an email from the authenticated Gmail account. "
            "Returns the sent message ID."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject"},
                "body": {"type": "string", "description": "Plain-text email body"},
                "cc": {
                    "type": "string",
                    "description": "Optional CC address(es), comma-separated",
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "search_emails",
        "description": (
            "Search Gmail using a query string (same syntax as the Gmail search bar). "
            "Returns a list of matching messages with id, subject, sender, date, and snippet."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Gmail search query, e.g. 'from:boss@example.com is:unread'",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 10)",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "read_email",
        "description": "Fetch the full content of a single email by its message ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message_id": {
                    "type": "string",
                    "description": "Gmail message ID from search_emails",
                }
            },
            "required": ["message_id"],
        },
    },
    {
        "name": "reply_email",
        "description": "Reply to an existing email thread.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message_id": {
                    "type": "string",
                    "description": "Message ID of the email to reply to",
                },
                "body": {"type": "string", "description": "Plain-text reply body"},
            },
            "required": ["message_id", "body"],
        },
    },
]


def send_email(to: str, subject: str, body: str, cc: str = "") -> dict[str, Any]:
    msg = MIMEMultipart()
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    msg.attach(MIMEText(body, "plain"))
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service = _gmail_service()
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"message_id": sent["id"], "status": "sent"}


def search_emails(query: str, max_results: int = 10) -> dict[str, Any]:
    service = _gmail_service()
    results = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    messages = results.get("messages", [])
    summaries = []
    for m in messages:
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=m["id"], format="metadata",
                 metadataHeaders=["Subject", "From", "Date"])
            .execute()
        )
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        summaries.append({
            "id": m["id"],
            "thread_id": msg.get("threadId"),
            "subject": headers.get("Subject", "(no subject)"),
            "from": headers.get("From", ""),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
        })
    return {"messages": summaries, "total": len(summaries)}


def read_email(message_id: str) -> dict[str, Any]:
    service = _gmail_service()
    msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    body = _extract_body(msg.get("payload", {}))
    return {
        "id": message_id,
        "thread_id": msg.get("threadId"),
        "subject": headers.get("Subject", "(no subject)"),
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "date": headers.get("Date", ""),
        "body": body,
    }


def reply_email(message_id: str, body: str) -> dict[str, Any]:
    service = _gmail_service()
    original = service.users().messages().get(
        userId="me", id=message_id, format="metadata",
        metadataHeaders=["Subject", "From", "Message-ID", "References"]
    ).execute()
    headers = {h["name"]: h["value"] for h in original.get("payload", {}).get("headers", [])}
    thread_id = original.get("threadId")
    reply_subject = headers.get("Subject", "")
    if not reply_subject.lower().startswith("re:"):
        reply_subject = "Re: " + reply_subject
    msg = MIMEText(body, "plain")
    msg["To"] = headers.get("From", "")
    msg["Subject"] = reply_subject
    if headers.get("Message-ID"):
        msg["In-Reply-To"] = headers["Message-ID"]
        msg["References"] = (
            headers.get("References", "") + " " + headers["Message-ID"]
        ).strip()
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    sent = (
        service.users()
        .messages()
        .send(userId="me", body={"raw": raw, "threadId": thread_id})
        .execute()
    )
    return {"message_id": sent["id"], "thread_id": thread_id, "status": "sent"}


def dispatch(tool_name: str, tool_input: dict) -> dict[str, Any]:
    match tool_name:
        case "send_email":    return send_email(**tool_input)
        case "search_emails": return search_emails(**tool_input)
        case "read_email":    return read_email(**tool_input)
        case "reply_email":   return reply_email(**tool_input)
        case _: raise ValueError(f"Unknown tool: {tool_name}")


def _extract_body(payload: dict) -> str:
    if payload.get("mimeType") == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    for part in payload.get("parts", []):
        text = _extract_body(part)
        if text:
            return text
    return ""
