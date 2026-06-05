"""
ADMIN ONLY — chart advisor tools. See ARCHITECTURE.md.

LangChain tools wrapping the app's Swiss Ephemeris calculation layer.
Charts are computed lazily; each tool returns factual JSON only (no interpretation).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool

from agent.calculator import (
    NAKSHATRA_DATA,
    NAKSHATRA_SPAN,
    RASI_NAMES,
    _jd_from_dt,
    calculate_chart,
    fmt_dms,
    get_planet_positions_only,
)


def _json(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


def _nak_name(deg: float) -> str:
    idx = int(deg / NAKSHATRA_SPAN) % 27
    return NAKSHATRA_DATA[idx][1]


@dataclass
class ChartSession:
    date: str
    time: str
    place: str
    ayanamsa: str = "lahiri"
    _chart: dict | None = None

    def load(self) -> dict:
        if self._chart is None:
            ayan = getattr(self, 'ayanamsa', 'lahiri')
            self._chart = calculate_chart(self.date, self.time, self.place, ayanamsa=ayan)
        return self._chart


def make_chart_tools(session: ChartSession) -> list[BaseTool]:
    """Tools bound to one birth profile; safe to call repeatedly (cached chart)."""

    def get_birth_chart_basics() -> str:
        """Birth chart metadata: Lagna, ayanamsa (mode and value), latitude, longitude, timezone. No planet list."""
        c = session.load()
        return _json(
            {
                "birth": f"{session.date} {session.time} @ {session.place}",
                "lagna": c["lagna_rasi"],
                "ayanamsa_mode": c.get("ayanamsa_mode", "lahiri"),
                "ayanamsa_deg": round(c["ayanamsa"], 4),
                "lat": c["lat"],
                "lon": c["lon"],
                "timezone": c["tz"],
            }
        )

    def get_natal_planetary_positions() -> str:
        """Natal sidereal positions: sign, DMS, whole-sign house from Lagna, nakshatra, retrograde, dignity, combust."""
        c = session.load()
        positions = c["positions"]
        lagna_idx = RASI_NAMES.index(c["lagna_rasi"])
        retro = c.get("retrograde") or {}
        dignity = c.get("dignity") or {}
        combust = c.get("combust") or {}
        rows = []
        for name, deg in positions.items():
            if name == "Lagna":
                continue
            rasi_idx = int(deg / 30) % 12
            house = ((rasi_idx - lagna_idx) % 12) + 1
            rows.append(
                {
                    "planet": name,
                    "sign": RASI_NAMES[rasi_idx],
                    "degree": fmt_dms(deg % 30),
                    "sidereal_longitude": round(deg, 4),
                    "house": house,
                    "nakshatra": _nak_name(deg),
                    "retrograde": bool(retro.get(name)),
                    "dignity": dignity.get(name),
                    "combust": bool(combust.get(name)),
                }
            )
        return _json({"lagna": c["lagna_rasi"], "planets": rows})

    def get_vimshottari_dasha_periods() -> str:
        """Vimshottari dasha: natal starting lord, current MD/AD/PD, timeline and antardasha tables."""
        c = session.load()
        dasha = c.get("dasha") or {}
        out: dict[str, Any] = {
            "natal_dasha_lord": dasha.get("natal_dasha_lord"),
            "natal_balance_years": dasha.get("natal_balance_years"),
            "current": dasha.get("current"),
            "timeline": dasha.get("timeline"),
        }
        return _json(out)

    def get_gochara_transit_alerts() -> str:
        """Gochara alerts for TODAY vs this natal chart (Sade Sati, sign transits, aspects, severity)."""
        c = session.load()
        gochara = c.get("gochara") or {}
        return _json(
            {
                "computed_at_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "transit_positions": gochara.get("transit_positions"),
                "alerts": gochara.get("alerts"),
            }
        )

    def get_current_transiting_positions() -> str:
        """Current sky: sidereal longitudes of all transiting planets (now UTC)."""
        c = session.load()
        gochara = c.get("gochara") or {}
        positions = gochara.get("transit_positions") or {}
        rows = [
            {
                "planet": p,
                "sign": RASI_NAMES[int(deg / 30) % 12],
                "degree": fmt_dms(deg % 30),
                "sidereal_longitude": round(deg, 4),
            }
            for p, deg in positions.items()
        ]
        return _json(
            {
                "computed_at_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "positions": rows,
            }
        )

    def get_transiting_positions_at(datetime_iso: str) -> str:
        """Sidereal transit positions at a given UTC/ISO datetime (e.g. 2026-06-01T12:00 or 2026-06-01T12:00:00Z)."""
        parsed = datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
        if parsed.tzinfo:
            import pytz

            parsed = parsed.astimezone(pytz.utc).replace(tzinfo=None)
        positions = get_planet_positions_only(_jd_from_dt(parsed))
        rows = [
            {
                "planet": p,
                "sign": RASI_NAMES[int(deg / 30) % 12],
                "degree": fmt_dms(deg % 30),
                "sidereal_longitude": round(deg, 4),
            }
            for p, deg in positions.items()
        ]
        return _json({"datetime_utc": parsed.strftime("%Y-%m-%dT%H:%M:%SZ"), "positions": rows})

    def get_detected_yogas() -> str:
        """Yogas detected by the app (name, planets, description, benefic/challenging). Facts only."""
        c = session.load()
        yogas = c.get("yogas") or []
        return _json({"count": len(yogas), "yogas": yogas})

    def get_ashtakavarga_scores() -> str:
        """Ashtakavarga: Full Bhinna (per planet) + Sarvashtakavarga totals."""
        c = session.load()
        sarva = c.get("sarva") or []
        bav = c.get("bav") or {}
        return _json(
            {
                "sarvashtakavarga_by_sign": [
                    {"sign": RASI_NAMES[i], "bindus": sarva[i]} for i in range(12)
                ],
                "bhinna_ashtakavarga": {
                    p: {"signs": [RASI_NAMES[i] for i in range(12)], "bindus": scores}
                    for p, scores in bav.items()
                },
                "note": "BAV = bindus contributed by each planet per sign. Use for transit strength analysis.",
            }
        )

    def get_shadbala() -> str:
        """Shadbala: 6 balas (Sthana, Dig, Kala, Cheshta, Naisargika, Drik) + totals in Rupas."""
        c = session.load()
        sh = c.get("shadbala") or {}
        return _json({"shadbala": sh, "note": "Total in Rupas (60 Virupas = 1 Rupa). Strong if >= ~5 Rupas typically."})

    def get_chara_dasha_periods() -> str:
        """Jaimini Chara Dasha (sign-based periods) - basic implementation."""
        c = session.load()
        chara = c.get("chara_dasha") or {}
        return _json({"chara_dasha": chara, "note": "Jaimini Chara Dasha (direction + variable periods from Lagna). Pairs with Chara Karakas (AK etc). Full co-lord/sub-period rules extensible."})

    def get_dasha_period_transit_forecast() -> str:
        """Forecast of major transit ingresses/events during current and upcoming Vimshottari mahadashas."""
        c = session.load()
        forecast = c.get("dasha_forecast") or []
        return _json({"forecast": forecast})

    def get_navamsa_d9_positions() -> str:
        """Navamsa (D9) sign for each planet and Lagna."""
        c = session.load()
        d9 = c.get("d9_signs") or {}
        return _json(
            {
                "navamsa_sign": {
                    p: RASI_NAMES[idx] for p, idx in d9.items()
                }
            }
        )

    def get_drekkana_d3_positions() -> str:
        """Drekkana (D3) sign for each planet and Lagna (siblings, courage, nature)."""
        c = session.load()
        d3 = c.get("d3_signs") or {}
        return _json(
            {
                "drekkana_sign": {
                    p: RASI_NAMES[idx] for p, idx in d3.items()
                }
            }
        )

    def get_dasamsa_d10_positions() -> str:
        """Dasamsa (D10) sign for each planet and Lagna (career, status, karma)."""
        c = session.load()
        d10 = c.get("d10_signs") or {}
        return _json(
            {
                "dasamsa_sign": {
                    p: RASI_NAMES[idx] for p, idx in d10.items()
                }
            }
        )

    def get_hora_d2_positions() -> str:
        """Hora (D2) sign for each planet and Lagna (wealth, family)."""
        c = session.load()
        d2 = c.get("d2_signs") or {}
        return _json(
            {
                "hora_sign": {
                    p: RASI_NAMES[idx] for p, idx in d2.items()
                }
            }
        )

    def get_saptamsa_d7_positions() -> str:
        """Saptamsa (D7) sign for each planet and Lagna (children, progeny)."""
        c = session.load()
        d7 = c.get("d7_signs") or {}
        return _json(
            {
                "saptamsa_sign": {
                    p: RASI_NAMES[idx] for p, idx in d7.items()
                }
            }
        )

    def get_dwadasamsa_d12_positions() -> str:
        """Dwadasamsa (D12) sign for each planet and Lagna (parents, ancestors)."""
        c = session.load()
        d12 = c.get("d12_signs") or {}
        return _json(
            {
                "dwadasamsa_sign": {
                    p: RASI_NAMES[idx] for p, idx in d12.items()
                }
            }
        )

    def get_trimsamsa_d30_positions() -> str:
        """Trimsamsa (D30) sign for each planet and Lagna (misfortunes, health, evils)."""
        c = session.load()
        d30 = c.get("d30_signs") or {}
        return _json(
            {
                "trimsamsa_sign": {
                    p: RASI_NAMES[idx] for p, idx in d30.items()
                }
            }
        )

    def get_chaturthamsa_d4_positions() -> str:
        """Chaturthamsa (D4) for property, vehicles, fortune, happiness."""
        c = session.load()
        d4 = c.get("d4_signs") or {}
        return _json({"chaturthamsa_sign": {p: RASI_NAMES[idx] for p, idx in d4.items()}})

    def get_shodashamsa_d16_positions() -> str:
        """Shodashamsa (D16) for vehicles, comforts, luxuries."""
        c = session.load()
        d16 = c.get("d16_signs") or {}
        return _json({"shodashamsa_sign": {p: RASI_NAMES[idx] for p, idx in d16.items()}})

    def get_vimsamsa_d20_positions() -> str:
        """Vimsamsa (D20) for spiritual pursuits, devotion, penance."""
        c = session.load()
        d20 = c.get("d20_signs") or {}
        return _json({"vimsamsa_sign": {p: RASI_NAMES[idx] for p, idx in d20.items()}})

    def get_chaturvimshamsa_d24_positions() -> str:
        """Chaturvimshamsa (D24) for education, learning, knowledge."""
        c = session.load()
        d24 = c.get("d24_signs") or {}
        return _json({"chaturvimshamsa_sign": {p: RASI_NAMES[idx] for p, idx in d24.items()}})

    def get_nakshatramsa_d27_positions() -> str:
        """Nakshatramsa (D27) for strength/weakness."""
        c = session.load()
        d27 = c.get("d27_signs") or {}
        return _json({"nakshatramsa_sign": {p: RASI_NAMES[idx] for p, idx in d27.items()}})

    def get_khavedamsa_d40_positions() -> str:
        """Khavedamsa (D40) for maternal legacy."""
        c = session.load()
        d40 = c.get("d40_signs") or {}
        return _json({"khavedamsa_sign": {p: RASI_NAMES[idx] for p, idx in d40.items()}})

    def get_akshavedamsa_d45_positions() -> str:
        """Akshavedamsa (D45) for paternal legacy."""
        c = session.load()
        d45 = c.get("d45_signs") or {}
        return _json({"akshavedamsa_sign": {p: RASI_NAMES[idx] for p, idx in d45.items()}})

    def get_shashtiamsa_d60_positions() -> str:
        """Shashtiamsa (D60) for past life karma."""
        c = session.load()
        d60 = c.get("d60_signs") or {}
        return _json({"shashtiamsa_sign": {p: RASI_NAMES[idx] for p, idx in d60.items()}})

    def get_chara_karakas() -> str:
        """Jaimini Chara Karaka assignments (AK, AmK, BK, MK, PK, GK, DK) from degree ordering."""
        c = session.load()
        return _json({"chara_karakas": c.get("chara_karakas") or {}})

    def get_nakshatra_occupants() -> str:
        """27 nakshatras with pada and which planets occupy each (natal wheel table data)."""
        c = session.load()
        rows = c.get("rows") or []
        compact = []
        for row in rows[:27]:
            compact.append(
                {
                    "nakshatra": row.get("nakshatra"),
                    "bhava": row.get("bhava_no"),
                    "bhava_type": row.get("bhava_type"),
                    "occupants": row.get("native_planet"),
                    "nakshatra_ruler": row.get("nak_ruler"),
                }
            )
        return _json({"nakshatras": compact})

    specs = [
        (get_birth_chart_basics, "get_birth_chart_basics"),
        (get_natal_planetary_positions, "get_natal_planetary_positions"),
        (get_vimshottari_dasha_periods, "get_vimshottari_dasha_periods"),
        (get_gochara_transit_alerts, "get_gochara_transit_alerts"),
        (get_current_transiting_positions, "get_current_transiting_positions"),
        (get_transiting_positions_at, "get_transiting_positions_at"),
        (get_detected_yogas, "get_detected_yogas"),
        (get_ashtakavarga_scores, "get_ashtakavarga_scores"),
        (get_shadbala, "get_shadbala"),
        (get_chara_dasha_periods, "get_chara_dasha_periods"),
        (get_dasha_period_transit_forecast, "get_dasha_period_transit_forecast"),
        (get_navamsa_d9_positions, "get_navamsa_d9_positions"),
        (get_drekkana_d3_positions, "get_drekkana_d3_positions"),
        (get_dasamsa_d10_positions, "get_dasamsa_d10_positions"),
        (get_hora_d2_positions, "get_hora_d2_positions"),
        (get_saptamsa_d7_positions, "get_saptamsa_d7_positions"),
        (get_dwadasamsa_d12_positions, "get_dwadasamsa_d12_positions"),
        (get_trimsamsa_d30_positions, "get_trimsamsa_d30_positions"),
        (get_chaturthamsa_d4_positions, "get_chaturthamsa_d4_positions"),
        (get_shodashamsa_d16_positions, "get_shodashamsa_d16_positions"),
        (get_vimsamsa_d20_positions, "get_vimsamsa_d20_positions"),
        (get_chaturvimshamsa_d24_positions, "get_chaturvimshamsa_d24_positions"),
        (get_nakshatramsa_d27_positions, "get_nakshatramsa_d27_positions"),
        (get_khavedamsa_d40_positions, "get_khavedamsa_d40_positions"),
        (get_akshavedamsa_d45_positions, "get_akshavedamsa_d45_positions"),
        (get_shashtiamsa_d60_positions, "get_shashtiamsa_d60_positions"),
        (get_chara_karakas, "get_chara_karakas"),
        (get_nakshatra_occupants, "get_nakshatra_occupants"),
    ]
    tools: list[BaseTool] = []
    for fn, name in specs:
        tools.append(
            StructuredTool.from_function(
                func=fn,
                name=name,
                description=(fn.__doc__ or "").strip(),
            )
        )
    return tools
