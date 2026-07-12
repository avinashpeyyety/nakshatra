# Nakshatra Chakram

**Local-first Vedic (Jyotish) birth chart app** — no signup; charts stay on your machine.

| | |
|---|---|
| **Download** | [Landing page](https://avinashpeyyety.github.io/nakshatra/#downloads) (macOS `.dmg`, Windows `.exe`) |
| **Features** | [Feature list](docs/FEATURES.md) |
| **Docs site** | [avinashpeyyety.github.io/nakshatra](https://avinashpeyyety.github.io/nakshatra/) |
| **Issues** | [Report a bug](https://github.com/avinashpeyyety/nakshatra/issues) (no chart attachments) |

Public installers ship two builds:

| | |
|--|--|
| **Lite** | Wheel, Dasha, Yogas, Gochara, strengths — no LLM |
| **Advisor** | Lite + local **Ornith 9B** full report & chat (requires [Ollama](https://ollama.com) + `ollama pull ornith:9b`) |

Data stays on your computer. Details: [docs/ADVISOR.md](docs/ADVISOR.md).

---

## Install

Use the **[landing page downloads](https://avinashpeyyety.github.io/nakshatra/#downloads)** (recommended).

**macOS:** Open the `.dmg`, drag to Applications, launch. Requires **Python 3.10+** on first run. Browser opens at `http://127.0.0.1:8765`.

**Windows:** Run the `.exe`. Browser opens at `http://127.0.0.1:8765`.

---

## Run from source

```bash
git clone https://github.com/avinashpeyyety/nakshatra.git
cd nakshatra
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m agent.server
```

Open http://127.0.0.1:8000

```bash
# Advisor edition from source:
export NAKSHATRA_EDITION=advisor
python -m agent.server
```

Optional cloud keys in `.env` are for **admin** Jobs builds only (`NAKSHATRA_ADMIN=1`), not the public Advisor product.

---

## Tip (optional)

[Ko-fi](https://ko-fi.com/avinashpeyyety) — if the app helps you.

*Educational software — not professional advice.*