# NEXT — nakshatra

## Standing (every iterate)

After any code/docs change: commit → `./scripts/ship_iterate.sh` (push + **lite+advisor** installers + Pages). Landing downloads must match `main`.

## Now (app — use Grok Build)

- [ ] Smoke Advisor report against live Ollama `ornith:9b` on a sample chart (when Ollama is running)
- [ ] Polish report markdown rendering in UI (optional)

## Now (model ship — local only)

- [ ] Expand Jyotish train set (qwen or ornith track) toward 500+ rows
- [ ] Export Jyotish seeds via training-data-scout
- [ ] Pass/fail eval gate on finetuned tag before claiming domain specialist

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
