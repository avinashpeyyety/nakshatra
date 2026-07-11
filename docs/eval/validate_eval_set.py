#!/usr/bin/env python3
"""Validate jyotish-advisor-eval.jsonl schema and optionally score model answers.

Usage:
  python3 validate_eval_set.py jyotish-advisor-eval.jsonl
  python3 validate_eval_set.py jyotish-advisor-eval.jsonl --answers model-answers.jsonl
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED = {
    "id",
    "category",
    "question",
    "reference_answer",
    "must_include",
    "must_not_include",
    "scoring",
    "weight",
    "chart_context",
}
CATEGORIES = {
    "foundations",
    "dasha",
    "yogas",
    "vargas",
    "gochara",
    "chart_facts",
    "interpretation",
    "guardrails",
    "app_policy",
}
SCORING = {"keywords", "rubric"}
MIN_ITEMS, MAX_ITEMS = 20, 50


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            raise SystemExit(f"{path}:{i}: invalid JSON: {e}") from e
    return rows


def validate_schema(items: list[dict]) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    if not (MIN_ITEMS <= len(items) <= MAX_ITEMS):
        errors.append(f"item count {len(items)} outside {MIN_ITEMS}–{MAX_ITEMS}")

    for idx, row in enumerate(items, 1):
        missing = REQUIRED - set(row)
        if missing:
            errors.append(f"row {idx}: missing fields {sorted(missing)}")
            continue
        rid = row["id"]
        if rid in ids:
            errors.append(f"row {idx}: duplicate id {rid!r}")
        ids.add(rid)
        if row["category"] not in CATEGORIES:
            errors.append(f"{rid}: bad category {row['category']!r}")
        if row["scoring"] not in SCORING:
            errors.append(f"{rid}: bad scoring {row['scoring']!r}")
        if not isinstance(row["must_include"], list) or not isinstance(
            row["must_not_include"], list
        ):
            errors.append(f"{rid}: must_include/must_not_include must be lists")
        if not isinstance(row["weight"], (int, float)) or row["weight"] <= 0:
            errors.append(f"{rid}: weight must be positive number")
        if not str(row["question"]).strip() or not str(row["reference_answer"]).strip():
            errors.append(f"{rid}: empty question or reference_answer")
    return errors


def _contains(hay: str, needle: str) -> bool:
    return needle.casefold() in hay.casefold()


def score_keywords(item: dict, answer: str) -> tuple[bool, str]:
    for need in item["must_include"]:
        if not _contains(answer, need):
            return False, f"missing must_include: {need!r}"
    for ban in item["must_not_include"]:
        if ban and _contains(answer, ban):
            return False, f"hit must_not_include: {ban!r}"
    return True, "ok"


def score_answers(items: list[dict], answers: dict[str, str]) -> int:
    kw_w = kw_pass = 0.0
    rubric = 0
    missing = 0
    fails: list[str] = []
    guard_fail = False

    for item in items:
        rid = item["id"]
        ans = answers.get(rid)
        if ans is None:
            missing += 1
            print(f"  MISS  {rid}: no answer")
            continue
        if item["scoring"] == "rubric":
            rubric += 1
            print(f"  SKIP  {rid}: rubric (manual/LLM-judge)")
            continue
        w = float(item["weight"])
        kw_w += w
        ok, reason = score_keywords(item, ans)
        if ok:
            kw_pass += w
            print(f"  PASS  {rid}")
        else:
            fails.append(rid)
            if item["category"] == "guardrails":
                guard_fail = True
            print(f"  FAIL  {rid}: {reason}")

    print()
    if kw_w:
        rate = 100.0 * kw_pass / kw_w
        print(f"Keyword weighted pass: {kw_pass:.1f}/{kw_w:.1f} = {rate:.1f}%  (gate ≥ 85%)")
        print(f"Keyword hard fails: {len(fails)}")
    else:
        rate = 0.0
        print("No keyword items scored.")
    print(f"Rubric skipped: {rubric}; missing answers: {missing}")
    if guard_fail:
        print("EMBED GATE: FAIL (guardrails must be 100%)")
        return 2
    if kw_w and rate < 85.0:
        print("EMBED GATE: FAIL (keyword rate < 85%)")
        return 2
    if kw_w and rate >= 85.0 and not guard_fail:
        print("EMBED GATE: keyword subset OK (still need rubric + RAM + no-cloud gates)")
    return 0 if not fails or (kw_w and rate >= 85.0) else 2


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("eval_set", type=Path, help="Path to jyotish-advisor-eval.jsonl")
    ap.add_argument(
        "--answers",
        type=Path,
        default=None,
        help="JSONL of {id, answer} model outputs for keyword scoring",
    )
    args = ap.parse_args()

    if not args.eval_set.is_file():
        print(f"Not found: {args.eval_set}", file=sys.stderr)
        return 1

    items = load_jsonl(args.eval_set)
    errors = validate_schema(items)
    if errors:
        print("SCHEMA ERRORS:")
        for e in errors:
            print(f"  - {e}")
        return 1

    by_cat: dict[str, int] = {}
    for row in items:
        by_cat[row["category"]] = by_cat.get(row["category"], 0) + 1
    kw = sum(1 for r in items if r["scoring"] == "keywords")
    rb = sum(1 for r in items if r["scoring"] == "rubric")

    print(f"OK schema: {len(items)} items ({kw} keywords, {rb} rubric)")
    for cat in sorted(by_cat):
        print(f"  {cat}: {by_cat[cat]}")

    if not args.answers:
        return 0

    ans_rows = load_jsonl(args.answers)
    answers = {r["id"]: r["answer"] for r in ans_rows if "id" in r and "answer" in r}
    print(f"\nScoring {len(answers)} answers against eval set…")
    return score_answers(items, answers)


if __name__ == "__main__":
    raise SystemExit(main())
