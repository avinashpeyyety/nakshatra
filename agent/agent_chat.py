"""ADMIN ONLY — chart advisor chat orchestration. See ARCHITECTURE.md."""
from __future__ import annotations

from typing import Any

from agent.agents import AGENT_REGISTRY
from agent.chat_store import append_message, clear_messages, list_messages
from agent.jobs import RunTrace, get_watch_profile


def resolve_profile(
    profile: dict | None = None,
    *,
    date: str | None = None,
    time: str | None = None,
    place: str | None = None,
) -> dict[str, str]:
    if date and place:
        return {
            "date": date,
            "time": time or "12:00",
            "place": place.strip(),
            "ayanamsa": "lahiri",
        }
    if profile and profile.get("date") and profile.get("place"):
        return {
            "date": profile["date"],
            "time": profile.get("time", "12:00"),
            "place": (profile.get("place") or "").strip(),
            "name": (profile.get("name") or "").strip(),
            "ayanamsa": profile.get("ayanamsa", "lahiri"),
        }
    from agent.chart_store import get_active_chart

    active = get_active_chart()
    if active and active.get("date") and active.get("place"):
        return {
            "date": active["date"],
            "time": active.get("time", "12:00"),
            "place": active["place"].strip(),
            "name": active.get("name", ""),
            "ayanamsa": active.get("ayanamsa", "lahiri"),
        }
    prof = get_watch_profile()
    if prof and prof.get("date") and prof.get("place"):
        return {
            "date": prof["date"],
            "time": prof.get("time", "12:00"),
            "place": (prof.get("place") or "").strip(),
            "name": (prof.get("name") or "").strip(),
            "ayanamsa": prof.get("ayanamsa", "lahiri"),
        }
    raise ValueError(
        "Birth profile required — save a named chart or set watch profile."
    )


def get_chat_history(agent_id: str) -> list[dict[str, Any]]:
    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {agent_id}")
    return list_messages(agent_id)


def chat_with_agent(
    agent_id: str,
    user_message: str,
    *,
    profile: dict | None = None,
    date: str | None = None,
    time: str | None = None,
    place: str | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {agent_id}")

    text = (user_message or "").strip()
    if not text:
        raise ValueError("Message cannot be empty")

    prof = resolve_profile(profile, date=date, time=time, place=place)
    history = list_messages(agent_id)
    prior = [{"role": m["role"], "content": m["content"]} for m in history]
    prior.append({"role": "user", "content": text})

    append_message(agent_id, "user", text, run_id=run_id)

    if agent_id == "chart_advisor":
        from agent.chart_advisor import chat_chart_advisor

        reply = chat_chart_advisor(
            prof["date"],
            prof["time"],
            prof["place"],
            prior,
            ayanamsa=prof.get("ayanamsa", "lahiri"),
        )
    else:
        raise ValueError(f"No chat handler for agent: {agent_id}")

    assistant_row = append_message(agent_id, "assistant", reply, run_id=run_id)
    return {
        "agent_id": agent_id,
        "message": assistant_row,
        "profile": prof,
    }


def chat_with_agent_traced(
    agent_id: str,
    user_message: str,
    trace: RunTrace,
    profile: dict | None = None,
) -> str:
    result = chat_with_agent(
        agent_id,
        user_message,
        profile=profile,
        run_id=trace.run_id,
    )
    trace.log_chat("user", user_message)
    trace.log_chat("assistant", result["message"]["content"])
    preview = result["message"]["content"][:120].replace("\n", " ")
    if len(result["message"]["content"]) > 120:
        preview += "…"
    return f"OK — {preview}"


def reset_chat(agent_id: str) -> None:
    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {agent_id}")
    clear_messages(agent_id)
