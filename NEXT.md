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
- [ ] Optional: offline weight bundle (no Ollama) when GGUF/MLX packaging ready

## Later

- [ ] Bundle fine-tuned 9B in desktop without Ollama dependency
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
