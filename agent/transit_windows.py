"""
ADMIN ONLY — transit windows dashboard (Jobs tab). See ARCHITECTURE.md.

Upcoming double/triple transit windows categorized for gains, travel, and partnerships.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import swisseph as swe

from agent.calculator import (
    RASI_NAMES,
    TRANSIT_IMPACT,
    _find_sign_ingresses_in_range,
    _resolve_ayanamsa_mode,
    _jd_from_dt,
    _transit_aspects_sign,
    calculate_chart,
    get_dasha_transit_forecast,
)

FORECAST_YEARS = 5
STEP_DAYS = 30


def _house_from(sign: int, lagna_idx: int) -> int:
    return ((sign - lagna_idx) % 12) + 1


def _parse_event_date(e: dict) -> datetime | None:
    ds = e.get("date_str") or ""
    try:
        return datetime.strptime(ds, "%b %Y")
    except ValueError:
        return None


def _window(
    *,
    tier: str,
    category: str,
    title: str,
    start: str,
    end: str,
    summary: str,
    planets: str,
    quality: str = "major",
    sort_key: datetime | None = None,
) -> dict[str, Any]:
    return {
        "tier": tier,
        "category": category,
        "title": title,
        "start": start,
        "end": end,
        "summary": summary,
        "planets": planets,
        "quality": quality,
        "icon": TRANSIT_IMPACT.get(quality, "⚪"),
        "_sort": sort_key or datetime.utcnow(),
    }


def _scan_conjunction_windows(
    natal_lagna_idx: int,
    natal_moon_sign: int,
    forecast_start: datetime,
    forecast_end: datetime,
    ayanamsa_mode: int | None = None,
) -> list[dict[str, Any]]:
    """Monthly sweep for double (Jup+Sat) and triple (Jup+Sat+Rahu) aspect windows."""
    if ayanamsa_mode is None:
        flags = swe.FLG_SPEED
    else:
        swe.set_sid_mode(ayanamsa_mode)
        flags = swe.FLG_SIDEREAL
    windows: list[dict[str, Any]] = []
    cur = forecast_start
    in_double: dict | None = None
    in_triple: dict | None = None

    def _close_double(end_dt: datetime) -> None:
        nonlocal in_double
        if not in_double:
            return
        ju_s, sa_s, ref_s, ref_l = in_double["key"]
        windows.append(
            _window(
                tier="double",
                category="multi",
                title=f"Double transit — natal {ref_l}",
                start=in_double["start"].strftime("%b %Y"),
                end=end_dt.strftime("%b %Y"),
                summary=(
                    f"Jupiter ({RASI_NAMES[ju_s]}) and Saturn ({RASI_NAMES[sa_s]}) both "
                    f"aspect natal {ref_l} ({RASI_NAMES[ref_s]}). Strong timing for major "
                    f"life chapters — gains, moves, and partnerships often activate together."
                ),
                planets="Jupiter + Saturn",
                quality="critical",
                sort_key=in_double["start"],
            )
        )
        in_double = None

    def _close_triple(end_dt: datetime) -> None:
        nonlocal in_triple
        if not in_triple:
            return
        ju_s, sa_s, ra_s, ref_s, ref_l = in_triple["key"]
        windows.append(
            _window(
                tier="triple",
                category="multi",
                title=f"Triple transit — natal {ref_l}",
                start=in_triple["start"].strftime("%b %Y"),
                end=end_dt.strftime("%b %Y"),
                summary=(
                    f"Jupiter, Saturn, and Rahu ({RASI_NAMES[ju_s]}, {RASI_NAMES[sa_s]}, "
                    f"{RASI_NAMES[ra_s]}) simultaneously influence natal {ref_l}. "
                    f"Rare intensification — watch decisions on money, travel, and relationships."
                ),
                planets="Jupiter + Saturn + Rahu",
                quality="critical",
                sort_key=in_triple["start"],
            )
        )
        in_triple = None

    while cur <= forecast_end:
        jd_c = _jd_from_dt(cur)
        ju_r, _ = swe.calc_ut(jd_c, swe.JUPITER, flags)
        sa_r, _ = swe.calc_ut(jd_c, swe.SATURN, flags)
        ra_r, _ = swe.calc_ut(jd_c, swe.MEAN_NODE, flags)
        ju_s = int(ju_r[0] / 30) % 12
        sa_s = int(sa_r[0] / 30) % 12
        ra_s = int(ra_r[0] / 30) % 12

        for ref_sign, ref_lbl in ((natal_moon_sign, "Moon"), (natal_lagna_idx, "Lagna")):
            j_asp = _transit_aspects_sign("Jupiter", ju_s, ref_sign)
            s_asp = _transit_aspects_sign("Saturn", sa_s, ref_sign)
            r_asp = _transit_aspects_sign("Rahu", ra_s, ref_sign)
            if j_asp and s_asp and r_asp:
                key = (ju_s, sa_s, ra_s, ref_sign, ref_lbl)
                if in_triple is None or in_triple["key"] != key:
                    _close_triple(cur)
                    _close_double(cur)
                    in_triple = {"start": cur, "key": key}
                in_double = None
            elif j_asp and s_asp:
                key = (ju_s, sa_s, ref_sign, ref_lbl)
                if in_double is None or in_double["key"] != key:
                    _close_double(cur)
                    _close_triple(cur)
                    in_double = {"start": cur, "key": key}
            else:
                if in_triple and in_triple["key"][3] == ref_sign:
                    _close_triple(cur)
                if in_double and in_double["key"][2] == ref_sign:
                    _close_double(cur)
        cur += timedelta(days=STEP_DAYS)

    _close_double(forecast_end)
    _close_triple(forecast_end)
    return windows


def _categorize_forecast_event(
    e: dict,
    natal_lagna_idx: int,
    natal_moon_sign: int,
) -> list[str]:
    """Return category tags: gains, travels, partnerships."""
    cats: list[str] = []
    detail = (e.get("detail") or "").lower()
    typ = (e.get("type") or "").lower()
    planet = (e.get("planet") or "").lower()

    h_lagna = h_moon = None
    for part in detail.replace("·", " ").split():
        if part.endswith("th") and part[:-2].isdigit():
            h = int(part[:-2])
            if "lagna" in detail[: detail.find(part) + 20]:
                h_lagna = h
            if "moon" in detail:
                h_moon = h

    if "double transit" in typ or "jupiter + saturn" in planet:
        return ["gains", "travels", "partnerships"]

    if "jupiter" in planet or "♃" in typ:
        if h_lagna in (2, 5, 9, 11) or h_moon in (2, 5, 11):
            cats.append("gains")
        if h_lagna in (9, 12, 3) or h_moon in (9, 12):
            cats.append("travels")
        if h_lagna == 7 or h_moon == 7:
            cats.append("partnerships")

    if "rahu" in planet or "ketu" in planet:
        if h_lagna in (9, 12, 3):
            cats.append("travels")
        if h_lagna in (7, 11):
            cats.append("partnerships")
        if h_lagna in (11, 2):
            cats.append("gains")

    if "saturn" in planet:
        if "7th" in detail or h_lagna == 7:
            cats.append("partnerships")
        if "kantaka" in detail.lower():
            if h_lagna == 7:
                cats.append("partnerships")

    return list(dict.fromkeys(cats))


def _ingress_windows(
    natal_lagna_idx: int,
    natal_moon_sign: int,
    forecast_start: datetime,
    forecast_end: datetime,
    ayanamsa_mode: str | int | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for dt_in, sign in _find_sign_ingresses_in_range(
        swe.JUPITER, forecast_start, forecast_end, 15, ayanamsa_mode=ayanamsa_mode
    ):
        h = _house_from(sign, natal_lagna_idx)
        if h not in (2, 5, 7, 9, 11, 12, 3):
            continue
        cats = []
        if h in (2, 5, 11):
            cats.append("gains")
        if h in (9, 12, 3):
            cats.append("travels")
        if h == 7:
            cats.append("partnerships")
        if not cats:
            continue
        q = "positive" if h in (1, 5, 9) else "moderate"
        w = _window(
            tier="ingress",
            category=",".join(cats),
            title=f"Jupiter enters {RASI_NAMES[sign]}",
            start=dt_in.strftime("%b %Y"),
            end="~1 year",
            summary=(
                f"Jupiter transits your {h}th house from Lagna — "
                + {
                    2: "wealth and family resources expand.",
                    5: "creativity, speculation, and recognition.",
                    7: "partnerships, marriage, and contracts.",
                    9: "long journeys, dharma, and mentors.",
                    11: "gains, networks, and fulfillment of desires.",
                    12: "foreign lands, retreat, and spiritual travel.",
                    3: "short travel, courage, and communication.",
                }.get(h, "house themes activate.")
            ),
            planets="Jupiter",
            quality=q,
            sort_key=dt_in,
        )
        out.append(w)
    return out


def get_transit_windows(date: str, time: str, place: str, ayanamsa: str = "lahiri") -> dict[str, Any]:
    result = calculate_chart(date, time or "12:00", place.strip(), ayanamsa=ayanamsa)
    lagna_idx = RASI_NAMES.index(result["lagna_rasi"])
    moon_sign = int(result["positions"]["Moon"] / 30) % 12
    now = datetime.utcnow()
    forecast_end = now + timedelta(days=int(FORECAST_YEARS * 365.25))

    eff_ayan = _resolve_ayanamsa_mode(result.get("ayanamsa_mode", "lahiri"))

    raw: list[dict[str, Any]] = []

    raw.extend(
        _scan_conjunction_windows(lagna_idx, moon_sign, now, forecast_end, ayanamsa_mode=eff_ayan)
    )
    raw.extend(
        _ingress_windows(lagna_idx, moon_sign, now, forecast_end, ayanamsa_mode=eff_ayan)
    )

    ayan_str = result.get("ayanamsa_mode", "lahiri")
    for e in get_dasha_transit_forecast(
        result.get("dasha") or {}, result["positions"], lagna_idx, ayanamsa_mode=ayan_str
    ):
        dt = _parse_event_date(e)
        if dt and dt < now - timedelta(days=45):
            continue
        cats = _categorize_forecast_event(e, lagna_idx, moon_sign)
        if not cats:
            continue
        end = e.get("end_date_str") or "—"
        raw.append(
            _window(
                tier="forecast",
                category=",".join(cats),
                title=e.get("type", "Transit event"),
                start=e.get("date_str", ""),
                end=end,
                summary=e.get("detail", ""),
                planets=e.get("planet", ""),
                quality=e.get("quality", "moderate"),
                sort_key=dt,
            )
        )

    for alert in (result.get("gochara") or {}).get("alerts") or []:
        atype = alert.get("type", "")
        if "DOUBLE" not in atype.upper():
            continue
        raw.append(
            _window(
                tier="double",
                category="gains,travels,partnerships",
                title=atype,
                start=now.strftime("%b %Y"),
                end=alert.get("exit_approx", "—"),
                summary=alert.get("body", ""),
                planets=alert.get("planet", ""),
                quality=alert.get("severity", "critical"),
                sort_key=now,
            )
        )

    gains: list[dict] = []
    travels: list[dict] = []
    partnerships: list[dict] = []

    seen: set[str] = set()

    def _add(cat_list: list[dict], w: dict, cat: str) -> None:
        key = f"{w['title']}|{w['start']}|{cat}"
        if key in seen:
            return
        seen.add(key)
        item = {k: v for k, v in w.items() if k != "_sort"}
        cat_list.append(item)

    raw.sort(key=lambda w: w.get("_sort") or now)
    for w in raw:
        for cat in (w.get("category") or "").split(","):
            cat = cat.strip()
            if cat == "gains":
                _add(gains, w, cat)
            elif cat == "travels":
                _add(travels, w, cat)
            elif cat == "partnerships":
                _add(partnerships, w, cat)
            elif cat == "multi":
                _add(gains, w, "gains")
                _add(travels, w, "travels")
                _add(partnerships, w, "partnerships")

    return {
        "profile": {"date": date, "time": time or "12:00", "place": place.strip()},
        "lagna": result["lagna_rasi"],
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gains": gains[:25],
        "travels": travels[:25],
        "partnerships": partnerships[:25],
    }
