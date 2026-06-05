# Nakshatra Chakram

**Local-first Vedic (Jyotish) birth chart app** — no signup; charts stay on your machine.

| | |
|---|---|
| **Download** | [Landing page](https://avinashpeyyety.github.io/nakshatra/#downloads) (macOS `.dmg`, Windows `.exe`) |
| **Docs site** | [avinashpeyyety.github.io/nakshatra](https://avinashpeyyety.github.io/nakshatra/) |
| **Issues** | [Report a bug](https://github.com/avinashpeyyety/nakshatra/issues) (no chart attachments) |

This **public** repo contains the full application source, desktop build scripts, installers under `docs/downloads/`, and the GitHub Pages landing page in `docs/`.

**Vedic Astrology (Jyotish) birth chart calculator, visualizer, and AI-powered advisor** — sidereal (Lahiri) chart analysis with interactive wheel, dasha timelines, transit alerts, yoga detection, saved chart library, and an integrated AI chart advisor. Built with Swiss Ephemeris, FastAPI, and a single-file HTML/JS frontend.

---

## Features

### Core Astrology Engine
- Ayanamsa selector (Lahiri default, Raman, Krishnamurti, etc.) — affects all calculations, vargas, dashas, shadbala etc.
- Full 27 Nakshatra breakdown with:
  - Rasi coverage (some span two signs)
  - Nakshatra & rasi rulers
  - Bhava (whole-sign house) assignment
  - Native planet occupants + exact degrees
  - "Best planet" per nakshatra (traditional)
  - Aspects received and on bhava
- Visual **Nakshatra Wheel** (SVG):
  - Lagna/Bhava 1 centered at top
  - Planets & nodes placed by longitude
  - Retrograde, dignity, combustion badges
  - Time dial animation + current transit overlay toggle
- **Dual Dashas** (switchable in Dasha tab):
  - Vimshottari: natal balance, current Maha/Antar/Pratyantar, timeline (past/current/upcoming)
  - Jaimini Chara (sign-based): starts at Lagna, direction by odd/even Lagna, variable lengths from lord distance; current + full 12-sign timeline. (Approximate; extensible for sub-periods/special co-lord/AK rules)
  - Both available to AI advisor + exports
- **Yogas**: ~10 classic yogas detected (Gajakeshari, Budha-Aditya, Pancha Mahapurusha variants, Kemadruma, Sunapha/Anapha/Durudhura, Neecha Bhanga Raja, Vipareeta Raja, Dharma-Karma Adhipati Raj, Adhi, Parivartana)
- **Gochara (Transits)**:
  - Current planetary positions (UTC)
  - Severity-ranked alerts (Sade Sati, sign changes, aspects, etc.)
  - Sarvashtakavarga context
  - Dasha-period transit forecast (Jupiter/Saturn/Rahu ingresses + double transits during current & next mahadasha)
- Supporting calculations:
  - All Vargas through D60: Saptavargaja (D2/D3/D7/D9/D12/D30) + D4/D10/D16/D20/D24 + higher D27 (strength), D40 (maternal), D45 (paternal), D60 (karma) — compact in summary + full in AI/export.
  - Ayanamsa selector (Lahiri default, Raman, Krishnamurti) — affects every computed position, varga, dasha, shadbala, gochara etc. Exposed in form + saved charts + watch + API + AI tools.
  - Jaimini Chara Karakas (AK … DK)
  - Dignity (exalted/own/debilitated)
  - Combustion (traditional orbs)
  - Retrograde flags
  - Ashtakavarga: full Bhinna (per-planet bindu tables) + Sarva, with reductions/notes in UI and AI tools
  - Shadbala: full 6 balas (Sthana/Dig/Kala/Cheshta/Naisargika/Drik) + totals in Rupas, using Saptavargaja from the vargas. Shown in dedicated section + AI.

### Chart Management & Monitoring
- Save multiple named birth charts (SQLite)
- Active "watch profile" (used by scheduler & AI advisor)
- Background scheduler (APScheduler via jobs):
  - `gochara_scan` — hourly transit checks with email alerts for major events
  - `chart_advisor` — daily AI overview (when enabled)
- Email notifications (Gmail SMTP + optional major-only filter)

### AI Chart Advisor (Jobs & Agents tab)
- Chat directly with your chart using Grok (xAI), OpenAI, or Anthropic
- Tool-calling agent (LangChain/LangGraph) that **only** fetches calculator data when needed
- Never hallucinates positions — all facts come from the Swiss Ephemeris layer
- Persistent per-agent chat history
- Can be triggered manually or on schedule

### Automation Agent (separate)
- Headless Claude (Anthropic) tool-use loop
- Modules auto-discovered: Gmail (send/search), Google Calendar, Excel/PPTX/Word generation
- CLI, interactive REPL, and MCP server for Cursor SDK (`@cursor/february`)
- Google OAuth flow for calendar/email (desktop app credentials)

### UI
- Pure static `index.html` (no bundler, no npm for the astro app)
- Dark cosmic theme with gold/saffron accents
- Responsive tabs: Wheel / Dasha / Yogas / Gochara
- Saved charts picker + quick watch profile sync
- Real-time status, run history, trace logs for jobs

---

## Project Structure

```
nakshatra_chakram/
├── agent/
│   ├── calculator.py      # Swiss Ephemeris core + all Vedic logic (dasha, yogas, gochara, ashtakavarga…)
│   ├── chart_tools.py     # LangChain StructuredTools wrapping the calculator (for AI advisor)
│   ├── agent_chat.py      # Chat orchestration + profile resolution (falls back: explicit → active chart → watch profile)
│   ├── chart_advisor.py   # LangGraph-style advisor loop (actually LangChain messages + tool calls)
│   ├── chart_store.py     # Saved charts + active chart in SQLite (jobs.db)
│   ├── jobs.py            # Scheduler, run history, trace logging, job/agent registry + state
│   ├── server.py          # FastAPI app (API + serves the single-file UI)
│   ├── static/index.html  # 3400-line self-contained frontend (SVG wheel, tabs, chat, jobs UI)
│   ├── registry.py        # Auto-discovers automation modules in modules/
│   ├── core.py            # Anthropic tool-use agent loop (general automation)
│   ├── modules/           # email.py, calendar.py, excel.py, pptx.py, word.py (TOOL_DEFINITIONS + dispatch)
│   ├── mcp_server.py      # MCP stdio bridge for Cursor launcher
│   ├── auth.py            # Google OAuth (token storage in credentials/)
│   ├── interactive.py     # REPL for the general automation agent
│   ├── cli.py             # One-shot CLI for automation agent
│   └── data/              # jobs.db, watch_profile.json (legacy), email_settings.json
├── launcher/
│   └── index.ts           # Cursor SDK launcher that attaches the MCP server
├── .env.example
└── requirements.txt
```

---

## Development

**Architecture (product vs admin):** **[ARCHITECTURE.md](ARCHITECTURE.md)** — the **Jobs & Agents** tab is admin-only and does not ship; default runs expose **Chart** only (`NAKSHATRA_ADMIN=0`).

Prioritized improvements, release targets, and progress tracking: **[ROADMAP.md](ROADMAP.md)**.

Mass-market launch, pricing, and minimal-overhead ops: **[SHIP_STRATEGY.md](SHIP_STRATEGY.md)**.

**Releases + landing page (no signups/trials):** **[PUBLIC_RELEASE.md](PUBLIC_RELEASE.md)** · site in `docs/`.

Transit dial / Gochara noise reduction: **[TRANSIT_FILTER_PLAN.md](TRANSIT_FILTER_PLAN.md)**.

- Work on branch `develop`; merge to `main` for releases (`v1.0.0`, `v1.1.0`, …).
- Update `ROADMAP.md` checkboxes and the refinement log as items ship.

---

## Quick Start

### 1. Python environment
```bash
cd /path/to/nakshatra_chakram
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Environment variables
Copy `.env.example` → `.env` (or rely on sibling workspace `.env` files — see `agent/env.py`).

Required for full functionality:
- `XAI_API_KEY` (or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) — for the Chart Advisor
- Google OAuth credentials (for automation modules)
- SMTP settings (for transit alert emails)

See `.env.example` for details. The app also looks for `lang-chain-system/.env` etc. in the parent directory.

### 3. Google OAuth (for email/calendar automation)
1. Google Cloud Console → Credentials → OAuth client ID (Desktop app)
2. Download JSON and place / authorize via the `agent/auth.py` flow (first use of email/calendar tools will trigger browser auth).

### 4. Run the UI
```bash
# Shipped product surface (Chart tab only)
.venv/bin/python -m agent.server

# Developer / operator — Jobs & Agents tab + scheduler
NAKSHATRA_ADMIN=1 .venv/bin/python -m agent.server

# or with host/port
.venv/bin/python -m agent.server --host 0.0.0.0 --port 8000
```

Open http://127.0.0.1:8000

Enter birth details (or pick a saved chart) → Calculate.

### 5. General automation agent (CLI / REPL)
```bash
# One-shot
.venv/bin/python -m agent.cli "What meetings do I have this week?"

# Interactive REPL
.venv/bin/python -m agent.interactive
```

### 6. Cursor launcher (advanced)
```bash
cd launcher
npm install
CURSOR_API_KEY=... npx tsx index.ts "Summarize my recent emails about project X"
```

The launcher attaches `agent.mcp_server` so the Cursor agent sees all your Gmail/Calendar/Excel tools.

---

## Key APIs (when running the server)

- `POST /calculate` — main chart computation (returns HTML fragments + wheel_data JSON)
- `GET/POST/DELETE /api/charts` — saved chart CRUD + activate
- `GET /api/jobs` + `PATCH /api/jobs/...` + `POST /api/jobs/.../run`
- `GET/POST /api/agents/chart_advisor/chat`
- `GET /api/transit-windows`
- `GET /api/jobs/watch-profile` / `PUT ...`

---

## Customization & Extension

- **Add a new yoga**: edit `detect_yogas()` in `calculator.py`
- **New automation module**: drop a `.py` file in `agent/modules/` exporting `TOOL_DEFINITIONS` and `dispatch(tool_name, args)`
- **New scheduled task**: add to `JOB_REGISTRY` or `AGENT_REGISTRY` in `jobs.py` / `agents.py` and implement runner
- **Ayanamsa selector**: full support in UI form, saved charts, watch profile, API, AI tools, and all calculations. Map string to SIDM_* .
- **More divisional charts**: Saptavargaja set + D4, D10, D16, D20, D24 implemented (D1 base). Pattern ready for D27/D40/D45/D60 etc. All in table + AI.
- **Shadbala**: calculate_shadbala added. Can be extended with more precise sub-formulas.

The registry pattern makes adding capabilities low-friction.

---

## Limitations & Future Ideas

- **Offline geocoding** by default: worldwide catalog (~69k cities, population ≥ 5000) in `agent/data/places.json` ([GeoNames](https://www.geonames.org/) CC BY 4.0), autocomplete via `GET /api/places`, or `lat, lon`. Rebuild: `python3 agent/scripts/build_places.py` (requires downloading `cities5000.zip` into `agent/data/_build/`). Set `NAKSHATRA_ALLOW_ONLINE_GEOCODE=1` only for Nominatim fallback.
- **UI fonts** bundled under `agent/static/fonts/` (Cinzel, Lato, Share Tech Mono — OFL). No Google Fonts CDN at runtime.
- Whole-sign houses only (traditional for many Vedic techniques).
- No built-in atlas or offline ephemeris beyond Swiss Ephemeris.
- Email alerts require SMTP app password (Gmail).
- The automation agent and astrology advisor use different LLM stacks (Anthropic direct vs LangChain).

### Testing

A basic test suite exists in `tests/test_calculator.py`. Run it with:

    .venv/bin/python -m pytest tests/ -q

Add more golden tests (known charts) as you extend the calculator — this is highly recommended for an astrology application.

---

## Credits & Tech

- Swiss Ephemeris (pyswisseph) for all positions
- FastAPI + uvicorn
- LangChain / LangGraph for the chart advisor
- Anthropic Claude for the general automation loop
- Google APIs for Gmail + Calendar
- Pure hand-crafted SVG + vanilla JS frontend

---

*Local-first. Your chart, your data, your machine.*
