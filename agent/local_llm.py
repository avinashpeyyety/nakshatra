"""
Local LLM client for Advisor edition — Ollama (Ornith 9B by default).

No cloud keys required. Chart math always comes from calculator digests.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
# Prefer tags the user already has; try in order.
DEFAULT_MODEL_CANDIDATES = (
    "ornith:9b",
    "ornith-9b",
    "ornith:latest",
    "ornith",
)


def ollama_base_url() -> str:
    return (
        os.environ.get("NAKSHATRA_OLLAMA_URL")
        or os.environ.get("OLLAMA_HOST")
        or DEFAULT_OLLAMA_URL
    ).rstrip("/")


def configured_model() -> str:
    return (os.environ.get("NAKSHATRA_LLM_MODEL") or "").strip()


def _http_json(method: str, url: str, body: dict | None = None, timeout: float = 30.0) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def list_ollama_models() -> list[str]:
    base = ollama_base_url()
    try:
        payload = _http_json("GET", f"{base}/api/tags", timeout=5.0)
    except Exception:
        return []
    models = []
    for m in payload.get("models") or []:
        name = m.get("name") or m.get("model") or ""
        if name:
            models.append(name)
    return models


def resolve_model(available: list[str] | None = None) -> str | None:
    """Pick configured model or first matching candidate present in Ollama."""
    available = available if available is not None else list_ollama_models()
    # Normalize: ollama may list "ornith:9b" or "ornith:9b-q4_0"
    names = available
    names_lower = [n.lower() for n in names]

    forced = configured_model()
    if forced:
        if not names:
            return forced  # hope pull works later
        for n in names:
            if n == forced or n.startswith(forced + "-") or n.startswith(forced + ":"):
                return n
        # substring match
        fl = forced.lower()
        for n, nl in zip(names, names_lower):
            if fl in nl:
                return n
        return forced

    for cand in DEFAULT_MODEL_CANDIDATES:
        cl = cand.lower()
        for n, nl in zip(names, names_lower):
            if nl == cl or nl.startswith(cl + "-") or nl.split(":")[0] == cl.split(":")[0]:
                # Prefer exact tag match when possible
                if nl == cl or n.startswith(cand):
                    return n
        for n, nl in zip(names, names_lower):
            if "ornith" in nl and "9b" in nl:
                return n
        for n, nl in zip(names, names_lower):
            if nl.startswith("ornith"):
                return n
    return names[0] if names else None


def advisor_status() -> dict[str, Any]:
    base = ollama_base_url()
    models = list_ollama_models()
    model = resolve_model(models)
    ready = bool(models and model)
    err = None
    if not models:
        err = (
            f"Ollama not reachable at {base}. "
            "Install Ollama, run it, then: ollama pull ornith:9b"
        )
    elif not model:
        err = "No suitable model found. Run: ollama pull ornith:9b"
    return {
        "provider": "ollama",
        "ollama_url": base,
        "model": model,
        "models": models[:30],
        "ready": ready,
        "error": err,
        "default_candidates": list(DEFAULT_MODEL_CANDIDATES),
    }


REPORT_SYSTEM = """You are the on-device Vedic (Jyotish) chart reporter for Nakshatra Chakram.
You receive a CALCULATOR-GROUNDED chart digest. Rules:
1. NEVER invent planetary positions, houses, dasha dates, yogas, shadbala, or ashtakavarga numbers.
2. Only use facts present in the digest. If something is missing, say so.
3. Sidereal whole-sign houses; ayanamsa as stated in the digest.
4. Write a complete structured report covering:
   - Lagna & overall chart signature
   - Key planetary placements (sign, house, nakshatra)
   - Vargas (especially D9 marriage/partnership, D10 career, D7 children, others briefly)
   - Shadbala strengths
   - Ashtakavarga (sarva / BAV themes)
   - Vimshottari & Chara dasha (current periods)
   - Detected yogas
   - Gochara / transit notes if present
5. Be concise but complete. Use short headings. Educational only — not medical, legal, or financial advice.
6. End with 3–5 practical themes for study (not predictions of fixed fate).
"""

CHAT_SYSTEM = """You are the on-device Vedic chart advisor for Nakshatra Chakram.
You answer follow-up questions using the provided chart digest and prior report.
Rules:
1. NEVER invent ephemeris, dasha dates, or scores — only use the digest/report.
2. If the user asks for data not in the digest, say it is not in the calculator output.
3. Educational only — not medical/legal/financial advice.
4. Prefer clear, short answers. Reference specific digest facts (planet-sign-house, dasha, varga).
"""


def chat_ollama(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.35,
    timeout: float = 300.0,
) -> str:
    """Non-streaming chat via Ollama /api/chat."""
    st = advisor_status()
    use_model = model or st.get("model")
    if not use_model:
        raise RuntimeError(st.get("error") or "No local model available")
    base = ollama_base_url()
    body = {
        "model": use_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    try:
        payload = _http_json(
            "POST", f"{base}/api/chat", body=body, timeout=timeout
        )
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc
    except TimeoutError as exc:
        raise RuntimeError("Ollama request timed out") from exc

    msg = payload.get("message") or {}
    content = msg.get("content")
    if not content and payload.get("response"):
        content = payload["response"]
    if not content:
        raise RuntimeError(f"Empty model response: {payload!r}"[:400])
    return str(content).strip()


def generate_full_report(digest_text: str, *, model: str | None = None) -> str:
    messages = [
        {"role": "system", "content": REPORT_SYSTEM},
        {
            "role": "user",
            "content": (
                "Write the complete chart report from this digest only.\n\n"
                + digest_text
            ),
        },
    ]
    return chat_ollama(messages, model=model, temperature=0.3)


def answer_followup(
    digest_text: str,
    report: str | None,
    history: list[dict[str, str]],
    user_message: str,
    *,
    model: str | None = None,
) -> str:
    system = CHAT_SYSTEM + "\n\n--- CHART DIGEST ---\n" + digest_text
    if report:
        system += "\n\n--- PRIOR REPORT ---\n" + report[:12000]
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for m in history[-12:]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message.strip()})
    return chat_ollama(messages, model=model, temperature=0.4)
