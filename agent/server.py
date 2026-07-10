"""
Vedic Astrology Calculator — FastAPI server
Usage:  python -m agent.server              → http://localhost:8000
        python -m agent.server --port 3000
        python -m agent.server --https      → https://localhost:8443 (self-signed)
"""
import argparse
import os
from contextlib import asynccontextmanager
from pathlib import Path

import agent.env  # noqa: F401 — load workspace .env before other modules

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent.app_config import admin_enabled, app_config

from agent.email_service import (
    get_email_settings_public,
    save_email_settings,
    send_test_email,
)
from agent.jobs import (
    execute_job,
    execute_task,
    get_run,
    get_watch_profile,
    init_db,
    list_jobs,
    list_runs,
    list_tasks,
    save_watch_profile,
    set_agent_enabled,
    set_job_enabled,
    set_task_enabled,
    start_scheduler,
    stop_scheduler,
)
from agent.calculator import (
    RASI_NAMES, PLANET_SYMBOLS, ASPECT_LABELS, calculate_chart, fmt_dms,
    DASHA_YEARS, get_planet_positions_only, _jd_from_dt, _resolve_ayanamsa_mode,
)
import datetime as _dt

BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")


_ADMIN_API_PREFIXES = (
    "/api/jobs",
    "/api/agents",
    "/api/tasks",
    "/api/email",
    "/api/transit-windows",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if admin_enabled():
        start_scheduler()
    yield
    if admin_enabled():
        stop_scheduler()


app = FastAPI(title="Nakshatra Chakram", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def admin_api_gate(request: Request, call_next):
    """Admin-only APIs return 404 when NAKSHATRA_ADMIN is not set (shipped default)."""
    path = request.url.path
    if not admin_enabled() and any(
        path == prefix or path.startswith(prefix + "/") for prefix in _ADMIN_API_PREFIXES
    ):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    return await call_next(request)


@app.get("/api/app-config")
async def api_app_config():
    return JSONResponse(app_config())


@app.get("/api/places")
async def search_places(q: str = "", limit: int = 12):
    """Offline place autocomplete for birth location."""
    from agent.geocode import search_places as _search

    lim = max(1, min(int(limit), 30))
    return JSONResponse({"results": _search(q, limit=lim)})


class BirthDetails(BaseModel):
    date: str   # YYYY-MM-DD
    time: str   # HH:MM
    place: str
    ayanamsa: str = "lahiri"  # lahiri, raman, krishnamurti, tropical (no ayanamsa)  # lahiri, raman, krishnamurti, tropical (no correction / sayana)


class TransitDialAlertsRequest(BaseModel):
    dt: str
    natal_positions: dict[str, float]
    lagna_rasi_idx: int
    life_events: bool = False
    ayanamsa: str = "lahiri"


class JobEnabledUpdate(BaseModel):
    enabled: bool


class WatchProfile(BaseModel):
    date: str
    time: str = "12:00"
    place: str
    name: str | None = None
    ayanamsa: str = "lahiri"  # lahiri, raman, krishnamurti, tropical (no ayanamsa)


class SavedChartCreate(BaseModel):
    name: str
    date: str
    time: str = "12:00"
    place: str
    ayanamsa: str = "lahiri"  # lahiri, raman, krishnamurti, tropical (no ayanamsa)


class SavedChartUpdate(BaseModel):
    name: str | None = None
    date: str | None = None
    time: str | None = None
    place: str | None = None
    ayanamsa: str | None = None


class EmailSettingsUpdate(BaseModel):
    enabled: bool | None = None
    to: str | None = None
    notify_major_only: bool | None = None
    from_name: str | None = None


@app.get("/api/email/settings")
async def api_get_email_settings():
    return JSONResponse(get_email_settings_public())


@app.put("/api/email/settings")
async def api_put_email_settings(body: EmailSettingsUpdate):
    payload = body.model_dump(exclude_none=True)
    return JSONResponse(save_email_settings(payload))


@app.post("/api/email/test")
async def api_send_test_email():
    try:
        msg = send_test_email()
        return JSONResponse({"ok": True, "message": msg})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class TaskEnabledUpdate(BaseModel):
    enabled: bool
    kind: str = "job"


class TaskRunRequest(BaseModel):
    date: str | None = None
    time: str | None = None
    place: str | None = None


class AgentChatRequest(BaseModel):
    message: str
    date: str | None = None
    time: str | None = None
    place: str | None = None
    ayanamsa: str | None = None


@app.get("/api/agents/{agent_id}/chat")
async def api_get_agent_chat(agent_id: str):
    try:
        from agent.agent_chat import get_chat_history

        return JSONResponse({"agent_id": agent_id, "messages": get_chat_history(agent_id)})
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/agents/{agent_id}/chat")
async def api_post_agent_chat(agent_id: str, body: AgentChatRequest):
    try:
        from agent.agent_chat import chat_with_agent

        profile = None
        if body.date and body.place:
            profile = {
                "date": body.date,
                "time": body.time or "12:00",
                "place": body.place.strip(),
                "ayanamsa": body.ayanamsa or "lahiri",
            }
        result = chat_with_agent(
            agent_id,
            body.message,
            profile=profile,
            date=body.date,
            time=body.time,
            place=body.place,
        )
        return JSONResponse(result)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Advisor error: {exc}")


@app.delete("/api/agents/{agent_id}/chat")
async def api_clear_agent_chat(agent_id: str):
    try:
        from agent.agent_chat import reset_chat

        reset_chat(agent_id)
        return JSONResponse({"ok": True, "agent_id": agent_id})
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/tasks")
async def api_list_tasks():
    return JSONResponse({"tasks": list_tasks()})


@app.patch("/api/tasks/{task_id}")
async def api_update_task(task_id: str, body: TaskEnabledUpdate):
    try:
        return JSONResponse(set_task_enabled(task_id, body.kind, body.enabled))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/tasks/{task_id}/run")
async def api_run_task(task_id: str, body: TaskRunRequest | None = None):
    try:
        kind = "job"
        from agent.agents import AGENT_REGISTRY
        from agent.jobs import JOB_REGISTRY

        if task_id in AGENT_REGISTRY:
            kind = "agent"
        elif task_id not in JOB_REGISTRY:
            raise ValueError(f"Unknown task: {task_id}")

        profile = None
        if body and body.date and body.place:
            profile = {
                "date": body.date,
                "time": body.time or "12:00",
                "place": body.place.strip(),
            }
        return JSONResponse(execute_task(task_id, kind, trigger="manual", profile=profile))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.get("/api/jobs")
async def api_list_jobs():
    return JSONResponse({"jobs": list_jobs(), "tasks": list_tasks()})


@app.patch("/api/jobs/{job_id}")
async def api_update_job(job_id: str, body: JobEnabledUpdate):
    try:
        return JSONResponse(set_job_enabled(job_id, body.enabled))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/jobs/{job_id}/run")
async def api_run_job(job_id: str):
    try:
        return JSONResponse(execute_job(job_id, trigger="manual"))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/jobs/runs")
async def api_list_job_runs(job_id: str | None = None, limit: int = 50):
    return JSONResponse({"runs": list_runs(job_id=job_id, limit=min(limit, 200))})


@app.get("/api/jobs/runs/{run_id}")
async def api_get_job_run(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return JSONResponse(run)


@app.get("/api/jobs/watch-profile")
async def api_get_watch_profile():
    return JSONResponse({"profile": get_watch_profile()})


@app.put("/api/jobs/watch-profile")
async def api_put_watch_profile(body: WatchProfile):
    profile = {
        "date": body.date,
        "time": body.time,
        "place": body.place.strip(),
        "ayanamsa": body.ayanamsa,
    }
    if body.name:
        profile["name"] = body.name.strip()
    if not profile["date"] or not profile["place"]:
        raise HTTPException(status_code=400, detail="date and place are required")
    save_watch_profile(profile)
    from agent.chart_store import get_active_chart, update_chart

    active = get_active_chart()
    if active:
        update_chart(
            active["id"],
            name=body.name or active["name"],
            date=body.date,
            time=body.time,
            place=body.place.strip(),
            ayanamsa=body.ayanamsa,
        )
    return JSONResponse({"profile": profile})


@app.get("/api/charts")
async def api_list_charts():
    from agent.chart_store import list_charts

    return JSONResponse(list_charts())


@app.post("/api/charts")
async def api_create_chart(body: SavedChartCreate):
    try:
        from agent.chart_store import create_chart

        chart = create_chart(body.name, body.date, body.time, body.place.strip(), ayanamsa=body.ayanamsa)
        return JSONResponse(chart)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/charts/{chart_id}")
async def api_get_chart(chart_id: str):
    from agent.chart_store import get_chart

    chart = get_chart(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return JSONResponse(chart)


@app.patch("/api/charts/{chart_id}")
async def api_update_chart(chart_id: str, body: SavedChartUpdate):
    try:
        from agent.chart_store import update_chart

        return JSONResponse(
            update_chart(
                chart_id,
                name=body.name,
                date=body.date,
                time=body.time,
                place=body.place.strip() if body.place else None,
                ayanamsa=body.ayanamsa,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=404 if "not found" in str(exc).lower() else 400, detail=str(exc))


@app.delete("/api/charts/{chart_id}")
async def api_delete_chart(chart_id: str):
    from agent.chart_store import delete_chart

    delete_chart(chart_id)
    return JSONResponse({"ok": True})


@app.post("/api/charts/{chart_id}/activate")
async def api_activate_chart(chart_id: str):
    try:
        from agent.chart_store import set_active_chart

        return JSONResponse(set_active_chart(chart_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/transit-windows")
async def api_transit_windows(
    date: str | None = None,
    time: str | None = None,
    place: str | None = None,
):
    try:
        from agent.agent_chat import resolve_profile
        from agent.transit_windows import get_transit_windows

        prof = resolve_profile(
            date=date,
            time=time,
            place=place,
        )
        return JSONResponse(
            get_transit_windows(prof["date"], prof["time"], prof["place"], ayanamsa=prof.get("ayanamsa", "lahiri"))
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/", response_class=HTMLResponse)
async def index():
    with open(os.path.join(STATIC_DIR, "index.html"), encoding="utf-8") as f:
        return f.read()


@app.get("/transit_positions")
async def transit_positions_at(dt: str = None):
    """Return sidereal planetary positions for an arbitrary UTC datetime (ISO-8601)."""
    try:
        if dt:
            parsed = _dt.datetime.fromisoformat(dt.replace("Z", "+00:00"))
            if parsed.tzinfo:
                import pytz as _pytz
                parsed = parsed.astimezone(_pytz.utc).replace(tzinfo=None)
        else:
            parsed = _dt.datetime.utcnow()
        positions = get_planet_positions_only(_jd_from_dt(parsed))
        return JSONResponse({"positions": positions, "dt": parsed.strftime("%Y-%m-%dT%H:%M")})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transit_dial_alerts")
async def transit_dial_alerts(body: TransitDialAlertsRequest):
    """Filtered Time Dial banner alerts (shared transit_filter rules)."""
    from agent.transit_filter import compute_dial_alerts

    try:
        parsed = _dt.datetime.fromisoformat(body.dt.replace("Z", "+00:00"))
        if parsed.tzinfo:
            import pytz as _pytz
            parsed = parsed.astimezone(_pytz.utc).replace(tzinfo=None)
        mode = _resolve_ayanamsa_mode(body.ayanamsa)
        positions = get_planet_positions_only(_jd_from_dt(parsed), ayanamsa_mode=mode)
        organized, raw_count = compute_dial_alerts(
            positions,
            body.natal_positions,
            body.lagna_rasi_idx,
            life_events=body.life_events,
        )
        all_alerts = organized.get("alerts", [])
        return JSONResponse({
            "alerts": all_alerts,
            "top": organized.get("top", []),
            "categories": organized.get("categories", []),
            "raw_count": raw_count,
            "hidden_count": max(0, raw_count - len(all_alerts)),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/calculate")
async def calculate(details: BirthDetails):
    try:
        result = calculate_chart(details.date, details.time, details.place, ayanamsa=details.ayanamsa)
        gochara = result.get("gochara", {})
        return JSONResponse({
            "summary_html":  _render_summary(result, details),
            "dasha_html":    _render_dasha(result),
            "yoga_html":     _render_yogas(result),
            "gochara_html":  _render_gochara(result),
            "ashtak_html":   _render_ashtakavarga(result),
            "shadbala_html": _render_shadbala(result),
            "wheel_data": {
                "positions":          result["positions"],
                "retrograde":         result["retrograde"],
                "dignity":            result["dignity"],
                "combust":            result["combust"],
                "chara_karakas":      result["chara_karakas"],
                "d9_signs":           result.get("d9_signs", {}),
                "d3_signs":           result.get("d3_signs", {}),
                "d10_signs":          result.get("d10_signs", {}),
                "d2_signs":           result.get("d2_signs", {}),
                "d7_signs":           result.get("d7_signs", {}),
                "d12_signs":          result.get("d12_signs", {}),
                "d30_signs":          result.get("d30_signs", {}),
                "d4_signs":           result.get("d4_signs", {}),
                "d16_signs":          result.get("d16_signs", {}),
                "d20_signs":          result.get("d20_signs", {}),
                "d24_signs":          result.get("d24_signs", {}),
                "d27_signs":          result.get("d27_signs", {}),
                "d40_signs":          result.get("d40_signs", {}),
                "d45_signs":          result.get("d45_signs", {}),
                "d60_signs":          result.get("d60_signs", {}),
                "shadbala":           result.get("shadbala", {}),
                "sarva":              result["sarva"],
                "bav":                result.get("bav", {}),
                "transit_positions":  gochara.get("transit_positions", {}),
                "lagna_rasi_idx":     RASI_NAMES.index(result["lagna_rasi"]),
                "lagna_rasi":         result["lagna_rasi"],
                "ayanamsa":           result["ayanamsa"],
                "ayanamsa_mode":      result.get("ayanamsa_mode", "lahiri"),
                "rows":               result["rows"],
                "chara_dasha":        result.get("chara_dasha", {}),
            },
        })
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Calculation error: {exc}")


# ---------------------------------------------------------------------------
# HTML renderers
# ---------------------------------------------------------------------------

PLANET_COLORS = {
    "Sun":     "#f59e0b",
    "Moon":    "#c0c8d8",
    "Mercury": "#34d399",
    "Venus":   "#f472b6",
    "Mars":    "#ef4444",
    "Jupiter": "#facc15",
    "Saturn":  "#94a3b8",
    "Rahu":    "#a855f7",
    "Ketu":    "#fb923c",
    "Lagna":   "#60a5fa",
}


def _planet_badge(name: str) -> str:
    color = PLANET_COLORS.get(name, "#e2d9f3")
    return f'<span class="badge" style="color:{color}">{PLANET_SYMBOLS.get(name, "")} {name}</span>'


def _render_summary(result: dict, details: BirthDetails) -> str:
    pos     = result["positions"]
    retro   = result.get("retrograde",    {})
    dignity = result.get("dignity",       {})
    combust = result.get("combust",       {})
    karakas = result.get("chara_karakas", {})
    d9      = result.get("d9_signs",      {})
    d3      = result.get("d3_signs",      {})
    d10     = result.get("d10_signs",     {})
    d2      = result.get("d2_signs",      {})
    d7      = result.get("d7_signs",      {})
    d12     = result.get("d12_signs",     {})
    d30     = result.get("d30_signs",     {})
    d4      = result.get("d4_signs",      {})
    d16     = result.get("d16_signs",     {})
    d20     = result.get("d20_signs",     {})
    d24     = result.get("d24_signs",     {})
    d27     = result.get("d27_signs",     {})
    d40     = result.get("d40_signs",     {})
    d45     = result.get("d45_signs",     {})
    d60     = result.get("d60_signs",     {})
    order = ["Lagna", "Sun", "Moon", "Mercury", "Venus", "Mars",
             "Jupiter", "Saturn", "Rahu", "Ketu"]
    rows = []
    for p in order:
        if p not in pos:
            continue
        deg      = pos[p]
        rasi_idx = int(deg / 30.0) % 12
        rasi     = RASI_NAMES[rasi_idx]
        d9_rasi  = RASI_NAMES[d9[p]] if p in d9 else "—"
        d10_rasi = RASI_NAMES[d10[p]] if p in d10 else "—"
        color    = PLANET_COLORS.get(p, "#e2d9f3")
        sym      = PLANET_SYMBOLS.get(p, "")
        flags    = []
        if retro.get(p):    flags.append('<span style="color:#f59e0b">℞</span>')
        dig = dignity.get(p)
        if dig == "exalted":        flags.append('<span style="color:#c9a84c" title="Exalted">⬆ Uccha</span>')
        elif dig == "debilitated":  flags.append('<span style="color:#ef4444" title="Debilitated">⬇ Neecha</span>')
        elif dig == "own":          flags.append('<span style="color:#94a3b8" title="Own sign">⌂ Swa</span>')
        if combust.get(p):  flags.append('<span style="color:#f97316" title="Combust">☉ Co</span>')
        if p in karakas:    flags.append(f'<span style="color:#c9a84c" title="Chara Karaka">{karakas[p]}</span>')
        # Vargottama: D1 sign == D9 sign
        if p in d9 and rasi_idx == d9[p]:
            flags.append('<span style="color:#22d3ee" title="Vargottama">◈ Vg</span>')
        flag_str = " ".join(flags)
        rows.append(
            f'<tr>'
            f'<td><span style="color:{color}">{sym} {p}</span></td>'
            f'<td>{rasi}</td>'
            f'<td>{d9_rasi}</td>'
            f'<td>{d10_rasi}</td>'
            f'<td class="mono">{fmt_dms(deg % 30)}</td>'
            f'<td class="mono">{fmt_dms(deg)}</td>'
            f'<td style="font-size:.8rem">{flag_str}</td>'
            f'</tr>'
        )

    # Full per-planet vargas table for dropdown (complete single table view, duplication with top summary is fine per request)
    varga_defs = [
        ("D1 (Rasi)", lambda p: RASI_NAMES[int(pos.get(p, 0) / 30) % 12]),
        ("D2 (Hora)", lambda p: RASI_NAMES[d2.get(p, 0)]),
        ("D3 (Drekkana)", lambda p: RASI_NAMES[d3.get(p, 0)]),
        ("D4 (Chaturthamsa)", lambda p: RASI_NAMES[d4.get(p, 0)]),
        ("D7 (Saptamsa)", lambda p: RASI_NAMES[d7.get(p, 0)]),
        ("D9 (Navamsa)", lambda p: RASI_NAMES[d9.get(p, 0)]),
        ("D10 (Dasamsa)", lambda p: RASI_NAMES[d10.get(p, 0)]),
        ("D12 (Dwadasamsa)", lambda p: RASI_NAMES[d12.get(p, 0)]),
        ("D16 (Shodashamsa)", lambda p: RASI_NAMES[d16.get(p, 0)]),
        ("D20 (Vimsamsa)", lambda p: RASI_NAMES[d20.get(p, 0)]),
        ("D24 (Chaturvimshamsa)", lambda p: RASI_NAMES[d24.get(p, 0)]),
        ("D27 (Nakshatramsa)", lambda p: RASI_NAMES[d27.get(p, 0)]),
        ("D30 (Trimsamsa)", lambda p: RASI_NAMES[d30.get(p, 0)]),
        ("D40 (Khavedamsa)", lambda p: RASI_NAMES[d40.get(p, 0)]),
        ("D45 (Akshavedamsa)", lambda p: RASI_NAMES[d45.get(p, 0)]),
        ("D60 (Shashtiamsa)", lambda p: RASI_NAMES[d60.get(p, 0)]),
    ]
    varga_thead = "".join(f"<th>{name}</th>" for name, _ in varga_defs)
    varga_rows_html = []
    for p in order:
        if p not in pos:
            continue
        color = PLANET_COLORS.get(p, "#e2d9f3")
        sym = PLANET_SYMBOLS.get(p, "")
        cells = [f'<td><span style="color:{color}">{sym} {p}</span></td>']
        for _, getter in varga_defs:
            cells.append(f"<td>{getter(p)}</td>")
        varga_rows_html.append(f"<tr>{''.join(cells)}</tr>")

    vargas_dropdown_html = f"""
<div style="margin-top: 12px">
  <details>
    <summary style="cursor: pointer; color: var(--gold); font-size: .78rem; font-weight: 600; margin-bottom: 6px">
      ▶ Full Vargas Table (all divisional charts in one view — click to expand)
    </summary>
    <div class="table-scroll-wrap">
      <table class="nakshatra-table" style="font-size: .72rem; min-width: 1600px">
        <thead><tr><th>Planet</th>{varga_thead}</tr></thead>
        <tbody>{''.join(varga_rows_html)}</tbody>
      </table>
    </div>
    <p style="font-size: .65rem; color: var(--text-muted); margin: 4px 0 0">
      Complete reference: D1=base sign • D2=wealth &amp; family • D3=siblings &amp; courage • D4=property, vehicles, mother • D7=children &amp; creativity • D9=marriage, spouse, dharma • D10=career, status, karma • D12=parents &amp; ancestry • D16=comforts &amp; luxuries • D20=spiritual pursuits &amp; worship • D24=education &amp; learning • D27=strengths/weaknesses &amp; nature • D30=evils, flaws &amp; character • D40=maternal lineage • D45=paternal lineage • D60=past life karma &amp; overall fortune.
    </p>

    <!-- Analysis "tab" section for high-level varga interpretation -->
    <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:12px;">
      <div style="font-size:.78rem; color:var(--gold); font-weight:600; margin-bottom:6px;">High-Level Analysis of Varga Placements</div>

      <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
        <button onclick="showVargaAnalysisTab(this, 'varga-anal-overview')" class="varga-tab-btn active" style="font-size:.72rem; padding:3px 10px; border:1px solid var(--border); background:#0a0a1e; color:var(--text); cursor:pointer;">Overview</button>
        <button onclick="showVargaAnalysisTab(this, 'varga-anal-llm')" class="varga-tab-btn" style="font-size:.72rem; padding:3px 10px; border:1px solid var(--border); background:#0a0a1e; color:var(--text); cursor:pointer;">LLM Reasoning (when available)</button>
      </div>

      <div id="varga-anal-overview" class="varga-anal-pane">
        <p style="font-size:.7rem; color:var(--text-muted); margin:0;">
          Each varga reveals specific life areas. The AI advisor (below or in chat) can interpret exact placements for your chart using the dedicated varga tools (e.g. get_nakshatramsa_d27_positions, get_shashtiamsa_d60_positions, etc.).
        </p>
      </div>

      <div id="varga-anal-llm" class="varga-anal-pane" style="display:none;">
        <p style="font-size:.7rem; color:var(--text-muted); margin:0 0 8px;">
          Click to request a high-level LLM-powered analysis of these specific varga placements. The advisor will use tools + reasoning to interpret what the positions mean for career, marriage, karma, etc.
        </p>
        <button onclick="requestVargaLLMAnalysis()" class="btn-secondary" style="font-size:.72rem; padding:4px 10px;">Generate LLM Varga Analysis</button>
        <div id="varga-llm-output" style="margin-top:8px; font-size:.72rem; color:var(--text); white-space:pre-wrap;"></div>
      </div>
    </div>
  </details>
</div>
"""

    # For compact additional in note
    lagna_d4 = RASI_NAMES[d4.get("Lagna", 0)] if "Lagna" in d4 else "—"
    lagna_d16 = RASI_NAMES[d16.get("Lagna", 0)] if "Lagna" in d16 else "—"
    lagna_d20 = RASI_NAMES[d20.get("Lagna", 0)] if "Lagna" in d20 else "—"
    lagna_d24 = RASI_NAMES[d24.get("Lagna", 0)] if "Lagna" in d24 else "—"
    lagna_d27 = RASI_NAMES[d27.get("Lagna", 0)] if "Lagna" in d27 else "—"
    lagna_d40 = RASI_NAMES[d40.get("Lagna", 0)] if "Lagna" in d40 else "—"
    lagna_d45 = RASI_NAMES[d45.get("Lagna", 0)] if "Lagna" in d45 else "—"
    lagna_d60 = RASI_NAMES[d60.get("Lagna", 0)] if "Lagna" in d60 else "—"

    return f"""
<div class="summary-wrap">
  <div class="meta-row">
    <span>📅 {details.date} &nbsp; 🕐 {details.time}</span>
    <span>📍 {details.place}</span>
    <span>Lagna: <strong>{result['lagna_rasi']}</strong></span>
    <span>{ 'Tropical (no ayanamsa correction)' if result.get('ayanamsa_mode') == 'tropical' else f"Ayanamsa ({result.get('ayanamsa_mode', 'lahiri')}): <strong>{result['ayanamsa']:.4f}°</strong>" }</span>
    <span>Timezone: <strong>{result['tz']}</strong></span>
    <span>Lat: <strong>{result['lat']:.4f}°</strong> &nbsp; Lon: <strong>{result['lon']:.4f}°</strong></span>
  </div>
  <table class="summary-table">
    <thead>
      <tr><th>Planet / Point</th><th>Rasi (D1)</th><th>Navamsa (D9)</th><th>Dasamsa (D10)</th><th>Deg in Rasi</th><th>Absolute Deg</th><th>Flags</th></tr>
    </thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
  {vargas_dropdown_html}
  <p style="font-size:.7rem;color:var(--text-muted);margin-top:4px">
    Core quick view (D1 + D9 + D10). The dropdown below provides the <strong>full single-table varga view</strong> (all 16 divisional charts, including duplicates of D1/D9/D10 for convenience).
  </p>
  <div style="margin-top:6px;font-size:.68rem;color:var(--text-muted)">
    Additional Vargas (Lagna): D4 {lagna_d4} · D16 {lagna_d16} · D20 {lagna_d20} · D24 {lagna_d24} · D27 {lagna_d27} · D40 {lagna_d40} · D45 {lagna_d45} · D60 {lagna_d60} (full in AI/export)
  </div>
</div>
"""


def _render_dasha(result: dict) -> str:
    dasha = result.get("dasha", {})
    if not dasha:
        return "<p>Dasha data unavailable.</p>"

    cur      = dasha.get("current")
    timeline = dasha.get("timeline", [])

    natal_lord  = dasha.get("natal_dasha_lord", "—")
    natal_bal   = dasha.get("natal_balance_years", "—")
    natal_color = PLANET_COLORS.get(natal_lord, "#e2d9f3")

    # ── Current period card (Vimshottari) ──────────────────────────────────
    if cur:
        maha_color  = PLANET_COLORS.get(cur["mahadasha"],         "#e2d9f3")
        antar_color = PLANET_COLORS.get(cur["antardasha"],        "#e2d9f3")
        prat_color  = PLANET_COLORS.get(cur["pratyantardasha"],   "#e2d9f3")
        cur_html = f"""
<div class="dasha-current">
  <div class="dasha-level" style="border-left:4px solid {maha_color}">
    <span class="dasha-label">Mahadasha</span>
    <span class="dasha-planet" style="color:{maha_color}">{cur['mahadasha']}</span>
    <span class="dasha-meta">ends {cur['mahadasha_end']} &nbsp;·&nbsp; {cur['mahadasha_remaining']} left</span>
  </div>
  <div class="dasha-level" style="border-left:4px solid {antar_color}">
    <span class="dasha-label">Antardasha</span>
    <span class="dasha-planet" style="color:{antar_color}">{cur['antardasha']}</span>
    <span class="dasha-meta">ends {cur['antardasha_end']} &nbsp;·&nbsp; {cur['antardasha_remaining']} left</span>
  </div>
  <div class="dasha-level" style="border-left:4px solid {prat_color}">
    <span class="dasha-label">Pratyantardasha</span>
    <span class="dasha-planet" style="color:{prat_color}">{cur['pratyantardasha']}</span>
    <span class="dasha-meta">ends {cur['pratyantardasha_end']}</span>
  </div>
</div>"""
    else:
        cur_html = "<p style='color:var(--text-muted)'>Current period outside standard dasha range.</p>"

    # ── Mahadasha overview table (clean, no confusing nesting) ─────────────
    maha_rows = []
    current_maha_entry = None
    seen_current = False
    for row in timeline:
        is_cur = row.get("is_current", False)
        color  = PLANET_COLORS.get(row["planet"], "#e2d9f3")
        sym    = PLANET_SYMBOLS.get(row["planet"], "")
        dur    = row["years"]

        if is_cur:
            status = f'<span style="color:#93c5fc">Current • {cur.get("mahadasha_remaining", "")} left</span>' if cur else "Current"
            current_maha_entry = row
            seen_current = True
        elif not seen_current:
            status = '<span style="color:#64748b">Past</span>'
        else:
            status = '<span style="color:#a5b4fc">Upcoming</span>'

        label = f'<span style="color:{color}">{sym} <strong>{row["planet"]}</strong></span>'

        maha_rows.append(f"""
<tr class="{'dasha-row-active' if is_cur else ''}">
  <td>{label}</td>
  <td class="mono">{row["start"]}</td>
  <td class="mono">{row["end"]}</td>
  <td class="mono">{dur} yrs</td>
  <td>{status}</td>
</tr>""")

    # ── Detailed antardashas ONLY for the current mahadasha ────────────────
    antar_detail_html = ""
    if current_maha_entry and current_maha_entry.get("antardashas"):
        ad_rows = []
        for ad in current_maha_entry["antardashas"]:
            ad_color = PLANET_COLORS.get(ad["planet"], "#e2d9f3")
            ad_sym   = PLANET_SYMBOLS.get(ad["planet"], "")
            hi = ' style="background:#10102e;font-weight:600"' if ad.get("is_current") else ""
            tag = ' <span style="font-size:.65rem;color:#93c5fc">◀ now</span>' if ad.get("is_current") else ""
            ad_rows.append(
                f'<tr{hi}>'
                f'<td style="color:{ad_color};padding-left:8px">{ad_sym} {ad["planet"]}{tag}</td>'
                f'<td class="mono" style="color:var(--text-muted)">{ad["start"]}</td>'
                f'<td class="mono" style="color:var(--text-muted)">{ad["end"]}</td>'
                f'</tr>'
            )

        cur_maha = current_maha_entry["planet"]
        antar_detail_html = f"""
<div style="margin-top:1.4rem">
  <h3 class="dasha-section-title">Antardashas inside current Mahadasha ({cur_maha})</h3>
  <p style="font-size:.72rem;color:var(--text-muted);margin:0 0 6px">
    The 9 sub-periods (antardashas) of the current major period. The one you are in now is highlighted.
  </p>
  <div class="table-scroll-wrap">
  <table class="dasha-timeline-table" style="font-size:.78rem;max-width:520px">
    <thead><tr><th style="width:38%">Antardasha</th><th>Starts</th><th>Ends</th></tr></thead>
    <tbody>{''.join(ad_rows)}</tbody>
  </table>
  </div>
</div>"""

    # Next maha teaser (if present)
    next_teaser = ""
    for i, row in enumerate(timeline):
        if row.get("is_current"):
            if i + 1 < len(timeline):
                nxt = timeline[i + 1]
                nxt_color = PLANET_COLORS.get(nxt["planet"], "#e2d9f3")
                nxt_sym = PLANET_SYMBOLS.get(nxt["planet"], "")
                next_teaser = f"""
<div style="margin-top:12px;font-size:.8rem;color:var(--text-muted)">
  Next: <span style="color:{nxt_color}">{nxt_sym} <strong>{nxt["planet"]}</strong></span> begins {nxt["start"]}
</div>"""
            break

    table_html = ""
    if maha_rows:
        table_html = f"""
<div class="table-scroll-wrap">
<table class="dasha-timeline-table">
  <thead><tr>
    <th>Mahadasha</th><th>Starts</th><th>Ends</th><th>Duration</th><th>Status</th>
  </tr></thead>
  <tbody>{''.join(maha_rows)}</tbody>
</table>
</div>
{next_teaser}
"""

    # ── Chara Dasha (Jaimini) render ───────────────────────────────────────
    chara = result.get("chara_dasha", {})
    chara_cur = chara.get("current")
    chara_timeline = chara.get("timeline", [])
    chara_start = chara.get("natal_dasha_lord", "—")
    chara_dir = chara.get("direction", "—")
    chara_note = chara.get("note", "")

    chara_cur_html = ""
    if chara_cur:
        ccol = PLANET_COLORS.get(chara_cur.get("lord", ""), "#e2d9f3")
        chara_cur_html = f"""
<div class="dasha-current" style="margin-bottom:8px">
  <div class="dasha-level" style="border-left:4px solid {ccol}">
    <span class="dasha-label">Current Chara Dasha</span>
    <span class="dasha-planet" style="color:{ccol}">{chara_cur.get('sign','—')}</span>
    <span class="dasha-meta">lord: {chara_cur.get('lord','—')} · ends {chara_cur.get('end','—')}</span>
  </div>
</div>"""
    else:
        chara_cur_html = "<p style='color:var(--text-muted);font-size:.8rem'>No active Chara period in range.</p>"

    chara_rows_html = []
    for i, row in enumerate(chara_timeline):
        is_cur = row.get("is_current", False)
        col = PLANET_COLORS.get(row.get("lord", ""), "#e2d9f3")
        status = '<span style="color:#93c5fc">Current</span>' if is_cur else ('<span style="color:#64748b">Past</span>' if i < 3 else '<span style="color:#a5b4fc">Upcoming</span>')
        chara_rows_html.append(f"""
<tr class="{'dasha-row-active' if is_cur else ''}">
  <td><span style="color:{col}"><strong>{row['sign']}</strong></span></td>
  <td class="mono" style="color:var(--text-muted)">{row.get('lord','—')}</td>
  <td class="mono">{row['start']}</td>
  <td class="mono">{row['end']}</td>
  <td class="mono">{row['years']} yrs</td>
  <td>{status}</td>
</tr>""")

    chara_table = ""
    if chara_rows_html:
        chara_table = f"""
<div class="table-scroll-wrap">
<table class="dasha-timeline-table" style="font-size:.78rem">
  <thead><tr>
    <th>Sign</th><th>Lord</th><th>Starts</th><th>Ends</th><th>Dur</th><th>Status</th>
  </tr></thead>
  <tbody>{''.join(chara_rows_html)}</tbody>
</table>
</div>
<div style="margin-top:6px;font-size:.7rem;color:var(--text-muted)">{chara_note}</div>
"""

    # ── Final HTML with selector for Vim vs Chara ──────────────────────────
    return f"""
<div class="dasha-wrap">
  <div style="display:flex; align-items:center; gap:12px; margin:0 0 10px; flex-wrap:wrap">
    <span style="font-size:.82rem; color:var(--text-muted); font-weight:600">Dasha System:</span>
    <label style="font-size:.82rem; cursor:pointer"><input type="radio" name="dashaType" value="vim" checked onchange="if(window.switchDashaType)window.switchDashaType('vim')"> <strong>Vimshottari</strong> (Nakshatra-based)</label>
    <label style="font-size:.82rem; cursor:pointer"><input type="radio" name="dashaType" value="chara" onchange="if(window.switchDashaType)window.switchDashaType('chara')"> <strong>Chara</strong> (Jaimini sign-based)</label>
  </div>

  <div id="dasha-vim">
    <div class="dasha-header">
      <span>Birth Dasha lord: <strong style="color:{natal_color}">{natal_lord}</strong></span>
      <span>Balance at birth: <strong>{natal_bal} yrs</strong></span>
    </div>

    <h3 class="dasha-section-title">Current Period</h3>
    {cur_html}

    <h3 class="dasha-section-title" style="margin-top:1.6rem">Mahadasha Timeline</h3>
    <p style="font-size:.73rem;color:var(--text-muted);margin:0 0 10px">
      Recent past • Current • Upcoming (the periods that actually matter for your life now and ahead).
    </p>
    {table_html}

    {antar_detail_html}
  </div>

  <div id="dasha-chara" style="display:none">
    <div class="dasha-header">
      <span>Starting sign (Lagna): <strong>{chara_start}</strong></span>
      <span>Direction: <strong>{chara_dir}</strong></span>
    </div>
    <h3 class="dasha-section-title">Current Chara Period</h3>
    {chara_cur_html}
    <h3 class="dasha-section-title" style="margin-top:1.2rem">Chara Dasha Timeline (12 signs)</h3>
    <p style="font-size:.72rem;color:var(--text-muted);margin:0 0 8px">
      Sign periods counted from Lagna in direction determined by odd/even Lagna. Lengths vary by distance to sign lord.
    </p>
    {chara_table}
  </div>

  <div style="margin-top:1rem;font-size:.68rem;color:#64748b">
    Tip: Chara Dasha is especially useful for Jaimini-specific predictions and pairs with the Chara Karakas shown above.
  </div>
</div>
"""


def _render_gochara(result: dict) -> str:
    gochara = result.get("gochara", {})
    alerts  = gochara.get("alerts", [])
    alerts_secondary = gochara.get("alerts_secondary", [])
    t_pos   = gochara.get("transit_positions", {})

    if not alerts and not alerts_secondary:
        return '<div class="yoga-wrap"><p style="color:var(--text-muted)">Transit data unavailable.</p></div>'

    from datetime import datetime as _dt2
    today_str = _dt2.utcnow().strftime("%d %b %Y")

    # Transit positions summary table
    order = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Rahu","Ketu"]
    t_rows = []
    for p in order:
        if p not in t_pos:
            continue
        deg       = t_pos[p]
        sign      = RASI_NAMES[int(deg / 30) % 12]
        in_sign   = deg % 30
        d, m_     = int(in_sign), round((in_sign % 1) * 60)
        color     = PLANET_COLORS.get(p, "#e2d9f3")
        sym       = PLANET_SYMBOLS.get(p, "")
        t_rows.append(
            f'<tr><td><span style="color:{color}">{sym} {p}</span></td>'
            f'<td>{sign}</td>'
            f'<td class="mono">{d}°{m_:02d}′</td></tr>'
        )

    transit_table = f"""
<div style="margin-bottom:18px">
  <h3 class="dasha-section-title">Today's Planetary Positions <span style="font-weight:400;color:var(--text-muted)">({today_str} UTC)</span></h3>
  <div class="table-scroll-wrap" style="max-width:380px">
  <table class="dasha-timeline-table">
    <thead><tr><th>Planet</th><th>Sign</th><th>Degree</th></tr></thead>
    <tbody>{''.join(t_rows)}</tbody>
  </table>
  </div>
</div>"""

    # Alert cards
    SEV_BORDER = {"critical": "#ef4444", "major": "#f97316",
                  "positive": "#c9a84c", "moderate": "#facc15", "info": "#64748b"}

    def _gochara_cards(items: list) -> str:
        out = []
        for a in items:
            border = SEV_BORDER.get(a["severity"], "#64748b")
            sarva_badge = (
                f'<span class="gochara-meta-badge" style="color:{"#c9a84c" if isinstance(a["sarva_score"], int) and a["sarva_score"]>=28 else "#94a3b8" if isinstance(a["sarva_score"], int) and a["sarva_score"]>=20 else "#ef4444"}">'
                f'Sarva: {a["sarva_score"]}</span>'
            ) if a.get("sarva_score") != "—" else ""
            out.append(f"""
<div class="gochara-card" style="border-left:4px solid {border}">
  <div class="gochara-title">{a['icon']} {a['type']}</div>
  <div class="gochara-meta">
    <span class="gochara-meta-badge">{PLANET_SYMBOLS.get(a['planet'].split()[0], '')} {a['sign']}</span>
    <span class="gochara-meta-badge">{a['house_from']}</span>
    {sarva_badge}
    <span class="gochara-meta-badge" style="color:#22d3ee">~{a['remaining']} remaining · exits {a['exit_approx']}</span>
  </div>
  <div class="gochara-body">{a['body']}</div>
</div>""")
        return "".join(out)

    cards = _gochara_cards(alerts)
    secondary_html = ""
    if alerts_secondary:
        secondary_html = f"""
  <h3 class="dasha-section-title" style="margin-top:20px;font-size:.9rem">Ongoing context</h3>
  <p style="font-size:.72rem;color:var(--text-muted);margin:0 0 8px">Secondary transits (Jupiter house, nodal axis summary).</p>
  {_gochara_cards(alerts_secondary)}"""

    # ── Dasha Transit Forecast section ──────────────────────────────────
    forecast = result.get("dasha_forecast", [])
    SEV_BORDER2 = {"critical": "#ef4444", "major": "#f97316",
                   "positive": "#22c55e", "moderate": "#facc15", "info": "#64748b"}
    PLANET_Q_COLOR = {"Jupiter": "#fde68a", "Saturn": "#cbd5e1", "Rahu": "#d8b4fe"}

    current_dasha_label = ""
    dasha_cur = result.get("dasha", {}).get("current")
    if dasha_cur:
        current_dasha_label = dasha_cur["mahadasha"]
    next_dasha_label = ""
    tl = result.get("dasha", {}).get("timeline", [])
    for i, row in enumerate(tl):
        if row.get("is_current") and i + 1 < len(tl):
            next_dasha_label = tl[i + 1]["planet"]
            break

    forecast_rows = []
    last_dasha = None
    for ev in forecast:
        dasha_lbl = ev.get("dasha", "")
        if dasha_lbl != last_dasha:
            last_dasha = dasha_lbl
            dasha_color = PLANET_COLORS.get(dasha_lbl, "#e2d9f3")
            is_cur = (dasha_lbl == current_dasha_label)
            badge = (" <span style='font-size:.65rem;background:#1e3a5a;padding:1px 5px;"
                     "border-radius:3px;color:#7dd3fc'>CURRENT</span>" if is_cur else "")
            forecast_rows.append(
                f'<tr><td colspan="3" style="background:#0d1624;color:{dasha_color};'
                f'font-weight:700;font-size:.78rem;padding:7px 10px;border-top:1px solid #1e293b">'
                f'{PLANET_SYMBOLS.get(dasha_lbl,"")} {dasha_lbl} Mahadasha{badge}</td></tr>'
            )
        border_c = SEV_BORDER2.get(ev.get("quality", "info"), "#64748b")
        p_color  = PLANET_Q_COLOR.get(ev.get("planet", ""), "#94a3b8")
        end_badge = (f' → {ev["end_date_str"]}' if ev.get("end_date_str") else "")
        forecast_rows.append(
            f'<tr style="border-left:3px solid {border_c}">'
            f'<td style="color:{p_color};white-space:nowrap;padding:5px 8px">'
            f'{ev["icon"]} {ev["date_str"]}{end_badge}</td>'
            f'<td style="color:#e2d9f3;padding:5px 8px">{ev["type"]}</td>'
            f'<td style="color:#94a3b8;font-size:.72rem;padding:5px 8px">{ev["detail"]}</td>'
            f'</tr>'
        )

    forecast_html = ""
    if forecast_rows:
        forecast_html = f"""
<div style="margin-top:28px">
  <h3 class="dasha-section-title">Dasha Transit Forecast
    <span style="font-weight:400;color:var(--text-muted);font-size:.75rem">
      — {current_dasha_label or "current"} &amp; {next_dasha_label or "next"} Mahadasha
    </span>
  </h3>
  <p style="font-size:.72rem;color:var(--text-muted);margin:0 0 10px">
    Key ♃ Jupiter / ♄ Saturn / ☊ Rahu ingresses and ⚡ Double Transit windows.
    🔴 Critical &nbsp;🟠 Major &nbsp;🟢 Positive &nbsp;🟡 Moderate &nbsp;⚪ Info
  </p>
  <div class="table-scroll-wrap">
  <table class="dasha-timeline-table" style="width:100%">
    <thead><tr><th>Date</th><th>Event</th><th>Significance</th></tr></thead>
    <tbody>{''.join(forecast_rows)}</tbody>
  </table>
  </div>
</div>"""

    return f"""
<div class="yoga-wrap">
  {transit_table}
  <h3 class="dasha-section-title">Active &amp; Key Transit Alerts</h3>
  <p style="font-size:.73rem;color:var(--text-muted);margin:0 0 10px">
    Top impactful transits only (filtered). Durations are approximate (average planetary speed).
    🔴 Critical &nbsp;🟠 Major &nbsp;🟢 Positive &nbsp;🟡 Moderate &nbsp;⚪ Info
  </p>
  {cards}
  {secondary_html}
  {forecast_html}
</div>
"""


def _render_yogas(result: dict) -> str:
    yogas = result.get("yogas", [])
    if not yogas:
        return '<div class="yoga-wrap"><p style="color:var(--text-muted)">No notable yogas detected in this chart.</p></div>'

    benefic    = [y for y in yogas if y["type"] == "benefic"]
    challenging= [y for y in yogas if y["type"] == "challenging"]

    def _cards(items: list, accent: str) -> str:
        cards = []
        for y in items:
            planet_badges = " ".join(
                '<span style="color:{}">{} {}</span>'.format(
                    PLANET_COLORS.get(p, "#e2d9f3"), PLANET_SYMBOLS.get(p, ""), p
                )
                for p in y.get("planets", [])
            )
            cards.append(f"""
<div class="yoga-card" style="border-left:4px solid {accent}">
  <div class="yoga-name">{y['name']}</div>
  <div class="yoga-planets">{planet_badges}</div>
  <div class="yoga-desc">{y['description']}</div>
</div>""")
        return "".join(cards)

    b_html = _cards(benefic,     "#c9a84c")
    c_html = _cards(challenging, "#ef4444") if challenging else ""
    c_section = f'<h3 class="dasha-section-title" style="margin-top:1.2rem;color:#ef4444">Challenging Yogas</h3>{c_html}' if c_html else ""

    return f"""
<div class="yoga-wrap">
  <p style="font-size:.78rem;color:var(--text-muted);margin:0 0 12px">
    {len(yogas)} yoga{'s' if len(yogas)!=1 else ''} detected &nbsp;·&nbsp;
    {len(benefic)} benefic &nbsp;·&nbsp; {len(challenging)} challenging
  </p>
  <h3 class="dasha-section-title">Benefic Yogas</h3>
  {b_html}
  {c_section}
</div>
"""


def _render_ashtakavarga(result: dict) -> str:
    """Sarvashtakavarga + full Bhinna Ashtakavarga (per planet) for depth."""
    sarva = result.get("sarva") or []
    bav = result.get("bav") or {}
    if not sarva or len(sarva) != 12:
        return '<div class="yoga-wrap"><p style="color:var(--text-muted)">Ashtakavarga unavailable.</p></div>'

    # Sarva bars
    max_val = max(sarva) or 1
    cells = []
    for i, val in enumerate(sarva):
        pct = int((val / max_val) * 100) if max_val else 0
        sign = RASI_NAMES[i]
        color = "#c9a84c" if val >= 28 else ("#facc15" if val >= 20 else "#94a3b8")
        cells.append(
            f'<div style="display:flex;flex-direction:column;align-items:center;min-width:42px">'
            f'<div style="font-size:.65rem;color:var(--text-muted)">{sign[:3]}</div>'
            f'<div style="width:100%;height:6px;background:#1f2937;border-radius:3px;overflow:hidden;margin:2px 0">'
            f'<div style="width:{pct}%;height:100%;background:{color}"></div></div>'
            f'<div style="font-family:monospace;font-size:.75rem;color:{color}">{val}</div>'
            f'</div>'
        )

    avg = sum(sarva) / 12.0
    note = "Higher bindus (28+) indicate signs where transits tend to give stronger results."

    # Bhinna Ashtakavarga table for key planets (all 7 + Lagna if present)
    planets_order = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
    bav_rows = []
    for planet in planets_order:
        if planet not in bav:
            continue
        scores = bav[planet]
        cells_str = " ".join(f'<span style="display:inline-block;width:22px;text-align:center;color:{"#c9a84c" if s>=3 else "#94a3b8" if s>=1 else "#64748b"}">{s}</span>' for s in scores)
        bav_rows.append(f'<tr><td style="font-weight:600;color:{PLANET_COLORS.get(planet,"#e2d9f3")}">{PLANET_SYMBOLS.get(planet,"")} {planet}</td><td style="font-family:monospace;font-size:.7rem">{cells_str}</td></tr>')

    bav_html = ""
    if bav_rows:
        bav_html = f"""
<div style="margin-top:12px">
  <div style="font-size:.75rem;color:var(--gold);margin-bottom:4px">Bhinna Ashtakavarga (per planet bindus per sign; 0-8 scale)</div>
  <table class="dasha-timeline-table" style="font-size:.72rem">
    <thead><tr><th>Planet</th><th>Ari Tau Gem Can Leo Vir Lib Sco Sag Cap Aqu Pis</th></tr></thead>
    <tbody>{''.join(bav_rows)}</tbody>
  </table>
  <p style="font-size:.65rem;color:var(--text-muted);margin:4px 0 0">Each column = sign 0-11. Higher = more strength from that planet in transits through the sign.</p>
</div>"""

    return f"""
<div class="yoga-wrap" style="margin-top:4px">
  <div style="display:flex;gap:6px;align-items:baseline;margin-bottom:6px">
    <span style="color:var(--gold);font-weight:600">Sarvashtakavarga (total bindus)</span>
    <span style="color:var(--text-muted);font-size:.72rem">avg {avg:.1f} / 12 signs (max 56 theoretical)</span>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;padding:6px 4px;background:#0a0a18;border:1px solid var(--border);border-radius:8px">
    {''.join(cells)}
  </div>
  <p style="margin:6px 0 0;font-size:.7rem;color:var(--text-muted)">{note}</p>
  {bav_html}
</div>
"""


def _render_shadbala(result: dict) -> str:
    """Shadbala summary table (6 balas + total in Rupas)."""
    shadbala = result.get("shadbala") or {}
    if not shadbala:
        return '<div class="yoga-wrap"><p style="color:var(--text-muted)">Shadbala unavailable.</p></div>'

    rows = []
    for p in ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
        if p not in shadbala:
            continue
        s = shadbala[p]
        color = PLANET_COLORS.get(p, "#e2d9f3")
        sym = PLANET_SYMBOLS.get(p, "")
        row = f'<tr><td style="color:{color}">{sym} {p}</td>'
        for k in ["sthana", "dig", "kala", "cheshta", "naisargika", "drik"]:
            row += f'<td class="mono">{s.get(k,0)}</td>'
        total = s.get("total_rupa", 0)
        strong = "✓" if s.get("is_strong") else ""
        row += f'<td class="mono" style="font-weight:600">{total} {strong}</td></tr>'
        rows.append(row)

    return f"""
<div class="yoga-wrap">
  <p style="font-size:.78rem;color:var(--text-muted);margin:0 0 8px">
    Shadbala in Rupas (1 Rupa = 60 Virupas). Strong planets (typically ≥5 Rupas) have more influence.
    Columns: Sthana (pos) · Dig (dir) · Kala (time) · Cheshta (motion) · Naisargika (nat) · Drik (aspect) · Total
  </p>
  <div class="table-scroll-wrap">
  <table class="dasha-timeline-table" style="font-size:.75rem">
    <thead><tr><th>Planet</th><th>Sthana</th><th>Dig</th><th>Kala</th><th>Cheshta</th><th>Naisargika</th><th>Drik</th><th>Total Rupa</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
  </div>
</div>
"""


def _default_cert_paths() -> tuple[Path, Path]:
    """Local TLS material under agent/certs/ (gitignored)."""
    cert_dir = Path(BASE_DIR) / "certs"
    return cert_dir / "cert.pem", cert_dir / "key.pem"


def _ensure_self_signed(cert_file: Path, key_file: Path) -> None:
    """Create a localhost self-signed cert if missing (openssl)."""
    if cert_file.is_file() and key_file.is_file():
        return
    cert_file.parent.mkdir(parents=True, exist_ok=True)
    import subprocess

    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(key_file),
            "-out",
            str(cert_file),
            "-days",
            "825",
            "-nodes",
            "-subj",
            "/CN=localhost",
            "-addext",
            "subjectAltName=DNS:localhost,IP:127.0.0.1",
        ],
        check=True,
        capture_output=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=None, help="Port (default 8000 http / 8443 https)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument(
        "--https",
        action="store_true",
        help="Serve TLS (self-signed cert under agent/certs/ unless paths given)",
    )
    parser.add_argument("--ssl-certfile", default=None, help="PEM certificate path")
    parser.add_argument("--ssl-keyfile", default=None, help="PEM private key path")
    parser.add_argument("--reload", action="store_true", help="Auto-reload on code changes")
    args = parser.parse_args()

    use_https = args.https or bool(args.ssl_certfile or args.ssl_keyfile)
    port = args.port if args.port is not None else (8443 if use_https else 8000)
    ssl_certfile = args.ssl_certfile
    ssl_keyfile = args.ssl_keyfile

    if use_https:
        if not ssl_certfile or not ssl_keyfile:
            c, k = _default_cert_paths()
            _ensure_self_signed(c, k)
            ssl_certfile = str(c)
            ssl_keyfile = str(k)
        scheme = "https"
        print(f"\n  Nakshatra Chakram → {scheme}://{args.host}:{port}")
        print(f"  TLS cert: {ssl_certfile}")
        print("  (self-signed — browser may warn; proceed for local dev)\n")
    else:
        scheme = "http"
        print(f"\n  Nakshatra Chakram → {scheme}://{args.host}:{port}\n")

    uvicorn.run(
        "agent.server:app",
        host=args.host,
        port=port,
        reload=args.reload,
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile,
    )
