"""
Basic tests for the Vedic calculator.

Run with: pytest tests/ -q
"""

import pytest

import agent.env  # ensure env is loaded
from agent.calculator import (
    calculate_chart,
    get_navamsa_sign,
    get_drekkana_sign,
    get_dasamsa_sign,
    get_hora_d2_sign,
    get_saptamsa_d7_sign,
    get_dwadasamsa_d12_sign,
    get_trimsamsa_d30_sign,
    get_chaturthamsa_d4_sign,
    get_shodashamsa_d16_sign,
    get_vimsamsa_d20_sign,
    get_chaturvimshamsa_d24_sign,
    get_nakshatramsa_d27_sign,
    get_khavedamsa_d40_sign,
    get_akshavedamsa_d45_sign,
    get_shashtiamsa_d60_sign,
    RASI_NAMES,
)


SAMPLE = ("1993-06-19", "18:35", "visakhapatnam", "lahiri")


def test_calculate_chart_returns_expected_structure():
    result = calculate_chart(*SAMPLE)

    # Core keys that must always be present
    required = [
        "positions", "retrograde", "dignity", "combust",
        "chara_karakas", "d9_signs", "d3_signs", "d10_signs",
        "d2_signs", "d7_signs", "d12_signs", "d30_signs", "d4_signs", "d16_signs", "d20_signs", "d24_signs",
        "d27_signs", "d40_signs", "d45_signs", "d60_signs",
        "bav", "sarva", "yogas",
        "dasha", "chara_dasha", "dasha_forecast", "gochara", "shadbala", "lagna_rasi",
        "ayanamsa_mode", "ayanamsa",
        "lat", "lon", "tz", "rows",
    ]
    for key in required:
        assert key in result, f"Missing key: {key}"

    # Basic sanity
    assert result["lagna_rasi"] in RASI_NAMES
    assert 0 <= result["ayanamsa"] < 30  # Lahiri is typically ~23-24° these days
    assert len(result["positions"]) >= 10  # 9 planets + Lagna + Ketu/Rahu


def test_d9_navamsa_calculation():
    # Spot check known behavior for the sample
    result = calculate_chart(*SAMPLE)
    d9 = result["d9_signs"]

    # Lagna should have a valid D9 sign
    assert "Lagna" in d9
    assert 0 <= d9["Lagna"] <= 11

    # All planets have D9
    for planet in ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]:
        assert planet in d9
        assert 0 <= d9[planet] <= 11


def test_dasha_structure():
    result = calculate_chart(*SAMPLE)
    dasha = result["dasha"]

    assert "natal_dasha_lord" in dasha
    assert "current" in dasha
    assert "timeline" in dasha
    assert len(dasha["timeline"]) >= 3  # at least some periods around now

    if dasha["current"]:
        assert "mahadasha" in dasha["current"]
        assert "antardasha" in dasha["current"]


def test_chara_dasha_structure():
    result = calculate_chart(*SAMPLE)
    ch = result.get("chara_dasha", {})
    assert "timeline" in ch and len(ch["timeline"]) == 12
    assert "current" in ch
    assert "natal_dasha_lord" in ch
    assert ch["timeline"][0]["sign"] == result["lagna_rasi"]
    # variable years and lord info present
    for t in ch["timeline"]:
        assert 1 <= t.get("years", 0) <= 12
        assert "lord" in t
    # direction recorded
    assert ch.get("direction") in ("forward", "reverse")


def test_yogas_and_gochara_present():
    result = calculate_chart(*SAMPLE)
    assert isinstance(result["yogas"], list)
    assert "gochara" in result
    assert "alerts" in result["gochara"]


def test_ashtakavarga_full():
    result = calculate_chart(*SAMPLE)
    sarva = result["sarva"]
    bav = result.get("bav", {})
    assert len(sarva) == 12
    assert all(isinstance(x, (int, float)) for x in sarva)
    assert sum(sarva) > 0
    assert "Jupiter" in bav and len(bav["Jupiter"]) == 12
    assert all(isinstance(x, int) for x in bav["Jupiter"])

def test_shadbala():
    result = calculate_chart(*SAMPLE)
    sh = result.get("shadbala", {})
    assert "Sun" in sh and "total_rupa" in sh["Sun"]
    assert isinstance(sh["Sun"]["total_rupa"], (int, float))

def test_golden_values_for_sample():
    """Golden values computed from current implementation for the sample chart.
    These should be cross-verified against reference software (e.g. Jagannatha Hora)
    when extending or for regression. Update if formulas change intentionally.
    """
    result = calculate_chart(*SAMPLE)
    # Vargas for Lagna
    assert result["d3_signs"]["Lagna"] == 8
    assert result["d10_signs"]["Lagna"] == 9
    # Shadbala
    assert abs(result["shadbala"]["Jupiter"]["total_rupa"] - 2.87) < 0.1
    # BAV
    assert result["bav"]["Jupiter"][0] == 5
    # Ashtakavarga Sarva total approx
    assert sum(result["sarva"]) > 200
    # Chara Dasha
    ch = result.get("chara_dasha", {})
    assert len(ch.get("timeline", [])) == 12
    assert ch.get("timeline", [{}])[0]["sign"] == result["lagna_rasi"]

def test_ayanamsa_selector():
    r_lahiri = calculate_chart("1993-06-19", "18:35", "visakhapatnam", "lahiri")
    r_raman = calculate_chart("1993-06-19", "18:35", "visakhapatnam", "raman")
    # Positions should differ
    assert r_lahiri["positions"]["Sun"] != r_raman["positions"]["Sun"]
    assert r_lahiri["ayanamsa_mode"] == "lahiri"
    assert r_raman["ayanamsa_mode"] == "raman"
    # Structure preserved
    assert "d9_signs" in r_lahiri and "shadbala" in r_lahiri

    # Tropical / no ayanamsa
    r_trop = calculate_chart("1993-06-19", "18:35", "visakhapatnam", "tropical")
    assert r_trop["ayanamsa_mode"] == "tropical"
    assert r_trop["ayanamsa"] == 0.0
    # Tropical positions differ from Lahiri (by roughly current ayanamsa ~23.5°)
    assert r_trop["positions"]["Sun"] != r_lahiri["positions"]["Sun"]
    # Lagna sign may or may not flip depending on exact cusp, but degrees differ
    assert r_trop["positions"]["Lagna"] != r_lahiri["positions"]["Lagna"]


def test_drekkana_d3_calculation():
    result = calculate_chart(*SAMPLE)
    d3 = result.get("d3_signs", {})
    assert "Lagna" in d3 and 0 <= d3["Lagna"] <= 11
    for p in ["Sun", "Moon", "Jupiter"]:
        assert p in d3
        assert 0 <= d3[p] <= 11


def test_dasamsa_d10_calculation():
    result = calculate_chart(*SAMPLE)
    d10 = result.get("d10_signs", {})
    assert "Lagna" in d10 and 0 <= d10["Lagna"] <= 11
    for p in ["Sun", "Saturn", "Mars"]:
        assert p in d10
        assert 0 <= d10[p] <= 11


def test_divisional_functions_standalone():
    # Quick unit check on helpers
    # 0° Aries → D3 same sign, D10 same
    assert get_drekkana_sign(0.0) == 0
    assert get_dasamsa_sign(0.0) == 0

    # 15° Aries → D3 +4 = Leo (4)
    assert get_drekkana_sign(15.0) == 4

    # 25° Aries → D3 +8 = Sagittarius (8)
    assert get_drekkana_sign(25.0) == 8

    # New vargas unit checks
    assert get_hora_d2_sign(0.0) == 4  # Leo for odd sign first half
    assert get_saptamsa_d7_sign(0.0) == 0
    assert get_dwadasamsa_d12_sign(0.0) == 0
    assert get_trimsamsa_d30_sign(0.0) == 0

    # Additional Vargas
    assert get_chaturthamsa_d4_sign(0.0) == 0
    assert get_shodashamsa_d16_sign(0.0) == 0
    assert get_vimsamsa_d20_sign(0.0) == 0
    assert get_chaturvimshamsa_d24_sign(0.0) == 0

    # Higher
    assert get_nakshatramsa_d27_sign(0.0) == 0
    assert get_khavedamsa_d40_sign(0.0) == 0
    assert get_akshavedamsa_d45_sign(0.0) == 0
    assert get_shashtiamsa_d60_sign(0.0) == 0

    # Structure for new in calculate
    result = calculate_chart(*SAMPLE)
    for key in ["d2_signs", "d7_signs", "d12_signs", "d30_signs", "d4_signs", "d16_signs", "d20_signs", "d24_signs",
                "d27_signs", "d40_signs", "d45_signs", "d60_signs"]:
        d = result.get(key, {})
        assert "Lagna" in d and 0 <= d["Lagna"] <= 11
        for p in ["Sun", "Moon", "Jupiter"]:
            assert p in d
            assert 0 <= d[p] <= 11
