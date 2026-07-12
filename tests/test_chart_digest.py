"""Tests for calculator-grounded chart digest."""
from __future__ import annotations

import pytest

from agent.calculator import calculate_chart
from agent.chart_digest import (
    DIGEST_VERSION,
    build_chart_digest,
    chart_fingerprint,
)


SAMPLE = ("1993-06-19", "18:35", "visakhapatnam", "lahiri")


@pytest.fixture(scope="module")
def chart_result():
    return calculate_chart(*SAMPLE)


def test_fingerprint_stable():
    a = chart_fingerprint(*SAMPLE[:3], SAMPLE[3])
    b = chart_fingerprint(*SAMPLE[:3], SAMPLE[3])
    assert a == b
    assert len(a) == 24
    assert a != chart_fingerprint("2000-01-01", "12:00", "mumbai", "lahiri")


def test_digest_contains_core_facts(chart_result):
    d = build_chart_digest(
        chart_result,
        date=SAMPLE[0],
        time=SAMPLE[1],
        place=SAMPLE[2],
        ayanamsa=SAMPLE[3],
    )
    assert d["digest_version"] == DIGEST_VERSION
    assert d["fingerprint"]
    text = d["text"]
    assert "Sagittarius" in text or "lagna" in text.lower()
    assert "VIMSHOTTARI" in text
    assert "SHADBALA" in text
    assert "ASHTAKAVARGA" in text
    assert "VARGAS" in text
    assert "D9" in text or "Navamsa" in text
    # Natal Mars dasha lord for this sample (Moon nakshatra)
    structured = d["structured"]
    assert structured["lagna"]
    assert len(structured["planets"]) >= 9
    assert structured["vimshottari"].get("natal_lord")


def test_digest_does_not_require_llm(chart_result):
    d = build_chart_digest(
        chart_result,
        date=SAMPLE[0],
        time=SAMPLE[1],
        place=SAMPLE[2],
        ayanamsa=SAMPLE[3],
    )
    assert "do not invent" in d["text"].lower() or "DIGEST" in d["text"]
