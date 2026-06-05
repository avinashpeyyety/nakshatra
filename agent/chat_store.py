"""Persist agent chat messages (separate from job trace logs)."""
from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from agent.jobs import DB_PATH, DATA_DIR, _db_lock, _utc_now, init_db

_TABLE_READY = False


def _ensure_table() -> None:
    global _TABLE_READY
    if _TABLE_READY:
        return
    init_db()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS agent_chat (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                run_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_agent_chat_agent
                ON agent_chat(agent_id, created_at);
            """
        )
        conn.commit()
    _TABLE_READY = True


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def append_message(
    agent_id: str,
    role: str,
    content: str,
    *,
    run_id: str | None = None,
) -> dict[str, Any]:
    _ensure_table()
    msg_id = str(uuid.uuid4())
    ts = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO agent_chat (id, agent_id, role, content, created_at, run_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (msg_id, agent_id, role, content, ts, run_id),
            )
            conn.commit()
    return {
        "id": msg_id,
        "agent_id": agent_id,
        "role": role,
        "content": content,
        "created_at": ts,
        "run_id": run_id,
    }


def list_messages(agent_id: str, limit: int = 200) -> list[dict[str, Any]]:
    _ensure_table()
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, agent_id, role, content, created_at, run_id
               FROM agent_chat WHERE agent_id = ? ORDER BY created_at ASC LIMIT ?""",
            (agent_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def clear_messages(agent_id: str) -> None:
    _ensure_table()
    with _db_lock:
        with _connect() as conn:
            conn.execute("DELETE FROM agent_chat WHERE agent_id = ?", (agent_id,))
            conn.commit()


def messages_for_run(run_id: str) -> list[dict[str, Any]]:
    _ensure_table()
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, agent_id, role, content, created_at, run_id
               FROM agent_chat WHERE run_id = ? ORDER BY created_at ASC""",
            (run_id,),
        ).fetchall()
    return [dict(r) for r in rows]
