"""
ADMIN ONLY — does not ship. See ARCHITECTURE.md.

Background jobs: registry, SQLite run history, trace log, APScheduler.
Used by the Jobs & Agents tab (gochara_scan, health_ping, etc.).
"""
from __future__ import annotations

import json
import sqlite3
import threading
import traceback
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from agent.data_paths import user_data_dir

DATA_DIR = user_data_dir()
DB_PATH = DATA_DIR / "jobs.db"
WATCH_PROFILE_PATH = DATA_DIR / "watch_profile.json"

_db_lock = threading.Lock()
_scheduler_stop = threading.Event()
_scheduler_thread: threading.Thread | None = None


@dataclass(frozen=True)
class JobSpec:
    id: str
    name: str
    description: str
    interval_seconds: int
    default_enabled: bool = False


JOB_REGISTRY: dict[str, JobSpec] = {
    "gochara_scan": JobSpec(
        id="gochara_scan",
        name="Gochara transit scan",
        description="Checks current transits against the saved watch profile and logs consequential alerts.",
        interval_seconds=3600,
        default_enabled=False,
    ),
    "health_ping": JobSpec(
        id="health_ping",
        name="Scheduler health ping",
        description="Lightweight job to verify the scheduler and run logging pipeline.",
        interval_seconds=300,
        default_enabled=False,
    ),
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_utc(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def _migrate_schema(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(job_config)").fetchall()}
    if "kind" not in cols:
        conn.execute("ALTER TABLE job_config ADD COLUMN kind TEXT NOT NULL DEFAULT 'job'")


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS job_config (
                job_id TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'job'
            );
            CREATE TABLE IF NOT EXISTS job_runs (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                summary TEXT,
                error TEXT
            );
            CREATE TABLE IF NOT EXISTS job_trace (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                seq INTEGER NOT NULL,
                ts TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES job_runs(id)
            );
            CREATE INDEX IF NOT EXISTS idx_runs_job ON job_runs(job_id, started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_trace_run ON job_trace(run_id, seq);
            """
        )
        _migrate_schema(conn)
        for spec in JOB_REGISTRY.values():
            row = conn.execute(
                "SELECT 1 FROM job_config WHERE job_id = ?", (spec.id,)
            ).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO job_config (job_id, enabled, updated_at, kind) VALUES (?, ?, ?, 'job')",
                    (spec.id, 1 if spec.default_enabled else 0, _utc_now()),
                )
        from agent.agents import AGENT_REGISTRY

        for spec in AGENT_REGISTRY.values():
            row = conn.execute(
                "SELECT 1 FROM job_config WHERE job_id = ?", (spec.id,)
            ).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO job_config (job_id, enabled, updated_at, kind) VALUES (?, ?, ?, 'agent')",
                    (spec.id, 1 if spec.default_enabled else 0, _utc_now()),
                )
        conn.commit()


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


class RunTrace:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self._seq = 0

    def log(self, message: str, level: str = "info") -> None:
        self._seq += 1
        with _db_lock:
            with _connect() as conn:
                conn.execute(
                    "INSERT INTO job_trace (run_id, seq, ts, level, message) VALUES (?, ?, ?, ?, ?)",
                    (self.run_id, self._seq, _utc_now(), level, message),
                )
                conn.commit()

    def log_chat(self, role: str, content: str) -> None:
        """Record a chat bubble in the run trace (agents)."""
        self.log(content, level=f"chat_{role}")


def _start_run(job_id: str) -> tuple[str, RunTrace]:
    run_id = str(uuid.uuid4())
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO job_runs (id, job_id, status, started_at, summary, error)
                   VALUES (?, ?, 'running', ?, NULL, NULL)""",
                (run_id, job_id, _utc_now()),
            )
            conn.commit()
    return run_id, RunTrace(run_id)


def _finish_run(run_id: str, status: str, summary: str, error: str | None = None) -> None:
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """UPDATE job_runs SET status = ?, finished_at = ?, summary = ?, error = ?
                   WHERE id = ?""",
                (status, _utc_now(), summary, error, run_id),
            )
            conn.commit()


def get_watch_profile() -> dict | None:
    if not WATCH_PROFILE_PATH.exists():
        return None
    try:
        return json.loads(WATCH_PROFILE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_watch_profile(profile: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    WATCH_PROFILE_PATH.write_text(json.dumps(profile, indent=2), encoding="utf-8")


def _run_gochara_scan(trace: RunTrace) -> str:
    profile = get_watch_profile()
    if not profile:
        trace.log("No watch profile configured — set birth details on the Jobs tab.", "warn")
        return "Skipped: no watch profile"

    date = profile.get("date")
    time = profile.get("time", "12:00")
    place = profile.get("place", "").strip()
    if not date or not place:
        trace.log("Watch profile incomplete (need date and place).", "warn")
        return "Skipped: incomplete profile"

    trace.log(f"Loading chart for {date} {time} @ {place}")
    from agent.calculator import calculate_chart

    ayan = profile.get("ayanamsa", "lahiri")
    result = calculate_chart(date, time, place, ayanamsa=ayan)
    gochara = result.get("gochara") or {}
    alerts = gochara.get("alerts") or []
    trace.log(f"Computed {len(alerts)} active gochara alert(s)")

    major = [a for a in alerts if a.get("severity") in ("critical", "major")]
    trace.log(f"Consequential (critical/major): {len(major)}", "info" if major else "debug")

    for a in major[:8]:
        trace.log(
            f"  • {a.get('type', '?')} — {a.get('planet', '')} {a.get('sign', '')} "
            f"({a.get('house_from', '')}) [{a.get('severity', '')}]",
            "info",
        )
    if len(major) > 8:
        trace.log(f"  … and {len(major) - 8} more", "debug")

    if not major:
        for a in alerts[:5]:
            trace.log(
                f"  • {a.get('type', '?')} [{a.get('severity', 'info')}]",
                "debug",
            )

    email_note = ""
    try:
        from agent.email_service import maybe_send_gochara_email

        sent = maybe_send_gochara_email(
            alerts,
            profile={"date": date, "time": time, "place": place},
            trace_log=lambda msg, level="info": trace.log(msg, level),
        )
        if sent:
            email_note = f"; {sent}"
    except Exception as exc:
        trace.log(f"Email error: {exc}", "error")

    return f"OK — {len(major)} consequential / {len(alerts)} total alerts{email_note}"


def _run_health_ping(trace: RunTrace) -> str:
    trace.log("Scheduler and database reachable")
    trace.log(f"UTC now: {_utc_now()}")
    return "OK — ping"


_RUNNERS: dict[str, Callable[[RunTrace], str]] = {
    "gochara_scan": _run_gochara_scan,
    "health_ping": _run_health_ping,
}


def execute_task(
    task_id: str,
    kind: str,
    trigger: str = "manual",
    profile: dict | None = None,
) -> dict[str, Any]:
    if kind not in ("job", "agent"):
        raise ValueError(f"Invalid kind: {kind}")

    st = _task_state_by_id(task_id)
    if st["state"] == "running":
        raise RuntimeError(f"Task {task_id} is already running")

    run_id, trace = _start_run(task_id)
    trace.log(f"Run started ({trigger}, {kind})", "info")
    try:
        if kind == "job":
            if task_id not in _RUNNERS:
                raise ValueError(f"Unknown job: {task_id}")
            summary = _RUNNERS[task_id](trace)
        else:
            from agent.agents import execute_agent

            summary = execute_agent(task_id, trace, profile=profile)
        trace.log(f"Finished: {summary}", "info")
        _finish_run(run_id, "success", summary)
        return {
            "run_id": run_id,
            "status": "success",
            "summary": summary,
            "kind": kind,
            "task_id": task_id,
        }
    except Exception as exc:
        tb = traceback.format_exc()
        trace.log(str(exc), "error")
        trace.log(tb, "debug")
        _finish_run(run_id, "failed", "Run failed", str(exc))
        return {
            "run_id": run_id,
            "status": "failed",
            "error": str(exc),
            "kind": kind,
            "task_id": task_id,
        }


def execute_job(job_id: str, trigger: str = "manual") -> dict[str, Any]:
    if job_id not in JOB_REGISTRY:
        raise ValueError(f"Unknown job: {job_id}")
    return execute_task(job_id, "job", trigger=trigger)


def _task_state(spec: Any, kind: str) -> dict[str, Any]:
    task_id = spec.id
    with _connect() as conn:
        cfg = conn.execute(
            "SELECT enabled, updated_at, kind FROM job_config WHERE job_id = ?",
            (task_id,),
        ).fetchone()
        last = conn.execute(
            """SELECT id, status, started_at, finished_at, summary
               FROM job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 1""",
            (task_id,),
        ).fetchone()
        running = conn.execute(
            "SELECT id, started_at FROM job_runs WHERE job_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1",
            (task_id,),
        ).fetchone()

    enabled = bool(cfg["enabled"]) if cfg else spec.default_enabled
    state = "disabled"
    if enabled:
        state = "running" if running else "idle"
        if last and last["status"] == "failed" and not running:
            state = "error"

    return {
        "id": task_id,
        "kind": kind,
        "name": spec.name,
        "description": spec.description,
        "enabled": enabled,
        "interval_seconds": spec.interval_seconds,
        "state": state,
        "updated_at": cfg["updated_at"] if cfg else None,
        "last_run": dict(last) if last else None,
        "running_run": dict(running) if running else None,
    }


def _task_state_by_id(task_id: str) -> dict[str, Any]:
    if task_id in JOB_REGISTRY:
        return _task_state(JOB_REGISTRY[task_id], "job")
    from agent.agents import AGENT_REGISTRY

    if task_id in AGENT_REGISTRY:
        return _task_state(AGENT_REGISTRY[task_id], "agent")
    raise ValueError(f"Unknown task: {task_id}")


def _job_state(job_id: str) -> dict[str, Any]:
    return _task_state(JOB_REGISTRY[job_id], "job")


def list_jobs() -> list[dict[str, Any]]:
    init_db()
    return [_task_state(JOB_REGISTRY[jid], "job") for jid in JOB_REGISTRY]


def list_tasks() -> list[dict[str, Any]]:
    init_db()
    from agent.agents import AGENT_REGISTRY

    jobs = [_task_state(JOB_REGISTRY[jid], "job") for jid in JOB_REGISTRY]
    agents = [_task_state(AGENT_REGISTRY[aid], "agent") for aid in AGENT_REGISTRY]
    return jobs + agents


def set_task_enabled(task_id: str, kind: str, enabled: bool) -> dict[str, Any]:
    _task_state_by_id(task_id)
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                "UPDATE job_config SET enabled = ?, updated_at = ?, kind = ? WHERE job_id = ?",
                (1 if enabled else 0, _utc_now(), kind, task_id),
            )
            conn.commit()
    return _task_state_by_id(task_id)


def set_job_enabled(job_id: str, enabled: bool) -> dict[str, Any]:
    if job_id not in JOB_REGISTRY:
        raise ValueError(f"Unknown job: {job_id}")
    return set_task_enabled(job_id, "job", enabled)


def set_agent_enabled(agent_id: str, enabled: bool) -> dict[str, Any]:
    from agent.agents import AGENT_REGISTRY

    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {agent_id}")
    return set_task_enabled(agent_id, "agent", enabled)


def list_runs(job_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        if job_id:
            rows = conn.execute(
                """SELECT r.id, r.job_id, r.status, r.started_at, r.finished_at, r.summary, r.error,
                          COALESCE(c.kind, 'job') AS kind
                   FROM job_runs r
                   LEFT JOIN job_config c ON c.job_id = r.job_id
                   WHERE r.job_id = ? ORDER BY r.started_at DESC LIMIT ?""",
                (job_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT r.id, r.job_id, r.status, r.started_at, r.finished_at, r.summary, r.error,
                          COALESCE(c.kind, 'job') AS kind
                   FROM job_runs r
                   LEFT JOIN job_config c ON c.job_id = r.job_id
                   ORDER BY r.started_at DESC LIMIT ?""",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def get_run(run_id: str) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        run = conn.execute("SELECT * FROM job_runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            return None
        trace = conn.execute(
            "SELECT seq, ts, level, message FROM job_trace WHERE run_id = ? ORDER BY seq",
            (run_id,),
        ).fetchall()
    out = dict(run)
    trace_rows = [dict(t) for t in trace]
    out["trace"] = trace_rows
    from agent.chat_store import messages_for_run

    stored = messages_for_run(run_id)
    if stored:
        out["messages"] = [
            {"role": m["role"], "content": m["content"], "ts": m["created_at"]}
            for m in stored
        ]
    else:
        out["messages"] = [
            {
                "role": t["level"].replace("chat_", ""),
                "content": t["message"],
                "ts": t["ts"],
            }
            for t in trace_rows
            if t["level"].startswith("chat_")
        ]
    return out


def _due_tasks() -> list[tuple[str, str]]:
    now = datetime.now(timezone.utc)
    due: list[tuple[str, str]] = []
    for task in list_tasks():
        if not task["enabled"] or task["state"] == "running":
            continue
        last = task.get("last_run")
        if not last or not last.get("started_at"):
            due.append((task["id"], task["kind"]))
            continue
        started = _parse_utc(last["started_at"])
        if started and (now - started).total_seconds() >= task["interval_seconds"]:
            due.append((task["id"], task["kind"]))
    return due


def _scheduler_loop() -> None:
    while not _scheduler_stop.is_set():
        try:
            init_db()
            for task_id, kind in _due_tasks():
                if _scheduler_stop.is_set():
                    break
                execute_task(task_id, kind, trigger="scheduler")
        except Exception:
            pass
        _scheduler_stop.wait(30)


def start_scheduler() -> None:
    global _scheduler_thread
    init_db()
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_stop.clear()
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True, name="job-scheduler")
    _scheduler_thread.start()


def stop_scheduler() -> None:
    _scheduler_stop.set()
    if _scheduler_thread:
        _scheduler_thread.join(timeout=5)
