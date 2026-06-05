# Contributing

> **`develop` branch only** — do not add this file to `main` (CI will fail).

## Branches

| Branch | Purpose |
|--------|---------|
| **`main`** | Releases, public landing page (`docs/`), installers — **no** pipeline/backlog docs |
| **`develop`** | Feature work, roadmap, architecture, release notes, internal planning |

```bash
git checkout develop
# … work …
git checkout main && git merge develop   # when shipping a release
```

CI on `main` **fails** if developer-only markdown is present (see `.github/workflows/check-main-branch.yml`).

## Documentation (develop branch only)

These files exist on **`develop`**, not on **`main`**:

| File | Contents |
|------|----------|
| [ROADMAP.md](https://github.com/avinashpeyyety/nakshatra/blob/develop/ROADMAP.md) | Feature backlog, tiers, release targets |
| [SHIP_STRATEGY.md](https://github.com/avinashpeyyety/nakshatra/blob/develop/SHIP_STRATEGY.md) | GTM, pricing, launch strategy |
| [PUBLIC_RELEASE.md](https://github.com/avinashpeyyety/nakshatra/blob/develop/PUBLIC_RELEASE.md) | Release checklist, Pages/downloads |
| [ARCHITECTURE.md](https://github.com/avinashpeyyety/nakshatra/blob/develop/ARCHITECTURE.md) | Product vs admin surfaces |
| [TRANSIT_FILTER_PLAN.md](https://github.com/avinashpeyyety/nakshatra/blob/develop/TRANSIT_FILTER_PLAN.md) | Gochara / time-dial scope |
| `docs/RELEASE_NOTES_*.md` | Version release notes |
| `docs/ANNOUNCE_*.md` | Release announcements |

## Published site (main only)

GitHub Pages deploys **only** from `main`:

- `docs/index.html`, `about.html`, `site.json`, `FEATURES.md`, `downloads/`

Changes to roadmap or release notes on `develop` do **not** trigger a Pages deploy.

## Quick start

```bash
git clone https://github.com/avinashpeyyety/nakshatra.git
cd nakshatra
git checkout develop
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m agent.server
```

Admin UI (Jobs & Agents): `NAKSHATRA_ADMIN=1 python -m agent.server`