"""User-writable data dir (outside the app bundle) vs bundled read-only assets."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_BUNDLE_DATA = Path(__file__).resolve().parent / "data"


def bundle_data_dir() -> Path:
    """Read-only shipped data (e.g. places.json)."""
    return _BUNDLE_DATA


def _running_from_app_bundle() -> bool:
    p = str(Path(__file__).resolve())
    return ".app/Contents/Resources" in p or getattr(sys, "frozen", False)


def user_data_dir() -> Path:
    """Per-user writable storage — never inside the .app / install folder."""
    override = os.environ.get("NAKSHATRA_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser()
    if not _running_from_app_bundle():
        # Local git checkout: keep using agent/data for development.
        return _BUNDLE_DATA
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "Nakshatra Chakram"
    elif os.name == "nt":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        base = Path(appdata) / "Nakshatra Chakram"
    else:
        base = Path.home() / ".local" / "share" / "nakshatra-chakram"
    return base


def places_catalog_path() -> Path:
    return bundle_data_dir() / "places.json"


def default_server_port() -> int:
    """Dev uses 8000; shipped .app / .exe use 8765 so it never attaches to a dev server."""
    if _running_from_app_bundle():
        return 8765
    override = os.environ.get("NAKSHATRA_PORT", "").strip()
    if override.isdigit():
        return int(override)
    return 8000