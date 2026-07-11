# Agent guide — nakshatra

## Execution policy

| Work type | Executor |
|-----------|----------|
| App code (Python, agent/, packaging) | **Grok Build Composer 2.5** |
| Embedded advisor model training | **Local** — `../qwen-finetune` (primary ship track) |
| Ornith experiments | **Local** — `../ornith-finetune` (research only) |

Check credits: `../ai-lab-vault/05-cost/COST-LOG.md`  
Full policy: `../ai-lab-vault/EXECUTION.md`

## Before you code

1. Read `NEXT.md` — **item 1 only**
2. Chart edition ships **without cloud API keys** — keep public builds local-first
3. Never commit `credentials/`, `.env`, user chart data

## Project

Local Vedic chart app. Agent layer in `agent/`. Public installers: Chart edition.

## Verify

```bash
source .venv/bin/activate
pytest
python -m agent.server   # http://127.0.0.1:8000
```

## After every iterate (mandatory — do not wait for user)

User rule: **every iterate pushes and updates installers**, so landing downloads match `main`.

1. Commit meaningful tree (`NEXT.md`, code, tests) — no secrets
2. **Ship** (push + rebuild macOS/Windows + GitHub Pages downloads):

```bash
# From repo root, after commit. Auto patch-bumps docs/site.json version (1.0.4 → 1.0.5).
./scripts/ship_iterate.sh
# Or pin version:
./scripts/ship_iterate.sh 1.0.5
```

What that does:

| Step | Action |
|------|--------|
| Push | `git push origin main` |
| macOS | `scripts/package_desktop.sh` → `dist/*-macos.dmg` |
| Windows | CI `build-windows-exe.yml` → `dist/*-windows.exe` |
| Pages | `scripts/publish_github_release.sh` → `docs/downloads/` + `site.json` |

Exceptions (still **push** code; skip installer rebuild only if noted to user):

- Pure vault/notes with **no** `agent/`, `launcher/`, `requirements.txt`, or packaging script changes **and** user said docs-only
- Blocked credentials (`gh` / token missing for Windows CI) — push mac dmg path if possible; report Windows blocked

Landing: https://avinashpeyyety.github.io/nakshatra/

## Ship path for built-in LLM

See `../ai-lab-vault/02-pipelines/jyotish-ship-chain.md` — finetuned qwen → bundle in desktop release.

## Obsidian

`../ai-lab-vault/01-projects/nakshatra.md`