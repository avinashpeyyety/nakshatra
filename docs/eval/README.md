# Jyotish advisor eval set

Pass/fail gate for embedding a local advisor model in Nakshatra (Chart edition).  
Ship chain: `training-data-scout` → `qwen-finetune` → **this eval** → embed → release.

See also: `ai-lab-vault/02-pipelines/jyotish-ship-chain.md`.

## Files

| Path | Purpose |
|------|---------|
| `jyotish-advisor-eval.jsonl` | 40 Q&A items (v1) |
| `validate_eval_set.py` | Schema check + optional keyword scorer |
| this README | Scoring rules and embed thresholds |

## Item schema

Each JSONL line:

```json
{
  "id": "foundations-001",
  "category": "foundations",
  "question": "…",
  "reference_answer": "…",
  "must_include": ["keyword", "…"],
  "must_not_include": ["tropical sun sign only", "…"],
  "scoring": "keywords",
  "weight": 1.0,
  "chart_context": null
}
```

| Field | Notes |
|-------|--------|
| `category` | `foundations` · `dasha` · `yogas` · `vargas` · `gochara` · `chart_facts` · `interpretation` · `guardrails` · `app_policy` |
| `scoring` | `keywords` (automated) or `rubric` (human / LLM-judge later) |
| `must_include` | Case-insensitive substrings; **all** required for keyword pass |
| `must_not_include` | Case-insensitive; **any** hit fails the item |
| `chart_context` | Optional birth profile when the question is chart-specific |
| `weight` | Used in weighted pass rate (default 1.0) |

## Categories (v1 mix)

| Category | Count | Role |
|----------|------:|------|
| foundations | 10 | Nakshatras, rashis, houses, sidereal vs tropical |
| dasha | 6 | Vimshottari sequence and years |
| yogas | 4 | Classical yoga definitions (not chart invent) |
| vargas | 3 | D9 / D10 / purpose of divisions |
| gochara | 3 | Transits, Sade Sati framing |
| chart_facts | 5 | Sample chart — positions/yogas via tools, not invention |
| interpretation | 5 | Holistic style; multi-factor caveats |
| guardrails | 3 | Birth data required; not medical/legal advice |
| app_policy | 1 | Lahiri default, whole-sign, local-first |

## Sample chart (chart_facts)

Used where `chart_context` is set — matches `tests/test_calculator.py`:

| Field | Value |
|-------|--------|
| Date | 1993-06-19 |
| Time | 18:35 |
| Place | Visakhapatnam |
| Ayanamsa | Lahiri |
| Lagna (sidereal) | Sagittarius |
| Natal Vimshottari lord | Mars |
| Detected yogas (app) | Budha-Aditya, Bhadra (Pancha Mahapurusha), Durudhura, Vipareeta Raja (8th), Raj Yoga (Mercury+Sun), Saraswati |

**Rule for chart_facts:** the embedded advisor must **use chart tools / calculator output**, never invent longitudes or dasha dates. Eval answers may state tool-backed facts from this table.

## How to score

### 1. Schema / inventory (always)

```bash
cd docs/eval
python3 validate_eval_set.py jyotish-advisor-eval.jsonl
```

### 2. Keyword gate (automated subset)

Provide model outputs as JSONL with `id` + `answer`:

```bash
python3 validate_eval_set.py jyotish-advisor-eval.jsonl --answers model-answers.jsonl
```

Items with `scoring: "keywords"` are scored by `must_include` / `must_not_include`.  
Items with `scoring: "rubric"` are reported as `SKIP` until a human or judge script fills them.

### 3. Embed thresholds (pass gate)

Before bundling weights in a desktop installer:

| Metric | Threshold |
|--------|-----------|
| Keyword items pass rate (weighted) | ≥ **85%** |
| Rubric items average (1–5) when scored | ≥ **3.5** |
| Guardrails items | **100%** keyword pass |
| Chart_facts: no invented ephemeris | **0** hard fails (`must_not_include` / fact errors) |
| RAM target Mac | fits **16 GB** (separate gate) |
| Chart edition cloud | **none** required at runtime |

Fail any guardrail or chart-invention check → **do not embed**.

## Adding items

- Keep total **20–50** for this file; grow a `jyotish-advisor-eval-v2.jsonl` if needed.
- Prefer short `must_include` that encode **facts**, not full prose.
- Do not copy training rows verbatim from `qwen-finetune/data/train.jsonl` into the eval set (contamination).
- Chart math expected answers should match `agent/calculator.py` (Lahiri, whole-sign).

## Out of scope for this file

- Training data generation (see `qwen-finetune`)
- Full LLM-as-judge harness (Later: ollama-chat / local script)
- Installer packaging of weights (Later: NEXT.md)
