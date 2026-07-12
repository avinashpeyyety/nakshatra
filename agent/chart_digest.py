"""
Build a concise, calculator-grounded chart digest for the local advisor LLM.

All numbers come from calculate_chart() — the model must not invent ephemeris.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from agent.calculator import NAKSHATRA_DATA, NAKSHATRA_SPAN, RASI_NAMES

DIGEST_VERSION = "1"

# Planets we always include in the digest (order)
_PLANETS = [
    "Lagna",
    "Sun",
    "Moon",
    "Mars",
    "Mercury",
    "Jupiter",
    "Venus",
    "Saturn",
    "Rahu",
    "Ketu",
]

_KEY_VARGAS = (
    ("d9_signs", "D9 Navamsa"),
    ("d10_signs", "D10 Dasamsa"),
    ("d7_signs", "D7 Saptamsa"),
    ("d12_signs", "D12 Dwadasamsa"),
    ("d2_signs", "D2 Hora"),
    ("d3_signs", "D3 Drekkana"),
    ("d4_signs", "D4 Chaturthamsa"),
    ("d16_signs", "D16 Shodashamsa"),
    ("d20_signs", "D20 Vimsamsa"),
    ("d24_signs", "D24 Chaturvimshamsa"),
    ("d27_signs", "D27 Nakshatramsa"),
    ("d30_signs", "D30 Trimsamsa"),
    ("d40_signs", "D40 Khavedamsa"),
    ("d45_signs", "D45 Akshavedamsa"),
    ("d60_signs", "D60 Shashtiamsa"),
)

_VARGA_FOCUS = ("Lagna", "Sun", "Moon", "Mercury", "Venus", "Jupiter", "Mars", "Saturn")


def _sign_name(idx: int | None) -> str:
    if idx is None:
        return "?"
    try:
        return RASI_NAMES[int(idx) % 12]
    except (TypeError, ValueError, IndexError):
        return "?"


def _nakshatra_of(lon: float) -> tuple[str, str, int]:
    """Return (name, ruler, pada 1-4)."""
    span = NAKSHATRA_SPAN
    idx = int(lon / span) % 27
    _, name, ruler = NAKSHATRA_DATA[idx]
    within = lon % span
    pada = min(4, int(within / (span / 4.0)) + 1)
    return name, ruler, pada


def _house_from_lagna(planet_rasi: int, lagna_rasi: int) -> int:
    return ((planet_rasi - lagna_rasi) % 12) + 1


def chart_fingerprint(
    date: str,
    time: str,
    place: str,
    ayanamsa: str = "lahiri",
) -> str:
    raw = f"{date}|{time}|{place.strip().lower()}|{(ayanamsa or 'lahiri').lower()}|v{DIGEST_VERSION}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def build_chart_digest_dict(
    result: dict[str, Any],
    *,
    date: str,
    time: str,
    place: str,
    ayanamsa: str = "lahiri",
) -> dict[str, Any]:
    """Structured digest for caching / debugging."""
    positions: dict[str, float] = result.get("positions") or {}
    lagna_rasi = result.get("lagna_rasi") or _sign_name(
        int(positions.get("Lagna", 0) / 30.0) % 12
    )
    lagna_idx = RASI_NAMES.index(lagna_rasi) if lagna_rasi in RASI_NAMES else 0
    dignity = result.get("dignity") or {}
    retro = result.get("retrograde") or {}
    combust = result.get("combust") or {}

    planets: list[dict[str, Any]] = []
    for p in _PLANETS:
        if p not in positions:
            continue
        lon = float(positions[p])
        rasi_idx = int(lon / 30.0) % 12
        deg_in_sign = lon % 30.0
        nak, nak_ruler, pada = _nakshatra_of(lon)
        house = _house_from_lagna(rasi_idx, lagna_idx) if p != "Lagna" else 1
        entry: dict[str, Any] = {
            "planet": p,
            "sign": RASI_NAMES[rasi_idx],
            "degree": round(deg_in_sign, 2),
            "longitude": round(lon, 2),
            "house": house,
            "nakshatra": nak,
            "nakshatra_ruler": nak_ruler,
            "pada": pada,
        }
        if p != "Lagna":
            entry["dignity"] = dignity.get(p, "")
            entry["retrograde"] = bool(retro.get(p))
            entry["combust"] = bool(combust.get(p))
        planets.append(entry)

    dasha = result.get("dasha") or {}
    chara = result.get("chara_dasha") or {}
    current = dasha.get("current") or {}
    chara_current = chara.get("current") or {}

    yogas_out: list[dict[str, str]] = []
    for y in result.get("yogas") or []:
        if isinstance(y, dict):
            yogas_out.append(
                {
                    "name": str(y.get("name") or y.get("yoga") or "Yoga"),
                    "note": str(y.get("description") or y.get("note") or "")[:200],
                }
            )
        else:
            yogas_out.append({"name": str(y), "note": ""})

    shadbala_out: list[dict[str, Any]] = []
    sb = result.get("shadbala") or {}
    for p, vals in sb.items():
        if not isinstance(vals, dict):
            continue
        shadbala_out.append(
            {
                "planet": p,
                "total_rupa": round(float(vals.get("total_rupa") or 0), 2),
                "is_strong": bool(vals.get("is_strong")),
            }
        )
    shadbala_out.sort(key=lambda x: -x["total_rupa"])

    sarva = result.get("sarva") or []
    bav = result.get("bav") or {}
    ashtaka: dict[str, Any] = {
        "sarva_by_sign": {
            RASI_NAMES[i]: int(sarva[i]) for i in range(min(12, len(sarva)))
        },
    }
    # Compact BAV: total bindus per planet
    bav_totals = {}
    for p, scores in bav.items():
        if isinstance(scores, (list, tuple)):
            bav_totals[p] = int(sum(scores))
    ashtaka["bav_totals"] = bav_totals

    vargas: dict[str, dict[str, str]] = {}
    for key, label in _KEY_VARGAS:
        signs = result.get(key) or {}
        if not signs:
            continue
        vargas[label] = {
            p: _sign_name(signs.get(p))
            for p in _VARGA_FOCUS
            if p in signs
        }

    gochara = result.get("gochara") or {}
    alerts = gochara.get("alerts") or []
    gochara_top: list[str] = []
    for a in alerts[:8]:
        if isinstance(a, dict):
            gochara_top.append(
                str(a.get("title") or a.get("text") or a.get("summary") or a)[:160]
            )
        else:
            gochara_top.append(str(a)[:160])

    karakas = result.get("chara_karakas") or {}

    return {
        "digest_version": DIGEST_VERSION,
        "fingerprint": chart_fingerprint(date, time, place, ayanamsa),
        "birth": {
            "date": date,
            "time": time,
            "place": place,
            "ayanamsa": ayanamsa or result.get("ayanamsa_mode") or "lahiri",
            "ayanamsa_deg": round(float(result.get("ayanamsa") or 0), 2),
        },
        "lagna": lagna_rasi,
        "house_system": "whole-sign",
        "zodiac": "sidereal" if (ayanamsa or "").lower() != "tropical" else "tropical",
        "planets": planets,
        "vimshottari": {
            "natal_lord": dasha.get("natal_dasha_lord"),
            "natal_balance_years": dasha.get("natal_balance_years"),
            "current": current,
        },
        "chara_dasha": {
            "direction": chara.get("direction"),
            "natal_lord": chara.get("natal_dasha_lord"),
            "current": chara_current,
        },
        "yogas": yogas_out[:20],
        "shadbala": shadbala_out,
        "ashtakavarga": ashtaka,
        "vargas": vargas,
        "chara_karakas": karakas,
        "gochara_alerts": gochara_top,
    }


def digest_to_text(digest: dict[str, Any]) -> str:
    """Compact prose/JSON hybrid for the LLM context window."""
    lines: list[str] = [
        f"CHART DIGEST v{digest.get('digest_version')} (calculator-grounded; do not invent numbers)",
        f"Birth: {digest['birth']['date']} {digest['birth']['time']} @ {digest['birth']['place']}",
        f"Ayanamsa: {digest['birth']['ayanamsa']} ({digest['birth'].get('ayanamsa_deg')}°)",
        f"Lagna: {digest.get('lagna')} | Houses: {digest.get('house_system')} | Zodiac: {digest.get('zodiac')}",
        "",
        "PLANETS (sign, deg-in-sign, house, nakshatra-pada, dignity):",
    ]
    for p in digest.get("planets") or []:
        extra = ""
        if p.get("planet") != "Lagna":
            flags = []
            if p.get("retrograde"):
                flags.append("R")
            if p.get("combust"):
                flags.append("combust")
            dig = p.get("dignity") or ""
            flag_s = (" " + ",".join(flags)) if flags else ""
            extra = f" dig={dig}{flag_s}"
        lines.append(
            f"  {p['planet']}: {p['sign']} {p['degree']}° H{p['house']} "
            f"{p['nakshatra']} p{p['pada']}{extra}"
        )

    vim = digest.get("vimshottari") or {}
    cur = vim.get("current") or {}
    lines += [
        "",
        "VIMSHOTTARI:",
        f"  Natal lord: {vim.get('natal_lord')} balance_yrs={vim.get('natal_balance_years')}",
        f"  Current: MD={cur.get('mahadasha')} AD={cur.get('antardasha')} "
        f"PD={cur.get('pratyantardasha')} "
        f"(MD ends {cur.get('mahadasha_end')}, AD ends {cur.get('antardasha_end')})",
    ]
    ch = digest.get("chara_dasha") or {}
    cc = ch.get("current") or {}
    lines += [
        "CHARA DASHA:",
        f"  Direction={ch.get('direction')} natal={ch.get('natal_lord')} current={cc}",
    ]

    yogas = digest.get("yogas") or []
    lines.append("")
    lines.append("YOGAS:")
    if not yogas:
        lines.append("  (none detected)")
    for y in yogas:
        note = f" — {y['note']}" if y.get("note") else ""
        lines.append(f"  {y['name']}{note}")

    lines.append("")
    lines.append("SHADBALA (total rupa, strong≥5):")
    for s in digest.get("shadbala") or []:
        mark = "strong" if s.get("is_strong") else "weak"
        lines.append(f"  {s['planet']}: {s['total_rupa']} ({mark})")

    ash = digest.get("ashtakavarga") or {}
    lines.append("")
    lines.append("ASHTAKAVARGA sarva by sign:")
    sarva = ash.get("sarva_by_sign") or {}
    if sarva:
        lines.append("  " + ", ".join(f"{k}:{v}" for k, v in sarva.items()))
    bt = ash.get("bav_totals") or {}
    if bt:
        lines.append("BAV totals: " + ", ".join(f"{k}:{v}" for k, v in bt.items()))

    lines.append("")
    lines.append("VARGAS (key planets → sign):")
    for label, mapping in (digest.get("vargas") or {}).items():
        parts = [f"{p}={s}" for p, s in mapping.items()]
        lines.append(f"  {label}: " + ", ".join(parts))

    kk = digest.get("chara_karakas") or {}
    if kk:
        lines.append("")
        lines.append("CHARA KARAKAS: " + ", ".join(f"{k}={v}" for k, v in kk.items()))

    alerts = digest.get("gochara_alerts") or []
    lines.append("")
    lines.append("GOCHARA ALERTS (top):")
    if not alerts:
        lines.append("  (none)")
    for a in alerts:
        lines.append(f"  - {a}")

    lines.append("")
    lines.append(
        "END DIGEST — Interpret only using these facts. Educational, not medical/legal advice."
    )
    return "\n".join(lines)


def build_chart_digest(
    result: dict[str, Any],
    *,
    date: str,
    time: str,
    place: str,
    ayanamsa: str = "lahiri",
) -> dict[str, Any]:
    """Return {fingerprint, structured, text} for LLM and APIs."""
    structured = build_chart_digest_dict(
        result, date=date, time=time, place=place, ayanamsa=ayanamsa
    )
    return {
        "fingerprint": structured["fingerprint"],
        "structured": structured,
        "text": digest_to_text(structured),
        "digest_version": DIGEST_VERSION,
    }


def digest_json_compact(structured: dict[str, Any]) -> str:
    return json.dumps(structured, ensure_ascii=False, separators=(",", ":"))
