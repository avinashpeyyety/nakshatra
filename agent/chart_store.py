"""Named birth charts — persisted in SQLite."""
from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from agent.jobs import DATA_DIR, DB_PATH, _db_lock, _utc_now, get_watch_profile, save_watch_profile

_TABLE_READY = False
ACTIVE_CHART_KEY = "active_chart_id"


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
        conn.commit()
    _migrate_watch_profile()
    _TABLE_READY = True


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
        conn.execute(
            """INSERT INTO saved_charts (id, name, date, time, place, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                chart_id,
                name,
                prof["date"],
                prof.get("time", "12:00"),
                prof["place"].strip(),
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
        "time": row["time"],
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
            "time": chart.get("time", "12:00"),
            "place": chart["place"],
            "ayanamsa": chart.get("ayanamsa", "lahiri"),
        }
    )


def list_charts() -> dict[str, Any]:
    _ensure_tables()
    active_id = _get_setting(ACTIVE_CHART_KEY)
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
    active_id = _get_setting(ACTIVE_CHART_KEY)
    if not active_id:
        return None
    return get_chart(active_id)


def create_chart(name: str, date: str, time: str, place: str, ayanamsa: str = "lahiri") -> dict[str, Any]:
    _ensure_tables()
    name = (name or "").strip() or "Untitled chart"
    place = (place or "").strip()
    if not date or not place:
        raise ValueError("Chart name, date, and place are required")
    chart_id = str(uuid.uuid4())
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO saved_charts (id, name, date, time, place, ayanamsa, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (chart_id, name, date, time or "12:00", place, ayanamsa, now, now),
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
    new_time = time if time is not None else existing["time"]
    new_place = (place if place is not None else existing["place"]).strip()
    new_ayanamsa = ayanamsa if ayanamsa is not None else existing.get("ayanamsa", "lahiri")
    if not new_date or not new_place:
        raise ValueError("Date and place are required")
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """UPDATE saved_charts SET name = ?, date = ?, time = ?, place = ?, ayanamsa = ?, updated_at = ?
                   WHERE id = ?""",
                (new_name, new_date, new_time or "12:00", new_place, new_ayanamsa, now, chart_id),
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
    if active_id == chart_id:
        _set_setting(ACTIVE_CHART_KEY, "")
        remaining = list_charts()["charts"]
        if remaining:
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
