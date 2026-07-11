# NEXT — nakshatra

## Standing (every iterate)

After any code/docs change: commit → `./scripts/ship_iterate.sh` (push + installers + Pages). Landing downloads must match `main`.

## Now (app — use Grok Build)

- [ ] Document advisor integration plan in `docs/` (local Ollama vs bundled weights)

## Now (model ship — local only)

- [ ] Expand qwen-finetune Jyotish train set toward 500+ rows
- [ ] Export Jyotish seeds via training-data-scout
- [ ] Pass/fail eval gate before any embed in installer (run `docs/eval/validate_eval_set.py` + model answers)

## Later

- [ ] Bundle fine-tuned 9B in desktop `.dmg` / `.exe`
- [ ] Ornith track: agent tool-calling experiments (research)
- [ ] LLM-as-judge harness for rubric items in `docs/eval/`

## Curiosity / explore

- Wire eval runner to ollama-chat or a small local script that hits the finetuned adapter
- Auto-generate more `chart_facts` from `calculate_chart` for additional birth samples (no train contamination)
- Optional: multi-select / rename-only UX polish on saved charts dropdown

## Done

- [x] v1.0.4 desktop releases (Chart edition)
- [x] Define eval set for embedded Jyotish advisor (20–50 Q&A pairs) — `docs/eval/` 40 items + validator
- [x] Fix saved charts feature (time normalize, orphan active_id, form wipe on list, stale watch, PATCH→create fallback)
- [x] Standing ship loop: `./scripts/ship_iterate.sh` after every iterate; shipped **v1.0.5** installers to Pages
