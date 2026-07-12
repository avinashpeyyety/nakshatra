# Advisor edition — local Ornith 9B

The **Advisor** build includes everything in **Lite** (wheel, dasha, yogas, gochara, ashtakavarga, shadbala, saved charts) plus:

1. A **calculator-grounded chart digest** (all positions, vargas, shadbala, dashas, ashtakavarga, yogas)
2. An **auto-generated full report** after you Calculate
3. **Follow-up Q&A** with the local model

No cloud API keys. Chart math always comes from Nakshatra’s Swiss Ephemeris engine — the model is instructed not to invent ephemeris.

## Requirements

| Item | Notes |
|------|--------|
| **Ollama** | [ollama.com](https://ollama.com) — must be running |
| **Model** | `ollama pull ornith:9b` (~5–6 GB once) |
| **RAM** | 16 GB recommended while generating reports |
| **Network** | Only to pull the model the first time; charts stay local |

Optional env:

```bash
export NAKSHATRA_EDITION=advisor   # if running from source
export NAKSHATRA_LLM_MODEL=ornith:9b
export NAKSHATRA_OLLAMA_URL=http://127.0.0.1:11434
```

## Lite vs Advisor

| | Lite | Advisor |
|--|------|---------|
| Chart calculations | ✓ | ✓ |
| Local LLM report/chat | — | ✓ (Ollama + Ornith) |
| Cloud keys | never | never |
| Installer size | small | small (model separate via Ollama) |

## From source (dev)

```bash
export NAKSHATRA_EDITION=advisor
source .venv/bin/activate
python -m agent.server
# open http://127.0.0.1:8000 — calculate a chart → report panel
```

## Privacy

Birth data and digests stay on your machine (app data dir + local Ollama). Educational software — not medical, legal, or financial advice.

## Future

Domain finetunes and optional offline weight bundles are tracked in `NEXT.md` / lab jyotish ship chain. Product default remains **Ornith** via Ollama until a redistributable finetuned tag is ready.
