"""
Calendar automation module — Google Calendar create, list, update, delete.

Contract: exposes TOOL_DEFINITIONS and dispatch() so the registry
can load this module automatically.
"""

import datetime
from typing import Any

from googleapiclient.discovery import build

from agent.auth import get_credentials


def _calendar_service():
    return build("calendar", "v3", credentials=get_credentials())


TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "create_event",
        "description": "Create a new Google Calendar event. Returns the created event ID and link.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Event title"},
                "start": {
                    "type": "string",
                    "description": "Start datetime ISO 8601, e.g. '2026-06-01T14:00:00-05:00'",
                },
                "end": {
                    "type": "string",
                    "description": "End datetime ISO 8601",
                },
                "description": {"type": "string", "description": "Optional agenda/description"},
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of attendee email addresses",
                },
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone, e.g. 'America/Chicago'. Defaults to UTC.",
                    "default": "UTC",
                },
                "calendar_id": {"type": "string", "default": "primary"},
            },
            "required": ["summary", "start", "end"],
        },
    },
    {
        "name": "list_events",
        "description": "List upcoming Google Calendar events within a time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "time_min": {"type": "string", "description": "Lower bound ISO 8601. Defaults to now."},
                "time_max": {"type": "string", "description": "Upper bound ISO 8601."},
                "max_results": {"type": "integer", "default": 20},
                "calendar_id": {"type": "string", "default": "primary"},
                "query": {"type": "string", "description": "Free-text search within event fields"},
            },
            "required": [],
        },
    },
    {
        "name": "update_event",
        "description": "Update fields of an existing Google Calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string", "description": "Event ID to update"},
                "summary": {"type": "string"},
                "start": {"type": "string"},
                "end": {"type": "string"},
                "description": {"type": "string"},
                "attendees": {"type": "array", "items": {"type": "string"}},
                "timezone": {"type": "string"},
                "calendar_id": {"type": "string", "default": "primary"},
            },
            "required": ["event_id"],
        },
    },
    {
        "name": "delete_event",
        "description": "Delete a Google Calendar event by ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
                "calendar_id": {"type": "string", "default": "primary"},
            },
            "required": ["event_id"],
        },
    },
]


def create_event(
    summary: str, start: str, end: str,
    description: str = "", attendees: list[str] | None = None,
    timezone: str = "UTC", calendar_id: str = "primary",
) -> dict[str, Any]:
    service = _calendar_service()
    body: dict[str, Any] = {
        "summary": summary,
        "start": {"dateTime": start, "timeZone": timezone},
        "end": {"dateTime": end, "timeZone": timezone},
    }
    if description:
        body["description"] = description
    if attendees:
        body["attendees"] = [{"email": a} for a in attendees]
    event = service.events().insert(calendarId=calendar_id, body=body).execute()
    return {"event_id": event["id"], "summary": event.get("summary"),
            "start": event.get("start"), "end": event.get("end"),
            "html_link": event.get("htmlLink"), "status": "created"}


def list_events(
    time_min: str | None = None, time_max: str | None = None,
    max_results: int = 20, calendar_id: str = "primary", query: str | None = None,
) -> dict[str, Any]:
    service = _calendar_service()
    if time_min is None:
        time_min = datetime.datetime.utcnow().isoformat() + "Z"
    kwargs: dict[str, Any] = {
        "calendarId": calendar_id, "timeMin": time_min,
        "maxResults": max_results, "singleEvents": True, "orderBy": "startTime",
    }
    if time_max:
        kwargs["timeMax"] = time_max
    if query:
        kwargs["q"] = query
    result = service.events().list(**kwargs).execute()
    events = result.get("items", [])
    return {
        "events": [
            {"event_id": e["id"], "summary": e.get("summary", "(no title)"),
             "start": e.get("start"), "end": e.get("end"),
             "description": e.get("description", ""),
             "attendees": [a.get("email") for a in e.get("attendees", [])],
             "html_link": e.get("htmlLink"), "status": e.get("status")}
            for e in events
        ],
        "total": len(events),
    }


def update_event(
    event_id: str, summary: str | None = None,
    start: str | None = None, end: str | None = None,
    description: str | None = None, attendees: list[str] | None = None,
    timezone: str | None = None, calendar_id: str = "primary",
) -> dict[str, Any]:
    service = _calendar_service()
    event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
    if summary is not None:      event["summary"] = summary
    if description is not None:  event["description"] = description
    if start is not None:
        tz = timezone or event.get("start", {}).get("timeZone", "UTC")
        event["start"] = {"dateTime": start, "timeZone": tz}
    if end is not None:
        tz = timezone or event.get("end", {}).get("timeZone", "UTC")
        event["end"] = {"dateTime": end, "timeZone": tz}
    if attendees is not None:
        event["attendees"] = [{"email": a} for a in attendees]
    updated = service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()
    return {"event_id": updated["id"], "summary": updated.get("summary"),
            "start": updated.get("start"), "end": updated.get("end"),
            "html_link": updated.get("htmlLink"), "status": "updated"}


def delete_event(event_id: str, calendar_id: str = "primary") -> dict[str, Any]:
    _calendar_service().events().delete(calendarId=calendar_id, eventId=event_id).execute()
    return {"event_id": event_id, "status": "deleted"}


def dispatch(tool_name: str, tool_input: dict) -> dict[str, Any]:
    match tool_name:
        case "create_event": return create_event(**tool_input)
        case "list_events":  return list_events(**tool_input)
        case "update_event": return update_event(**tool_input)
        case "delete_event": return delete_event(**tool_input)
        case _: raise ValueError(f"Unknown tool: {tool_name}")
