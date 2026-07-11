"""Tests for saved chart library (chart_store)."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture()
def chart_env(monkeypatch, tmp_path):
    """Isolate SQLite + watch profile under a temp data dir."""
    data = tmp_path / "data"
    data.mkdir()
    monkeypatch.setenv("NAKSHATRA_DATA_DIR", str(data))

    # Reload modules that cache DATA_DIR / DB_PATH at import time.
    import importlib
    import agent.data_paths as data_paths
    import agent.jobs as jobs
    import agent.chart_store as chart_store

    importlib.reload(data_paths)
    importlib.reload(jobs)
    importlib.reload(chart_store)
    chart_store._TABLE_READY = False
    yield chart_store, jobs, data
    chart_store._TABLE_READY = False


def test_normalize_time(chart_env):
    chart_store, _, _ = chart_env
    assert chart_store.normalize_time("9:05") == "09:05"
    assert chart_store.normalize_time("18:35:00") == "18:35"
    assert chart_store.normalize_time("12:00") == "12:00"
    assert chart_store.normalize_time("") == "12:00"
    assert chart_store.normalize_time(None) == "12:00"
    assert chart_store.normalize_time("99:99") == "12:00"


def test_create_list_activate_update_delete(chart_env):
    chart_store, jobs, _ = chart_env
    c1 = chart_store.create_chart("Self", "1993-06-19", "18:35", "Visakhapatnam", "lahiri")
    assert c1["active"] is True
    assert c1["time"] == "18:35"
    assert jobs.get_watch_profile()["name"] == "Self"

    c2 = chart_store.create_chart("Spouse", "1995-01-10", "9:15", "Hyderabad", "raman")
    assert c2["time"] == "09:15"
    assert c2["active"] is True
    listed = chart_store.list_charts()
    assert len(listed["charts"]) == 2
    assert listed["active_id"] == c2["id"]

    chart_store.set_active_chart(c1["id"])
    updated = chart_store.update_chart(c2["id"], name="Partner", place="Chennai")
    assert updated["name"] == "Partner"
    assert updated["active"] is False
    assert jobs.get_watch_profile()["name"] == "Self"  # inactive update

    chart_store.delete_chart(c1["id"])
    remaining = chart_store.list_charts()
    assert len(remaining["charts"]) == 1
    assert remaining["charts"][0]["id"] == c2["id"]
    assert remaining["charts"][0]["active"] is True
    assert jobs.get_watch_profile()["name"] == "Partner"

    chart_store.delete_chart(c2["id"])
    empty = chart_store.list_charts()
    assert empty["charts"] == []
    assert not empty["active_id"]
    assert jobs.get_watch_profile() is None


def test_repair_orphan_active_id(chart_env):
    chart_store, jobs, data = chart_env
    c = chart_store.create_chart("Keep", "2000-01-01", "10:00", "Mumbai")
    keep_id = c["id"]
    orphan = chart_store.create_chart("Gone", "2001-01-01", "11:00", "Delhi")
    # Delete row without going through delete_chart (simulate corruption)
    import sqlite3

    conn = sqlite3.connect(jobs.DB_PATH)
    conn.execute("DELETE FROM saved_charts WHERE id = ?", (orphan["id"],))
    conn.commit()
    conn.close()
    # Point active at deleted id
    chart_store._set_setting(chart_store.ACTIVE_CHART_KEY, orphan["id"])
    chart_store._TABLE_READY = False

    listed = chart_store.list_charts()
    assert len(listed["charts"]) == 1
    assert listed["charts"][0]["id"] == keep_id
    assert listed["charts"][0]["active"] is True
    assert listed["active_id"] == keep_id


def test_migrate_watch_profile(chart_env):
    chart_store, jobs, data = chart_env
    jobs.save_watch_profile(
        {
            "name": "Legacy",
            "date": "1988-03-15",
            "time": "7:30",
            "place": "Chennai",
            "ayanamsa": "krishnamurti",
        }
    )
    chart_store._TABLE_READY = False
    listed = chart_store.list_charts()
    assert len(listed["charts"]) == 1
    c = listed["charts"][0]
    assert c["name"] == "Legacy"
    assert c["time"] == "07:30"
    assert c["ayanamsa"] == "krishnamurti"
    assert c["active"] is True
