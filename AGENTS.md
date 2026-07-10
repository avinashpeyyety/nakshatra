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

## Ship path for built-in LLM

See `../ai-lab-vault/02-pipelines/jyotish-ship-chain.md` — finetuned qwen → bundle in desktop release.

## Obsidian

`../ai-lab-vault/01-projects/nakshatra.md`