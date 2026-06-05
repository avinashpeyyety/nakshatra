"""
Runtime product vs admin configuration.

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


def app_config() -> dict:
    from agent.geocode import allow_online_geocode, catalog_stats, offline_mode

    stats = catalog_stats()
    return {
        "admin_enabled": admin_enabled(),
        "product_surface": "chart",
        "offline_mode": offline_mode(),
        "allow_online_geocode": allow_online_geocode(),
        "places_catalog_count": stats.get("count", 0),
    }