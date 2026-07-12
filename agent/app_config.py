"""
Runtime product vs admin configuration.

Editions:
  lite    — chart math only (default shipped product)
  advisor — lite + local Ornith 9B report/chat via Ollama

Shipped builds: NAKSHATRA_ADMIN unset or 0 (default).
Developer / operator builds: NAKSHATRA_ADMIN=1 enables Jobs & Agents UI and APIs.
"""
from __future__ import annotations

import os


def admin_enabled() -> bool:
    """True when the admin panel (Jobs & Agents) and its APIs are active."""
    return os.environ.get("NAKSHATRA_ADMIN", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _edition_from_file() -> str | None:
    """Packaged builds write agent/edition.txt (lite|advisor)."""
    try:
        from pathlib import Path

        p = Path(__file__).resolve().parent / "edition.txt"
        if p.is_file():
            val = p.read_text(encoding="utf-8").strip().lower()
            if val in ("lite", "advisor"):
                return val
    except OSError:
        pass
    return None


def product_edition() -> str:
    """Return 'lite' or 'advisor'."""
    raw = (
        os.environ.get("NAKSHATRA_EDITION")
        or os.environ.get("NAKSHATRA_PRODUCT")
        or _edition_from_file()
        or "lite"
    ).strip().lower()
    if raw in ("advisor", "full", "llm", "ornith"):
        return "advisor"
    return "lite"


def advisor_enabled() -> bool:
    return product_edition() == "advisor"


def app_config() -> dict:
    from agent.geocode import allow_online_geocode, catalog_stats, offline_mode

    stats = catalog_stats()
    edition = product_edition()
    cfg: dict = {
        "admin_enabled": admin_enabled(),
        "edition": edition,
        "advisor_enabled": edition == "advisor",
        "product_surface": "chart",
        "offline_mode": offline_mode(),
        "allow_online_geocode": allow_online_geocode(),
        "places_catalog_count": stats.get("count", 0),
    }
    if edition == "advisor":
        try:
            from agent.local_llm import advisor_status

            cfg["llm"] = advisor_status()
        except Exception as exc:
            cfg["llm"] = {
                "provider": "ollama",
                "ready": False,
                "error": str(exc),
            }
    else:
        cfg["llm"] = {"provider": None, "ready": False, "enabled": False}
    return cfg
