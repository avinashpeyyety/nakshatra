"""Named birth charts — persisted in SQLite."""
from __future__ import annotations

import re
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any

from agent.jobs import (
    DATA_DIR,
    DB_PATH,
    WATCH_PROFILE_PATH,
    _db_lock,
    _utc_now,
    get_watch_profile,
    save_watch_profile,
)

_TABLE_READY = False
ACTIVE_CHART_KEY = "active_chart_id"

# HTML <input type="time"> accepts HH:MM or HH:MM:SS only.
_TIME_RE = re.compile(
    r"^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$"
)


def normalize_time(value: str | None, default: str = "12:00") -> str:
    """Normalize birth time to zero-padded HH:MM for storage and HTML inputs."""
    if value is None:
        return default
    s = str(value).strip()
    if not s:
        return default
    m = _TIME_RE.match(s)
    if not m:
        return default
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return default
    return f"{h:02d}:{mi:02d}"


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _ensure_tables() -> None:
    global _TABLE_READY
    if _TABLE_READY:
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS saved_charts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                place TEXT NOT NULL,
                ayanamsa TEXT NOT NULL DEFAULT 'lahiri',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_saved_charts_name ON saved_charts(name);
            """
        )
        cols = {r[1] for r in conn.execute("PRAGMA table_info(saved_charts)").fetchall()}
        if "ayanamsa" not in cols:
            conn.execute(
                "ALTER TABLE saved_charts ADD COLUMN ayanamsa TEXT NOT NULL DEFAULT 'lahiri'"
            )
        conn.commit()
    # Mark ready before repair/migrate so nested get_chart/list do not recurse.
    _TABLE_READY = True
    _migrate_watch_profile()
    _normalize_stored_times()
    _repair_active_id()


def _get_setting(key: str) -> str | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = ?", (key,)
        ).fetchone()
    return row["value"] if row else None


def _set_setting(key: str, value: str) -> None:
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO app_settings (key, value) VALUES (?, ?)
                   ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
                (key, value),
            )
            conn.commit()


def _clear_watch_profile() -> None:
    """Remove stale watch profile when no saved charts remain."""
    try:
        if WATCH_PROFILE_PATH.exists():
            WATCH_PROFILE_PATH.unlink()
    except OSError:
        pass


def _repair_active_id() -> None:
    """If active_id is missing/orphan but charts exist, promote first chart."""
    active_id = _get_setting(ACTIVE_CHART_KEY)
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id FROM saved_charts ORDER BY name COLLATE NOCASE ASC"
        ).fetchall()
    if not rows:
        if active_id:
            _set_setting(ACTIVE_CHART_KEY, "")
        return
    ids = {r["id"] for r in rows}
    if active_id and active_id in ids:
        return
    # Prefer previous watch name match is unnecessary — first by name is fine.
    first_id = rows[0]["id"]
    _set_setting(ACTIVE_CHART_KEY, first_id)
    chart = get_chart(first_id)
    if chart:
        _sync_watch_from_chart(chart)


def _normalize_stored_times() -> None:
    """One-shot cleanup so legacy rows work with <input type=time>."""
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute("SELECT id, time FROM saved_charts").fetchall()
            dirty = False
            for row in rows:
                norm = normalize_time(row["time"])
                if norm != row["time"]:
                    conn.execute(
                        "UPDATE saved_charts SET time = ? WHERE id = ?",
                        (norm, row["id"]),
                    )
                    dirty = True
            if dirty:
                conn.commit()


def _migrate_watch_profile() -> None:
    """Import legacy watch_profile.json as first saved chart if library is empty."""
    with _connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM saved_charts").fetchone()["n"]
        if count:
            return
        prof = get_watch_profile()
        if not prof or not prof.get("date") or not prof.get("place"):
            return
        chart_id = str(uuid.uuid4())
        now = _utc_now()
        name = (prof.get("name") or "Default").strip() or "Default"
        ayan = (prof.get("ayanamsa") or "lahiri").strip() or "lahiri"
        time = normalize_time(prof.get("time", "12:00"))
        conn.execute(
            """INSERT INTO saved_charts
               (id, name, date, time, place, ayanamsa, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                chart_id,
                name,
                prof["date"],
                time,
                prof["place"].strip(),
                ayan,
                now,
                now,
            ),
        )
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            (ACTIVE_CHART_KEY, chart_id),
        )
        conn.commit()


def _row_to_chart(row: sqlite3.Row, *, active: bool = False) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "date": row["date"],
        "time": normalize_time(row["time"]),
        "place": row["place"],
        "ayanamsa": row["ayanamsa"] if "ayanamsa" in row.keys() else "lahiri",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "active": active,
    }


def _sync_watch_from_chart(chart: dict[str, Any]) -> None:
    save_watch_profile(
        {
            "name": chart["name"],
            "date": chart["date"],
            "time": normalize_time(chart.get("time", "12:00")),
            "place": chart["place"],
            "ayanamsa": chart.get("ayanamsa", "lahiri"),
        }
    )


def list_charts() -> dict[str, Any]:
    _ensure_tables()
    _repair_active_id()
    active_id = _get_setting(ACTIVE_CHART_KEY) or None
    if active_id == "":
        active_id = None
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM saved_charts ORDER BY name COLLATE NOCASE ASC"
        ).fetchall()
    charts = [_row_to_chart(r, active=r["id"] == active_id) for r in rows]
    return {"charts": charts, "active_id": active_id}


def get_chart(chart_id: str) -> dict[str, Any] | None:
    _ensure_tables()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM saved_charts WHERE id = ?", (chart_id,)
        ).fetchone()
    if not row:
        return None
    active_id = _get_setting(ACTIVE_CHART_KEY)
    return _row_to_chart(row, active=row["id"] == active_id)


def get_active_chart() -> dict[str, Any] | None:
    _ensure_tables()
    _repair_active_id()
    active_id = _get_setting(ACTIVE_CHART_KEY)
    if not active_id:
        return None
    return get_chart(active_id)


def create_chart(
    name: str, date: str, time: str, place: str, ayanamsa: str = "lahiri"
) -> dict[str, Any]:
    _ensure_tables()
    name = (name or "").strip() or "Untitled chart"
    place = (place or "").strip()
    if not date or not place:
        raise ValueError("Chart name, date, and place are required")
    chart_id = str(uuid.uuid4())
    now = _utc_now()
    time_n = normalize_time(time)
    ayan = (ayanamsa or "lahiri").strip() or "lahiri"
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO saved_charts
                   (id, name, date, time, place, ayanamsa, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (chart_id, name, date, time_n, place, ayan, now, now),
            )
            conn.commit()
    return set_active_chart(chart_id)


def update_chart(
    chart_id: str,
    *,
    name: str | None = None,
    date: str | None = None,
    time: str | None = None,
    place: str | None = None,
    ayanamsa: str | None = None,
) -> dict[str, Any]:
    _ensure_tables()
    existing = get_chart(chart_id)
    if not existing:
        raise ValueError(f"Chart not found: {chart_id}")
    new_name = (name if name is not None else existing["name"]).strip() or "Untitled chart"
    new_date = date if date is not None else existing["date"]
    new_time = normalize_time(
        time if time is not None else existing["time"]
    )
    new_place = (place if place is not None else existing["place"]).strip()
    new_ayanamsa = (
        ayanamsa if ayanamsa is not None else existing.get("ayanamsa", "lahiri")
    )
    if not new_date or not new_place:
        raise ValueError("Date and place are required")
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """UPDATE saved_charts
                   SET name = ?, date = ?, time = ?, place = ?, ayanamsa = ?, updated_at = ?
                   WHERE id = ?""",
                (new_name, new_date, new_time, new_place, new_ayanamsa, now, chart_id),
            )
            conn.commit()
    chart = get_chart(chart_id)
    if chart and chart.get("active"):
        _sync_watch_from_chart(chart)
    return chart  # type: ignore[return-value]


def delete_chart(chart_id: str) -> None:
    _ensure_tables()
    active_id = _get_setting(ACTIVE_CHART_KEY)
    with _db_lock:
        with _connect() as conn:
            conn.execute("DELETE FROM saved_charts WHERE id = ?", (chart_id,))
            conn.commit()
    remaining = list_charts()["charts"]
    if not remaining:
        _set_setting(ACTIVE_CHART_KEY, "")
        _clear_watch_profile()
        return
    # If we deleted the active chart (or active was already orphan), promote one.
    if active_id == chart_id or not any(c.get("active") for c in remaining):
        set_active_chart(remaining[0]["id"])


def set_active_chart(chart_id: str) -> dict[str, Any]:
    _ensure_tables()
    chart = get_chart(chart_id)
    if not chart:
        raise ValueError(f"Chart not found: {chart_id}")
    _set_setting(ACTIVE_CHART_KEY, chart_id)
    _sync_watch_from_chart(chart)
    chart["active"] = True
    return chart
