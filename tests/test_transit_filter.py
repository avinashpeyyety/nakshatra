"""Tests for transit_filter (Gochara + Time Dial filtering)."""

from agent.calculator import calculate_chart
from agent.transit_filter import (
    compute_dial_alerts,
    filter_forecast_events,
    filter_gochara_alerts,
    organize_dial_banner,
)

SAMPLE = ("1993-06-19", "18:35", "visakhapatnam", "lahiri")


def _make_alert(type_: str, severity: str = "major", **extra) -> dict:
    base = {
        "type": type_,
        "severity": severity,
        "icon": "🟠",
        "phase": "Active",
        "body": "test",
        "planet": "Saturn",
        "sign": "Capricorn",
        "house_from": "1th from Lagna",
        "sarva_score": 24,
        "remaining": "1 yr",
        "exit_approx": "Jun 2027",
    }
    base.update(extra)
    return base


def test_filter_gochara_caps_primary_and_moves_jupiter_secondary():
    alerts = [
        _make_alert("SADE SATI", severity="critical"),
        _make_alert("ASHTAMA SHANI"),
        _make_alert("DOUBLE TRANSIT — natal Moon", severity="critical", planet="Jupiter + Saturn"),
        _make_alert("DOUBLE TRANSIT — Lagna", severity="critical", planet="Jupiter + Saturn"),
        _make_alert("KANTAKA SHANI (4th from Lagna)"),
        _make_alert("Rahu TRANSIT — over natal Moon (Cancer)", planet="Rahu"),
        _make_alert("Ketu TRANSIT — over natal Sun (Leo)", planet="Ketu"),
        _make_alert("JUPITER TRANSIT — 5th from Lagna", severity="positive", planet="Jupiter"),
        _make_alert("RAHU/KETU AXIS — 3th / 9th", severity="info", planet="Rahu / Ketu"),
    ]
    primary, secondary = filter_gochara_alerts(alerts, max_primary=6)
    assert len(primary) <= 6
    assert any("SADE SATI" in a["type"] for a in primary)
    assert any("JUPITER TRANSIT" in a["type"] for a in secondary)
    assert any("RAHU/KETU AXIS" in a["type"] for a in secondary)


def test_filter_gochara_suppresses_kantaka_when_sade_present():
    alerts = [
        _make_alert("SADE SATI", severity="critical"),
        _make_alert("KANTAKA SHANI (10th from Lagna)"),
    ]
    primary, _ = filter_gochara_alerts(alerts)
    types = [a["type"] for a in primary]
    assert any("SADE SATI" in t for t in types)
    assert not any("KANTAKA" in t for t in types)


def test_compute_dial_alerts_always_shows_sade_and_ashtama():
    natal = {
        "Sun": 30.0, "Moon": 0.0, "Mercury": 60.0, "Venus": 150.0,
        "Mars": 90.0, "Jupiter": 240.0, "Saturn": 270.0,
        "Rahu": 300.0, "Ketu": 120.0,
    }
    transit_sade = {
        "Sun": 0.0, "Moon": 90.0, "Mercury": 0.0, "Venus": 0.0,
        "Mars": 0.0, "Jupiter": 60.0, "Saturn": 0.0,
        "Rahu": 0.0, "Ketu": 180.0,
    }
    organized, _ = compute_dial_alerts(transit_sade, natal, 0, min_score=70)
    all_texts = [a["text"] for a in organized["alerts"]]
    top_texts = [a["text"] for a in organized["top"]]
    assert any("Sade Sati" in t for t in all_texts)
    assert any("Sade Sati" in t for t in top_texts)

    transit_ashta = dict(transit_sade)
    transit_ashta["Saturn"] = 210.0  # sign 7 — 8th from Moon
    transit_ashta["Jupiter"] = 0.0  # break double transit
    organized2, _ = compute_dial_alerts(transit_ashta, natal, 0, min_score=70)
    assert any("Ashtama" in a["text"] for a in organized2["alerts"])


def test_compute_dial_alerts_excludes_life_heuristics_by_default():
    # Fixed positions: Jupiter in sign 6, Saturn in sign 0 — craft aspecting Moon at 0
    transit = {
        "Sun": 0.0, "Moon": 90.0, "Mercury": 0.0, "Venus": 120.0,
        "Mars": 0.0, "Jupiter": 180.0, "Saturn": 0.0,
        "Rahu": 0.0, "Ketu": 180.0,
    }
    natal = {
        "Sun": 30.0, "Moon": 0.0, "Mercury": 60.0, "Venus": 150.0,
        "Mars": 90.0, "Jupiter": 240.0, "Saturn": 270.0,
        "Rahu": 300.0, "Ketu": 120.0,
    }
    organized, raw = compute_dial_alerts(transit, natal, 0, life_events=False, min_score=50)
    texts = [a["text"] for a in organized["alerts"]]
    assert raw >= len(organized["alerts"])
    assert not any("Marriage" in t or "Childbirth" in t for t in texts)


def test_compute_dial_alerts_includes_life_hints_when_enabled():
    transit = {
        "Sun": 0.0, "Moon": 90.0, "Mercury": 0.0, "Venus": 150.0,
        "Mars": 0.0, "Jupiter": 180.0, "Saturn": 0.0,
        "Rahu": 0.0, "Ketu": 180.0,
    }
    natal = {
        "Sun": 30.0, "Moon": 0.0, "Mercury": 60.0, "Venus": 150.0,
        "Mars": 90.0, "Jupiter": 240.0, "Saturn": 270.0,
        "Rahu": 300.0, "Ketu": 120.0,
    }
    organized, _ = compute_dial_alerts(transit, natal, 0, life_events=True, min_score=40)
    texts = " ".join(a["text"] for a in organized["alerts"])
    assert "Jupiter" in texts or "Venus" in texts or "Double Transit" in texts


def test_organize_dial_banner_top_three_and_categories():
    alerts = [
        {"text": "Double", "score": 90, "category": "double_transit",
         "level": "critical", "color": "#f00", "sub": "s1"},
        {"text": "Sade", "score": 80, "category": "saturn",
         "level": "major", "color": "#f90", "sub": "s2"},
        {"text": "Ashtama", "score": 70, "category": "saturn",
         "level": "major", "color": "#f90", "sub": "s3"},
        {"text": "Rahu", "score": 60, "category": "nodes",
         "level": "major", "color": "#f90", "sub": "s4"},
    ]
    out = organize_dial_banner(alerts)
    assert [a["text"] for a in out["top"]] == ["Double", "Sade", "Ashtama"]
    assert len(out["categories"]) == 1
    assert out["categories"][0]["id"] == "nodes"
    assert out["categories"][0]["alerts"][0]["text"] == "Rahu"


def test_filter_forecast_reduces_ingress_noise():
    from agent.calculator import RASI_NAMES, get_dasha_transit_forecast

    result = calculate_chart(*SAMPLE)
    lagna_idx = RASI_NAMES.index(result["lagna_rasi"])
    full = get_dasha_transit_forecast(
        result["dasha"], result["positions"], lagna_idx,
        ayanamsa_mode=result.get("ayanamsa_mode"),
    )
    filtered = filter_forecast_events(full, result["positions"], lagna_idx)
    assert len(filtered) <= 15
    assert len(filtered) <= len(full)


def test_get_current_transits_returns_filtered_gochara():
    result = calculate_chart(*SAMPLE)
    gochara = result["gochara"]
    assert "alerts" in gochara
    assert "alerts_secondary" in gochara
    assert len(gochara["alerts"]) <= 6