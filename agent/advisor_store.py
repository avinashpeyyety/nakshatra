"""Persist advisor reports and chat history (user data dir SQLite)."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from typing import Any

from agent.jobs import DATA_DIR, DB_PATH, _db_lock, _utc_now

_READY = False


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def ensure_tables() -> None:
    global _READY
    if _READY:
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _db_lock:
        with _connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS advisor_reports (
                    fingerprint TEXT PRIMARY KEY,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    place TEXT NOT NULL,
                    ayanamsa TEXT NOT NULL,
                    digest_text TEXT NOT NULL,
                    report_text TEXT NOT NULL,
                    model TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS advisor_chat (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fingerprint TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_advisor_chat_fp
                    ON advisor_chat(fingerprint, id);
                """
            )
            conn.commit()
    _READY = True


def get_report(fingerprint: str) -> dict[str, Any] | None:
    ensure_tables()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM advisor_reports WHERE fingerprint = ?",
            (fingerprint,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def save_report(
    fingerprint: str,
    *,
    date: str,
    time: str,
    place: str,
    ayanamsa: str,
    digest_text: str,
    report_text: str,
    model: str | None,
) -> dict[str, Any]:
    ensure_tables()
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO advisor_reports
                  (fingerprint, date, time, place, ayanamsa, digest_text,
                   report_text, model, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(fingerprint) DO UPDATE SET
                  digest_text = excluded.digest_text,
                  report_text = excluded.report_text,
                  model = excluded.model,
                  updated_at = excluded.updated_at
                """,
                (
                    fingerprint,
                    date,
                    time,
                    place,
                    ayanamsa,
                    digest_text,
                    report_text,
                    model or "",
                    now,
                    now,
                ),
            )
            conn.commit()
    return get_report(fingerprint)  # type: ignore[return-value]


def list_chat(fingerprint: str, limit: int = 40) -> list[dict[str, str]]:
    ensure_tables()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT role, content FROM advisor_chat
            WHERE fingerprint = ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (fingerprint, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def append_chat(fingerprint: str, role: str, content: str) -> None:
    ensure_tables()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO advisor_chat (fingerprint, role, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (fingerprint, role, content, _utc_now()),
            )
            conn.commit()


def clear_chat(fingerprint: str) -> None:
    ensure_tables()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                "DELETE FROM advisor_chat WHERE fingerprint = ?",
                (fingerprint,),
            )
            conn.commit()
