# NEXT — nakshatra

## Standing (every iterate)

After any code/docs change: commit → `./scripts/ship_iterate.sh` (push + **lite+advisor** installers + Pages). Landing downloads must match `main`.

## Now (app — use Grok Build)

- [ ] Smoke Advisor report against live Ollama `ornith:9b` on a sample chart (when Ollama is running)
- [ ] Polish report markdown rendering in UI (optional)

## Now (model ship — local only)

- [ ] Expand the Jyotish train set in `qwen-finetune/` toward 500+ rows, then keep `iters` inside 1–3 epochs (`qwen-finetune/scripts/check_lora_strategy.py`)
- [ ] Curate a classical Jyotish URL allowlist in `training-data-scout/config/seeds.yaml` (public-domain, robots-ok). Wikipedia presets are already crawled. Do not invent a large list ad hoc.
- [ ] Add a Wikipedia path allowlist in the scout before raising `max_depth` above 0
- [ ] Re-train from the scout export with `qwen-finetune/config/lora-decision.yaml` (local MLX only, not Grok)
- [ ] Rank ablation 8/16/32/64 on the same data; keep the lowest rank that passes private/same-skill and new-domain (slices not tagged yet — `qwen-finetune/docs/LORA_STRATEGY.md`)
- [x] Export Jyotish seeds via training-data-scout
- [ ] Pass/fail eval gate on finetuned tag before claiming domain specialist (LoRA start is `qwen-finetune/config/lora-decision.yaml`; rank choice waits on Decision Index slices — `docs/eval/README.md`)

## Later — Advisor without Ollama (product direction)

**Decision (2026-07):** Shipping weights so users never need Ollama is the **right product goal** for Advisor. Stuffing multi‑GB weights into the current small Pages `.dmg`/git tree is **not**.

### Do not

- [ ] Dump 9B GGUF into `docs/downloads/` / Pages (size + git warnings; already painful at ~98 MB exe)
- [ ] Keep “install Ollama + pull” as the **default** long-term Advisor UX

### Do (preferred path)

- [ ] **Thin Advisor app** + **first-run model manager**: download weights into  
      `~/Library/Application Support/Nakshatra Chakram Advisor/models/`  
      (checksum + version pin; progress UI; then offline)
- [ ] Host weights **outside** git/Pages — GitHub Releases, Hugging Face, or CDN
- [ ] Pick runtime: **MLX** (macOS Apple Silicon first) and/or **llama.cpp** (Win parity)
- [ ] Confirm **license** for redistributing Ornith (or ship-tag alternative)
- [ ] Keep **digest → report → chat** architecture; only swap Ollama HTTP for local runner
- [ ] Optional: **fat offline DMG** (app + weights) as separate download link, not Pages tree
- [ ] Keep **system Ollama** as power-user override only (“Use system Ollama”)

### Sequencing when we iterate this

1. Runtime choice (MLX vs llama.cpp vs vendored private Ollama binary)
2. License check for base weights
3. External host + first-run download + checksum
4. Wire Advisor report/chat to local runner
5. Eval gate on real model path; then ship_iterate

### Framing

| Edition | Role |
|---------|------|
| **Lite** | Calculator only — stays small on Pages |
| **Advisor** | Calculator + local LLM; weights are product, Ollama is optional backend |

## Later (other)

- [ ] Ornith track: agent tool-calling experiments (research)
- [ ] LLM-as-judge harness for rubric items in `docs/eval/`

## Curiosity / explore

- Wire eval runner to Advisor `/api/advisor/chat`
- Auto-generate more `chart_facts` from `calculate_chart` for eval (no train contamination)

## Done

- [x] v1.0.4 / v1.0.5 desktop releases
- [x] Eval set for embedded advisor (`docs/eval/`)
- [x] Fix saved charts feature
- [x] Standing ship loop (`ship_iterate.sh`)
- [x] Dual edition: **Lite** (no LLM) + **Advisor** (Ornith via Ollama) — digest, auto report, Q&A, dual downloads
- [x] Dual local HTTPS: Lite `:8443` + Advisor `:8444` (`scripts/serve-https.sh both`)
- [x] Capture product rec: ship weights via first-run/external host, not Ollama-required forever / not multi‑GB in Pages
- [x] Decision-model training tree is `qwen-finetune/` and gitignored; landing stub for the consulting suite (`docs/index.html#consulting`)
