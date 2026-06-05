"""
ADMIN ONLY — does not ship. See ARCHITECTURE.md.

LangGraph / LangChain chart advisor — tool-backed chat (calculations on demand).
"""
from __future__ import annotations

import agent.env  # noqa: F401 — load workspace .env (XAI_API_KEY, etc.)

import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from agent.chart_tools import ChartSession, make_chart_tools

XAI_BASE_URL = "https://api.x.ai/v1"
MAX_TOOL_ROUNDS = 10

ADVISOR_SYSTEM = """You are a Vedic astrology advisor for this app (Lahiri sidereal, whole-sign houses, Swiss Ephemeris).

RULES:
1. NEVER invent planetary positions, houses, dasha dates, transits, or yogas. Use tools for all factual data.
2. Call tools only when needed to answer the user's question — do not fetch the whole chart upfront.
3. Match tools to the request:
   - positions / houses / nakshatra → get_natal_planetary_positions
   - lagna / ayanamsa (mode/value) / place → get_birth_chart_basics
   - ayanamsa choice affects all positions/vargas/dashas/shadbala → specify in birth details when calling calculate via UI or tools
   - dasha / periods → get_vimshottari_dasha_periods
   - today's transits / gochara / sade sati → get_gochara_transit_alerts or get_current_transiting_positions
   - transits on a specific date → get_transiting_positions_at
   - yogas → get_detected_yogas
   - ashtakavarga (full BAV) → get_ashtakavarga_scores
   - shadbala strengths → get_shadbala
   - vimshottari dasha → get_vimshottari_dasha_periods
   - chara dasha (Jaimini) → get_chara_dasha_periods
   - dasha-period transit forecast → get_dasha_period_transit_forecast
   - navamsa D9 → get_navamsa_d9_positions
   - drekkana D3 → get_drekkana_d3_positions
   - dasamsa D10 (career) → get_dasamsa_d10_positions
   - hora D2 (wealth) → get_hora_d2_positions
   - saptamsa D7 (children) → get_saptamsa_d7_positions
   - dwadasamsa D12 (parents) → get_dwadasamsa_d12_positions
   - trimsamsa D30 (evils/health) → get_trimsamsa_d30_positions
   - chaturthamsa D4 (property/vehicles) → get_chaturthamsa_d4_positions
   - shodashamsa D16 (comforts) → get_shodashamsa_d16_positions
   - vimsamsa D20 (spiritual) → get_vimsamsa_d20_positions
   - chaturvimshamsa D24 (learning) → get_chaturvimshamsa_d24_positions
   - nakshatramsa D27 (strength) → get_nakshatramsa_d27_positions
   - khavedamsa D40 (maternal) → get_khavedamsa_d40_positions
   - akshavedamsa D45 (paternal) → get_akshavedamsa_d45_positions
   - shashtiamsa D60 (karma) → get_shashtiamsa_d60_positions
   - chara karakas → get_chara_karakas
   - nakshatra table → get_nakshatra_occupants
4. When interpreting strengths, combine Shadbala totals with Saptavargaja vargas and BAV for nuanced view of planetary power in transits or dashas.
5. INTERPRETATION: Only when the user asks for meaning, advice, themes, or "what does this mean". For pure calculation questions, present tool results clearly and concisely without long interpretation.
5. If birth details are missing from context, ask the user to set the watch profile.

Birth profile for this session: {birth_line}
"""


def _get_llm():
    xai_key = os.environ.get("XAI_API_KEY", "").strip()
    if xai_key:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("MODEL_NAME", "grok-3-mini-fast"),
            base_url=os.environ.get("XAI_BASE_URL", XAI_BASE_URL),
            api_key=xai_key,
            temperature=0.4,
        )
    if os.environ.get("OPENAI_API_KEY", "").strip():
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.4,
        )
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            temperature=0.4,
        )
    raise RuntimeError(
        "No LLM configured — set XAI_API_KEY (Grok), OPENAI_API_KEY, or ANTHROPIC_API_KEY"
    )


def _tool_map(tools: list) -> dict[str, Any]:
    return {t.name: t for t in tools}


def _invoke_tools(ai: AIMessage, tools_by_name: dict[str, Any]) -> list[ToolMessage]:
    out: list[ToolMessage] = []
    for call in ai.tool_calls or []:
        name = call["name"]
        args = call.get("args") or {}
        tool = tools_by_name.get(name)
        if not tool:
            content = f"Unknown tool: {name}"
        else:
            try:
                content = tool.invoke(args)
            except Exception as exc:
                content = f"Tool error ({name}): {exc}"
        out.append(
            ToolMessage(content=str(content), tool_call_id=call["id"], name=name)
        )
    return out


def chat_chart_advisor(
    date: str,
    time: str,
    place: str,
    messages: list[dict[str, str]],
    ayanamsa: str = "lahiri",
) -> str:
    """Multi-turn chat; calculations via app tools only when the model requests them."""
    session = ChartSession(date=date, time=time or "12:00", place=place.strip(), ayanamsa=ayanamsa)
    tools = make_chart_tools(session)
    tools_by_name = _tool_map(tools)
    llm = _get_llm().bind_tools(tools)

    birth_line = f"{session.date} {session.time} @ {session.place}"
    lc_messages: list = [
        SystemMessage(content=ADVISOR_SYSTEM.format(birth_line=birth_line))
    ]

    for m in messages:
        role = m.get("role", "")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "user":
            lc_messages.append(HumanMessage(content=content))

    if not any(isinstance(msg, HumanMessage) for msg in lc_messages):
        lc_messages.append(
            HumanMessage(
                content=(
                    "What can you help me with regarding my chart? "
                    "Briefly list the kinds of calculations and interpretations you can provide."
                )
            )
        )

    for _ in range(MAX_TOOL_ROUNDS):
        ai = llm.invoke(lc_messages)
        lc_messages.append(ai)
        if not ai.tool_calls:
            return ai.content if hasattr(ai, "content") else str(ai)
        lc_messages.extend(_invoke_tools(ai, tools_by_name))

    return (
        "I needed more calculation steps than allowed. "
        "Please ask a more specific question (e.g. one topic: dasha, transits, or a single planet)."
    )


def run_chart_advisor(date: str, time: str, place: str) -> dict[str, Any]:
    """Scheduled / manual run entry — same tool-backed chat with an overview prompt."""
    text = chat_chart_advisor(
        date,
        time,
        place,
        [
            {
                "role": "user",
                "content": (
                    "Using the calculation tools as needed, summarize my chart: "
                    "Lagna and key planetary placements, current Vimshottari dasha, "
                    "and any major gochara alerts today. Then give practical themes only "
                    "where relevant."
                ),
            }
        ],
    )
    return {"recommendations": text, "chart_summary": ""}
