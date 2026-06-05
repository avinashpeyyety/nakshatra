"""
ADMIN ONLY — does not ship. See ARCHITECTURE.md.

LangChain / LangGraph agents — chart advisor and scheduled agent runs.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from agent.jobs import RunTrace, get_watch_profile


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    description: str
    interval_seconds: int
    default_enabled: bool = False


AGENT_REGISTRY: dict[str, AgentSpec] = {
    "chart_advisor": AgentSpec(
        id="chart_advisor",
        name="Chart advisor",
        description=(
            "Chat with your chart (Grok). Fetches positions, transits, dasha, and yogas "
            "from the app's calculator only when needed; interprets on request."
        ),
        interval_seconds=86400,
        default_enabled=False,
    ),
}


def _run_chart_advisor(trace: RunTrace, profile: dict | None = None) -> str:
    from agent.agent_chat import chat_with_agent_traced, resolve_profile

    try:
        prof = resolve_profile(profile)
    except ValueError as exc:
        trace.log(str(exc), "warn")
        return f"Skipped: {exc}"

    trace.log(
        f"Chart advisor for {prof['date']} {prof['time']} @ {prof['place']}",
        "info",
    )
    return chat_with_agent_traced(
        "chart_advisor",
        "Give me an overview of my chart themes, current transits, and practical recommendations.",
        trace,
        profile=prof,
    )


_AGENT_RUNNERS: dict[str, Callable[..., str]] = {
    "chart_advisor": lambda trace, profile=None: _run_chart_advisor(trace, profile),
}


def execute_agent(
    agent_id: str,
    trace: RunTrace,
    profile: dict | None = None,
) -> str:
    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {agent_id}")
    return _AGENT_RUNNERS[agent_id](trace, profile=profile)
