"""
Vedic Astrology Calculator — Lahiri Ayanamsa (Chitrapaksha)
Calculates sidereal planetary positions and builds the 27-Nakshatra table.
"""
import swisseph as swe
from datetime import datetime, timedelta
from timezonefinder import TimezoneFinder
import pytz

from agent.geocode import geocode_place  # noqa: F401 — re-exported for callers

NAKSHATRA_SPAN = 360.0 / 27.0  # 13°20′00″

NAKSHATRA_DATA = [
    # (1-based index, name, nakshatra_ruler)
    (1,  "Ashwini",           "Ketu"),
    (2,  "Bharani",           "Venus"),
    (3,  "Krittika",          "Sun"),
    (4,  "Rohini",            "Moon"),
    (5,  "Mrigashira",        "Mars"),
    (6,  "Ardra",             "Rahu"),
    (7,  "Punarvasu",         "Jupiter"),
    (8,  "Pushya",            "Saturn"),
    (9,  "Ashlesha",          "Mercury"),
    (10, "Magha",             "Ketu"),
    (11, "Purva Phalguni",    "Venus"),
    (12, "Uttara Phalguni",   "Sun"),
    (13, "Hasta",             "Moon"),
    (14, "Chitra",            "Mars"),
    (15, "Swati",             "Rahu"),
    (16, "Vishakha",          "Jupiter"),
    (17, "Anuradha",          "Saturn"),
    (18, "Jyeshtha",          "Mercury"),
    (19, "Mula",              "Ketu"),
    (20, "Purva Ashadha",     "Venus"),
    (21, "Uttara Ashadha",    "Sun"),
    (22, "Shravana",          "Moon"),
    (23, "Dhanishtha",        "Mars"),
    (24, "Shatabhisha",       "Rahu"),
    (25, "Purva Bhadrapada",  "Jupiter"),
    (26, "Uttara Bhadrapada", "Saturn"),
    (27, "Revati",            "Mercury"),
]

# Most auspicious / powerful planet in each Nakshatra
# Based on exaltation degrees, sign ownership, and traditional Jyotish texts
NAKSHATRA_BEST_PLANET = [
    "Sun",      # 1  Ashwini     — Sun exalted in Aries (10° = within span)
    "Venus",    # 2  Bharani     — Venus (lord; rules Taurus neighbour)
    "Moon",     # 3  Krittika    — Moon exalted at 3° Taurus (33° ecliptic, Krittika span)
    "Moon",     # 4  Rohini      — Moon's most powerful placement
    "Mars",     # 5  Mrigashira  — Mars (lord)
    "Rahu",     # 6  Ardra       — Rahu (lord)
    "Jupiter",  # 7  Punarvasu   — Jupiter (lord)
    "Jupiter",  # 8  Pushya      — Jupiter exalted at 5° Cancer (95° ecliptic, Pushya span)
    "Mercury",  # 9  Ashlesha    — Mercury (lord)
    "Ketu",     # 10 Magha       — Ketu (lord)
    "Venus",    # 11 Purva Phalguni  — Venus (lord)
    "Sun",      # 12 Uttara Phalguni — Sun (lord)
    "Mercury",  # 13 Hasta       — Mercury exalted at 15° Virgo + lord
    "Mars",     # 14 Chitra      — Mars (lord)
    "Saturn",   # 15 Swati       — Saturn exalted in Libra (sign lord Venus also strong)
    "Saturn",   # 16 Vishakha    — Saturn exaltation at 20° Libra borders this span
    "Saturn",   # 17 Anuradha    — Saturn (lord)
    "Mercury",  # 18 Jyeshtha    — Mercury (lord)
    "Ketu",     # 19 Mula        — Ketu (lord)
    "Venus",    # 20 Purva Ashadha  — Venus (lord)
    "Sun",      # 21 Uttara Ashadha — Sun (lord)
    "Moon",     # 22 Shravana    — Moon (lord)
    "Mars",     # 23 Dhanishtha  — Mars exalted at 28° Capricorn + lord
    "Rahu",     # 24 Shatabhisha — Rahu (lord)
    "Jupiter",  # 25 Purva Bhadrapada — Jupiter (lord)
    "Saturn",   # 26 Uttara Bhadrapada — Saturn (lord)
    "Venus",    # 27 Revati      — Venus exalted at 27° Pisces (357° ecliptic, Revati span)
]

RASI_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

RASI_RULERS = {
    "Aries": "Mars",       "Taurus": "Venus",     "Gemini": "Mercury",
    "Cancer": "Moon",      "Leo": "Sun",           "Virgo": "Mercury",
    "Libra": "Venus",      "Scorpio": "Mars",      "Sagittarius": "Jupiter",
    "Capricorn": "Saturn", "Aquarius": "Saturn",   "Pisces": "Jupiter",
}

BHAVA_NAMES = [
    "",
    "Lagna Bhava",    "Dhana Bhava",   "Sahaja Bhava",   "Sukha Bhava",
    "Putra Bhava",    "Shatru Bhava",  "Kalatra Bhava",  "Ayu Bhava",
    "Dharma Bhava",   "Karma Bhava",   "Labha Bhava",    "Vyaya Bhava",
]

PLANET_SYMBOLS = {
    "Sun": "☉", "Moon": "☽", "Mercury": "☿", "Venus": "♀",
    "Mars": "♂", "Jupiter": "♃", "Saturn": "♄",
    "Rahu": "☊", "Ketu": "☋", "Lagna": "Asc",
}

ASPECT_LABELS = {3: "3rd", 4: "4th", 5: "5th", 7: "7th", 8: "8th", 9: "9th", 10: "10th"}

# ---------------------------------------------------------------------------
# Vimshottari Dasha constants
# ---------------------------------------------------------------------------

DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS    = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
                  "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
DASHA_TOTAL    = 120  # sum of all years

# Dignity tables (sidereal sign indices 0–11, Aries=0)
EXALT_SIGN = {"Sun": 0, "Moon": 1, "Mercury": 5, "Venus": 11,
              "Mars": 9, "Jupiter": 3, "Saturn": 6}
EXALT_DEG = {"Sun": 10, "Moon": 3, "Mercury": 15, "Venus": 27,
             "Mars": 28, "Jupiter": 5, "Saturn": 20}
DEBIL_SIGN = {"Sun": 6, "Moon": 7, "Mercury": 11, "Venus": 5,
              "Mars": 3, "Jupiter": 9,  "Saturn": 0}
OWN_SIGNS  = {"Sun": [4], "Moon": [3], "Mercury": [2, 5], "Venus": [1, 6],
              "Mars": [0, 7], "Jupiter": [8, 11], "Saturn": [9, 10],
              "Rahu": [10],   "Ketu": [7]}

# Traditional combustion orbs (degrees from Sun)
COMBUST_ORBS = {"Moon": 12, "Mars": 17, "Mercury": 14,
                "Jupiter": 11, "Venus": 10, "Saturn": 15}

# Navamsa starting sign for each element group (sign % 4)
NAVAMSA_START = {0: 0, 1: 9, 2: 6, 3: 3}  # Fire→Aries, Earth→Cap, Air→Libra, Water→Cancer

# ---------------------------------------------------------------------------
# Ashtakavarga benefic position tables (BPHS standard)
# Key: planet → source → [house numbers 1-based from source that give a benefic point]
# ---------------------------------------------------------------------------
ASHTAKAVARGA_TABLE: dict[str, dict[str, list[int]]] = {
    "Sun": {
        "Sun":     [1,2,4,7,8,9,10,11],
        "Moon":    [3,6,10,11],
        "Mercury": [5,6,9,11,12],
        "Venus":   [6,7,12],
        "Mars":    [1,2,4,7,8,9,10,11],
        "Jupiter": [5,6,9,11],
        "Saturn":  [1,2,4,7,8,9,10,11],
        "Lagna":   [1,2,4,7,8,9,10,11],
    },
    "Moon": {
        "Sun":     [3,6,7,8,10,11],
        "Moon":    [1,3,6,7,10,11],
        "Mercury": [2,3,5,6,9,10,11],
        "Venus":   [3,4,5,7,9,10,11],
        "Mars":    [2,3,5,6,9,10,11],
        "Jupiter": [1,4,7,8,10,11],
        "Saturn":  [3,5,6,11],
        "Lagna":   [3,6,10,11],
    },
    "Mercury": {
        "Sun":     [5,6,9,11,12],
        "Moon":    [2,4,6,8,10,11],
        "Mercury": [1,3,5,6,9,10,11,12],
        "Venus":   [1,2,3,4,5,8,9,11],
        "Mars":    [1,2,4,7,8,9,10,11],
        "Jupiter": [6,8,11,12],
        "Saturn":  [1,2,4,7,8,9,10,11],
        "Lagna":   [1,2,4,7,8,9,10,11],
    },
    "Venus": {
        "Sun":     [8,11,12],
        "Moon":    [1,2,3,4,5,8,9,11,12],
        "Mercury": [3,4,6,9,11,12],
        "Venus":   [1,2,3,4,5,8,9,10,11],
        "Mars":    [3,5,6,9,11,12],
        "Jupiter": [5,8,9,10,11],
        "Saturn":  [3,4,5,8,9,10,11],
        "Lagna":   [1,2,3,4,5,8,9,11],
    },
    "Mars": {
        "Sun":     [3,5,6,10,11],
        "Moon":    [3,6,11],
        "Mercury": [3,5,6,10,11],
        "Venus":   [6,8,11,12],
        "Mars":    [1,2,4,7,8,10,11],
        "Jupiter": [6,10,11,12],
        "Saturn":  [1,4,7,8,9,10,11],
        "Lagna":   [1,2,4,7,8,10,11],
    },
    "Jupiter": {
        "Sun":     [1,2,3,4,7,8,9,10,11],
        "Moon":    [2,5,7,9,11],
        "Mercury": [1,2,4,5,6,9,10,11],
        "Venus":   [2,5,6,9,10,11],
        "Mars":    [1,2,4,7,8,10,11],
        "Jupiter": [1,2,3,4,7,8,10,11],
        "Saturn":  [3,5,6,12],
        "Lagna":   [1,2,4,5,6,7,9,10,11],
    },
    "Saturn": {
        "Sun":     [1,2,4,7,8,10,11],
        "Moon":    [3,6,11],
        "Mercury": [6,8,9,10,11,12],
        "Venus":   [6,11,12],
        "Mars":    [3,5,6,10,11,12],
        "Jupiter": [5,6,11,12],
        "Saturn":  [3,5,6,11],
        "Lagna":   [1,2,4,7,8,10,11],
    },
}


# ---------------------------------------------------------------------------
# Geocoding & time helpers
# ---------------------------------------------------------------------------

def get_timezone_name(lat: float, lon: float) -> str:
    tf = TimezoneFinder()
    tz = tf.timezone_at(lat=lat, lng=lon)
    return tz if tz else "UTC"


def birth_to_jd(date_str: str, time_str: str, lat: float, lon: float, tz_name: str) -> tuple[float, datetime]:
    """Return (Julian Day, birth_datetime_utc)."""
    tz = pytz.timezone(tz_name)
    dt_local = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    dt_local = tz.localize(dt_local)
    dt_utc = dt_local.astimezone(pytz.utc)
    hour_dec = dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
    jd = swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour_dec)
    return jd, dt_utc.replace(tzinfo=None)  # naive UTC for arithmetic


# ---------------------------------------------------------------------------
# Planetary positions
# ---------------------------------------------------------------------------

def get_sidereal_positions(jd: float, lat: float, lon: float, ayanamsa_mode: int | None = None) -> tuple[dict[str, float], dict[str, bool], dict[str, float], float]:
    """Return (positions, retrograde_flags, speeds, ayanamsa_value) for planets + Lagna.
    ayanamsa_mode: swisseph SIDM_* constant, or None for tropical / no ayanamsa correction (Sayana).
    """
    is_tropical = ayanamsa_mode is None
    if not is_tropical:
        swe.set_sid_mode(ayanamsa_mode)
        flags = swe.FLG_SIDEREAL | swe.FLG_SPEED
    else:
        flags = swe.FLG_SPEED  # tropical: no sidereal flag, no set_sid_mode

    # FLG_SPEED needed for retrograde and cheshta (even in tropical)

    planet_ids = {
        "Sun":     swe.SUN,
        "Moon":    swe.MOON,
        "Mercury": swe.MERCURY,
        "Venus":   swe.VENUS,
        "Mars":    swe.MARS,
        "Jupiter": swe.JUPITER,
        "Saturn":  swe.SATURN,
        "Rahu":    swe.MEAN_NODE,
    }

    positions:  dict[str, float] = {}
    retrograde: dict[str, bool]  = {}
    speeds: dict[str, float] = {}
    for name, pid in planet_ids.items():
        result, _ = swe.calc_ut(jd, pid, flags)
        positions[name]  = result[0] % 360.0
        retrograde[name] = result[3] < 0   # longitude speed < 0 → retrograde
        speeds[name] = result[3]  # daily motion in degrees

    # Ketu — always retrograde (moves with mean Rahu)
    positions["Ketu"]  = (positions["Rahu"] + 180.0) % 360.0
    retrograde["Ketu"] = True
    retrograde["Rahu"] = True   # mean node always retrograde
    speeds["Ketu"] = -speeds["Rahu"]  # opposite

    # Lagna
    _, ascmc = swe.houses(jd, lat, lon, b'P')
    if is_tropical:
        ayan_val = 0.0
        positions["Lagna"] = ascmc[0] % 360.0
    else:
        ayan_val = swe.get_ayanamsa_ut(jd)
        positions["Lagna"] = (ascmc[0] - ayan_val) % 360.0
    retrograde["Lagna"] = False
    speeds["Lagna"] = 0  # no speed for Lagna

    return positions, retrograde, speeds, ayan_val


def _resolve_ayanamsa_mode(ayanamsa: str | int | None) -> int | None:
    """Convert user string choice (or int constant or None) to swisseph mode or None (tropical)."""
    if ayanamsa is None:
        return None
    if isinstance(ayanamsa, int):
        return ayanamsa
    choice = str(ayanamsa).lower().strip()
    if choice in ("tropical", "none", "sayana", "no ayanamsa", "tropic"):
        return None
    AY = {
        "lahiri": swe.SIDM_LAHIRI,
        "raman": swe.SIDM_RAMAN,
        "krishnamurti": swe.SIDM_KRISHNAMURTI,
    }
    return AY.get(choice, swe.SIDM_LAHIRI)


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def fmt_dms(deg: float) -> str:
    """Decimal degrees → DD°MM′SS″"""
    d = int(deg)
    m_full = (deg - d) * 60
    m = int(m_full)
    s = int((m_full - m) * 60)
    return f"{d}°{m:02d}′{s:02d}″"


def fmt_dm(deg: float) -> str:
    """Decimal degrees → DD°MM′  (no seconds, for degree-span column)"""
    d = int(deg)
    m = round((deg - d) * 60)
    if m == 60:
        d += 1
        m = 0
    return f"{d}°{m:02d}′"


def get_rasi(sidereal_deg: float) -> tuple[str, float]:
    idx = int(sidereal_deg / 30.0) % 12
    return RASI_NAMES[idx], sidereal_deg % 30.0


# ---------------------------------------------------------------------------
# Vedic aspects (Graha Drishti)
# ---------------------------------------------------------------------------

def planet_aspects(planet_name: str, planet_rasi_idx: int) -> list[tuple[int, int]]:
    """
    Return [(target_rasi_idx, aspect_number), ...] for all Vedic aspects cast
    by this planet.  Lagna casts no aspects.
    """
    if planet_name == "Lagna":
        return []

    result = [(( planet_rasi_idx + 6) % 12, 7)]   # 7th — universal

    if planet_name == "Mars":
        result += [((planet_rasi_idx + 3) % 12, 4),
                   ((planet_rasi_idx + 7) % 12, 8)]
    elif planet_name == "Jupiter":
        result += [((planet_rasi_idx + 4) % 12, 5),
                   ((planet_rasi_idx + 8) % 12, 9)]
    elif planet_name == "Saturn":
        result += [((planet_rasi_idx + 2) % 12, 3),
                   ((planet_rasi_idx + 9) % 12, 10)]
    elif planet_name in ("Rahu", "Ketu"):
        result += [((planet_rasi_idx + 4) % 12, 5),
                   ((planet_rasi_idx + 8) % 12, 9)]

    return result


# ---------------------------------------------------------------------------
# Navamsa (D9) helper
# ---------------------------------------------------------------------------

def get_navamsa_sign(sidereal_deg: float) -> int:
    """Return the Navamsa (D9) sign index (0–11) for a given sidereal degree."""
    sign    = int(sidereal_deg / 30.0) % 12
    deg_in  = sidereal_deg % 30.0
    nav_num = int(deg_in * 9 / 30.0)          # 0–8 navamsa within the sign
    start   = NAVAMSA_START[sign % 4]
    return (start + nav_num) % 12


# ---------------------------------------------------------------------------
# Divisional Charts (Vargas) - additional to D9
# ---------------------------------------------------------------------------

def get_drekkana_sign(sidereal_deg: float) -> int:
    """
    Drekkana (D3) sign index (0-11).
    Uses the common Parashara mapping:
      0-10°  -> same sign
      10-20° -> sign + 4
      20-30° -> sign + 8
    """
    sign = int(sidereal_deg / 30.0) % 12
    deg_in = sidereal_deg % 30.0
    d3 = int(deg_in / 10.0)  # 0, 1 or 2
    if d3 == 0:
        return sign
    elif d3 == 1:
        return (sign + 4) % 12
    else:
        return (sign + 8) % 12


def get_dasamsa_sign(sidereal_deg: float) -> int:
    """
    Dasamsa (D10) sign index (0-11) - important for career and karma.
    Standard Parashara rule:
    - Odd signs (Aries, Gemini... 0-based even indices): start from the sign itself, count forward.
    - Even signs: start from the 9th sign from the rasi.
    """
    sign = int(sidereal_deg / 30.0) % 12
    deg_in = sidereal_deg % 30.0
    part = int(deg_in / 3.0)  # 0-9

    if sign % 2 == 0:  # Aries(0), Gemini(2), Leo(4)... = "odd" signs in traditional counting
        return (sign + part) % 12
    else:
        # Start from 9th sign (sign + 8), then forward
        return (sign + 8 + part) % 12


def get_hora_d2_sign(sidereal_deg: float) -> int:
    """
    Hora (D2) sign index (0-11) for wealth matters.
    Standard Parashara Cancer-Leo Hora:
    - Odd signs (Aries etc.): 0-15° Leo, 15-30° Cancer
    - Even signs: 0-15° Cancer, 15-30° Leo
    """
    sign = int(sidereal_deg / 30.0) % 12
    deg_in = sidereal_deg % 30.0
    if sign % 2 == 0:  # odd signs
        if deg_in < 15:
            return 4  # Leo
        else:
            return 3  # Cancer
    else:
        if deg_in < 15:
            return 3  # Cancer
        else:
            return 4  # Leo


def get_saptamsa_d7_sign(sidereal_deg: float) -> int:
    """
    Saptamsa (D7) sign index (0-11) for children/progeny.
    7 equal parts of ~4.2857°.
    - Odd signs: starts from the sign itself, sequential.
    - Even signs: starts from the 7th sign from the rasi.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 7))
    if sign % 2 == 0:  # odd signs
        return (sign + part) % 12
    else:
        return (sign + 6 + part) % 12  # 7th sign = +6


def get_dwadasamsa_d12_sign(sidereal_deg: float) -> int:
    """
    Dwadasamsa (D12) sign index (0-11) for parents/ancestors.
    12 equal parts of 2.5° each. Starts from the sign, sequential.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / 2.5)
    return (sign + part) % 12


def get_trimsamsa_d30_sign(sidereal_deg: float) -> int:
    """
    Trimsamsa (D30) sign index (0-11) for misfortunes, health, etc.
    Special unequal parts (5 per sign), lords Mars, Saturn, Jupiter, Mercury, Venus only.
    D30 rasi = the rasi associated with the ruling planet of the portion.
    Uses standard Parashara mapping (odd signs vs even signs).
    """
    sign = int(sidereal_deg / 30.0) % 12
    d = sidereal_deg % 30.0
    if sign % 2 == 0:  # odd signs (Aries=0, Gemini=2, ...)
        if d < 5:
            return 0  # Mars -> Aries
        elif d < 10:
            return 9  # Saturn -> Capricorn
        elif d < 18:
            return 8  # Jupiter -> Sagittarius
        elif d < 25:
            return 2  # Mercury -> Gemini
        else:
            return 5  # Venus -> Libra
    else:  # even signs
        if d < 5:
            return 1  # Venus -> Taurus
        elif d < 12:
            return 2  # Mercury -> Gemini
        elif d < 20:
            return 8  # Jupiter -> Sagittarius
        elif d < 25:
            return 9  # Saturn -> Capricorn
        else:
            return 0  # Mars -> Aries


def get_chaturthamsa_d4_sign(sidereal_deg: float) -> int:
    """
    Chaturthamsa (D4) sign index (0-11) for property, vehicles, happiness, fortune.
    4 parts of 7.5°. Parashara: movable signs cycle every 3 signs, fixed/dual adjusted.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / 7.5)
    if sign in [0, 3, 6, 9]:  # movable (Aries, Cancer, Libra, Capricorn)
        return (sign + part * 3) % 12
    elif sign in [1, 4, 7, 10]:  # fixed
        return (sign + part * 3 + 9) % 12  # common offset
    else:  # dual
        return (sign + part * 3 + 6) % 12


def get_shodashamsa_d16_sign(sidereal_deg: float) -> int:
    """
    Shodashamsa (D16) sign index for vehicles, comforts, luxuries.
    16 parts of 1.875°. Standard Parashara: odd signs start from sign, even from 4th or specific.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 16))
    if sign % 2 == 0:  # odd signs
        return (sign + part) % 12
    else:
        return (sign + part + 8) % 12  # adjusted for even


def get_vimsamsa_d20_sign(sidereal_deg: float) -> int:
    """
    Vimsamsa (D20) for spiritual pursuits, penance, devotion.
    20 parts of 1.5°. Odd signs from sign, even from 4th? Common: sequential with offset.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / 1.5)
    if sign % 2 == 0:
        return (sign + part) % 12
    else:
        return (sign + part + 4) % 12


def get_chaturvimshamsa_d24_sign(sidereal_deg: float) -> int:
    """
    Chaturvimshamsa (D24) for education, learning, knowledge.
    24 parts of 1.25°. Often used for siddhamsa variant too.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 24))
    if sign % 2 == 0:
        return (sign + part) % 12
    else:
        return (sign + part + 12) % 12  # or other common


def get_nakshatramsa_d27_sign(sidereal_deg: float) -> int:
    """
    Nakshatramsa / Saptavimsamsa (D27) for inherent strength/weakness.
    27 parts of ~1.111°. Lords are the 27 nakshatra deities (BPHS).
    Simplified sequential mapping for structure (full deity mapping can be added).
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 27))
    # Basic: distribute across signs
    return (sign + (part // 2)) % 12


def get_khavedamsa_d40_sign(sidereal_deg: float) -> int:
    """
    Khavedamsa (D40) for maternal legacy, auspicious/inauspicious.
    40 parts. Odd signs count from Aries, even from Libra (per Parashara).
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 40))
    if sign % 2 == 0:  # odd signs
        return (0 + part) % 12  # from Aries
    else:
        return (6 + part) % 12  # from Libra (index 6)


def get_akshavedamsa_d45_sign(sidereal_deg: float) -> int:
    """
    Akshavedamsa (D45) for paternal legacy, all matters.
    45 parts. Similar odd/even starting.
    """
    sign = int(sidereal_deg / 30.0) % 12
    part = int((sidereal_deg % 30.0) / (30.0 / 45))
    if sign % 2 == 0:  # odd
        return (0 + part) % 12
    else:
        return (4 + part) % 12  # example starting


def get_shashtiamsa_d60_sign(sidereal_deg: float) -> int:
    """
    Shashtiamsa (D60) for past life karma.
    60 parts of 0.5°. Ignore sign position, use deg*2 /12 remainder +1 (BPHS).
    """
    sign = int(sidereal_deg / 30.0) % 12
    d = sidereal_deg % 30.0
    # figure = degrees in sign, *2 , mod 12
    val = int(d * 2)
    rem = val % 12
    # the sign indicated by remainder (adjust +1 -1 per sloka)
    return (rem ) % 12


# ---------------------------------------------------------------------------
# Ashtakavarga
# ---------------------------------------------------------------------------

def calculate_ashtakavarga(positions: dict[str, float], lagna_rasi_idx: int) -> tuple[dict, list[int]]:
    """
    Compute Bhinnashtakavarga (per planet) and Sarvashtakavarga (total per sign).
    Returns (bav_dict, sarva_list):
      bav_dict  → {planet: [score0..score11]}
      sarva_list→ [total_score0..total_score11]  (sum across 7 planets)
    """
    sources = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Lagna"]

    source_signs: dict[str, int] = {}
    for s in sources:
        if s == "Lagna":
            source_signs["Lagna"] = lagna_rasi_idx
        elif s in positions:
            source_signs[s] = int(positions[s] / 30.0) % 12

    bav: dict[str, list[int]] = {}
    sarva = [0] * 12

    for planet, source_table in ASHTAKAVARGA_TABLE.items():
        scores = [0] * 12
        for source, benefic_houses in source_table.items():
            if source not in source_signs:
                continue
            src_sign = source_signs[source]
            for h in benefic_houses:
                target = (src_sign + h - 1) % 12
                scores[target] += 1
        bav[planet] = scores
        for i in range(12):
            sarva[i] += scores[i]

    return bav, sarva


# ---------------------------------------------------------------------------
# Yoga detection
# ---------------------------------------------------------------------------

def detect_yogas(positions: dict[str, float], dignity: dict[str, str | None],
                 lagna_rasi_idx: int) -> list[dict]:
    """
    Detect common Vedic yogas. Returns a list of dicts with keys:
      name, planets, description, type ('benefic' | 'challenging')
    """
    signs = {p: int(deg / 30.0) % 12 for p, deg in positions.items()}

    kendra_signs  = {(lagna_rasi_idx + k) % 12 for k in [0, 3, 6, 9]}
    trikona_signs = {(lagna_rasi_idx + k) % 12 for k in [0, 4, 8]}
    dusthana_houses = {6, 8, 12}

    def house_of(sign: int) -> int:
        return ((sign - lagna_rasi_idx) % 12) + 1

    yogas: list[dict] = []

    # ── 1. GAJAKESHARI ───────────────────────────────────────────────────────
    if "Jupiter" in signs and "Moon" in signs:
        jfm = ((signs["Jupiter"] - signs["Moon"]) % 12) + 1
        if jfm in (1, 4, 7, 10):
            yogas.append({"name": "Gajakeshari Yoga", "planets": ["Jupiter", "Moon"],
                "description": "Jupiter in a kendra from Moon. Bestows fame, prosperity, noble character, and keen intelligence throughout life.",
                "type": "benefic"})

    # ── 2. BUDHA-ADITYA ──────────────────────────────────────────────────────
    if "Sun" in signs and "Mercury" in signs and signs["Sun"] == signs["Mercury"]:
        yogas.append({"name": "Budha-Aditya Yoga", "planets": ["Sun", "Mercury"],
            "description": "Sun and Mercury conjunct in the same sign. Grants sharp intellect, eloquence, success through communication, and recognition in learned fields.",
            "type": "benefic"})

    # ── 3. PANCHA MAHAPURUSHA (Hamsa / Malavya / Ruchaka / Sasa / Bhadra) ───
    pmp = [
        ("Jupiter", "Hamsa",   "wisdom, spiritual depth, dharmic living, and benevolence"),
        ("Venus",   "Malavya", "beauty, artistic talent, luxury, and sensual refinements"),
        ("Mars",    "Ruchaka", "courage, physical vitality, military success, and leadership"),
        ("Saturn",  "Sasa",    "discipline, mass authority, administrative power, and longevity"),
        ("Mercury", "Bhadra",  "intellect, communication mastery, business acumen, and learned fame"),
    ]
    for planet, yoga_name, desc in pmp:
        if planet in signs and signs[planet] in kendra_signs and dignity.get(planet) in ("exalted", "own"):
            yogas.append({"name": f"{yoga_name} Yoga (Pancha Mahapurusha)", "planets": [planet],
                "description": f"{planet} in own/exalted sign in a kendra. Bestows {desc}.",
                "type": "benefic"})

    # ── 4. KEMADRUMA ─────────────────────────────────────────────────────────
    if "Moon" in signs:
        ms = signs["Moon"]
        others = [p for p in signs if p not in ("Moon", "Sun", "Rahu", "Ketu", "Lagna")]
        adjacent = {(ms - 1) % 12, (ms + 1) % 12}
        if not any(signs[p] in adjacent for p in others):
            yogas.append({"name": "Kemadruma Yoga", "planets": ["Moon"],
                "description": "No planets in 2nd or 12th from Moon. Can indicate emotional isolation or hardship; mitigated when Jupiter/Moon are in a kendra or aspected by benefics.",
                "type": "challenging"})

    # ── 5. SUNAPHA / ANAPHA / DURUDHURA ──────────────────────────────────────
    if "Moon" in signs:
        ms = signs["Moon"]
        graha = [p for p in signs if p not in ("Sun", "Moon", "Rahu", "Ketu", "Lagna")]
        before = any(signs[p] == (ms - 1) % 12 for p in graha)
        after  = any(signs[p] == (ms + 1) % 12 for p in graha)
        if before and after:
            yogas.append({"name": "Durudhura Yoga", "planets": ["Moon"],
                "description": "Planets in both 2nd and 12th from Moon. Wealth, pleasures, and a life full of supporters and comfort.",
                "type": "benefic"})
        elif after:
            yogas.append({"name": "Sunapha Yoga", "planets": ["Moon"],
                "description": "Planet(s) in 2nd from Moon. Self-made wealth, good social status, and intellectual recognition.",
                "type": "benefic"})
        elif before:
            yogas.append({"name": "Anapha Yoga", "planets": ["Moon"],
                "description": "Planet(s) in 12th from Moon. Noble, generous character; fame through charitable or spiritual deeds.",
                "type": "benefic"})

    # ── 6. NEECHA BHANGA RAJA YOGA ───────────────────────────────────────────
    for p, dig in dignity.items():
        if dig != "debilitated" or p not in signs:
            continue
        deb_sign   = signs[p]
        sign_lord  = RASI_RULERS[RASI_NAMES[deb_sign]]
        exalt_sign = EXALT_SIGN.get(p)
        exalt_lord = RASI_RULERS[RASI_NAMES[exalt_sign]] if exalt_sign is not None else None
        dispositor_in_kendra = (
            (sign_lord  in signs and signs[sign_lord]  in kendra_signs) or
            (exalt_lord and exalt_lord in signs and signs[exalt_lord] in kendra_signs)
        )
        if dispositor_in_kendra:
            yogas.append({"name": f"Neecha Bhanga Raja Yoga ({p})", "planets": [p],
                "description": f"{p} is debilitated but its dispositor holds a kendra, cancelling the debilitation. Hardships become powerful catalysts for an extraordinary rise.",
                "type": "benefic"})

    # ── 7. VIPAREETA RAJA YOGA ───────────────────────────────────────────────
    for h in (6, 8, 12):
        lord_sign = (lagna_rasi_idx + h - 1) % 12
        lord      = RASI_RULERS[RASI_NAMES[lord_sign]]
        if lord not in signs:
            continue
        lord_h = house_of(signs[lord])
        if lord_h in dusthana_houses and lord_h != h:
            yogas.append({"name": f"Vipareeta Raja Yoga (Lord of {h}th)", "planets": [lord],
                "description": f"Lord of the {h}th house sits in another dusthana house. Adversity paradoxically confers power; competitors and opponents inadvertently elevate the native.",
                "type": "benefic"})

    # ── 8. RAJ YOGA (Dharma-Karma Adhipati) ──────────────────────────────────
    kendra_lords  = {RASI_RULERS[RASI_NAMES[(lagna_rasi_idx + k) % 12]] for k in [3, 6, 9]}
    trikona_lords = {RASI_RULERS[RASI_NAMES[(lagna_rasi_idx + k) % 12]] for k in [4, 8]}
    for kl in kendra_lords:
        for tl in trikona_lords:
            if kl == tl or kl not in signs or tl not in signs:
                continue
            if signs[kl] == signs[tl]:   # conjunction
                yogas.append({"name": f"Raj Yoga ({kl}+{tl})", "planets": [kl, tl],
                    "description": f"Lords of a kendra ({kl}) and a trikona ({tl}) are conjunct — a classical Dharma-Karma Adhipati Raj Yoga indicating authority, career elevation, and public success.",
                    "type": "benefic"})

    # ── 9. ADHI YOGA ─────────────────────────────────────────────────────────
    # Jupiter, Mercury, Venus all in 6th, 7th, or 8th from Moon
    if "Moon" in signs:
        ms = signs["Moon"]
        adhi_houses = {(ms + k) % 12 for k in [5, 6, 7]}
        adhi_planets = [p for p in ("Jupiter", "Mercury", "Venus") if p in signs and signs[p] in adhi_houses]
        if len(adhi_planets) >= 2:
            yogas.append({"name": "Adhi Yoga", "planets": adhi_planets,
                "description": "Jupiter, Mercury, and/or Venus in 6th/7th/8th from Moon. Bestows leadership qualities, authority, wealth, and a long, prosperous life. More planets strengthen the yoga.",
                "type": "benefic"})

    # ── 10. PARIVARTANA (sign exchange) ──────────────────────────────────────
    planet_list = [p for p in signs if p not in ("Lagna", "Rahu", "Ketu")]
    for i in range(len(planet_list)):
        for j in range(i + 1, len(planet_list)):
            pa, pb = planet_list[i], planet_list[j]
            if pa not in signs or pb not in signs:
                continue
            # pa in sign ruled by pb, AND pb in sign ruled by pa
            if (RASI_RULERS[RASI_NAMES[signs[pa]]] == pb and
                    RASI_RULERS[RASI_NAMES[signs[pb]]] == pa):
                ha, hb = house_of(signs[pa]), house_of(signs[pb])
                yogas.append({"name": f"Parivartana Yoga ({pa}↔{pb})", "planets": [pa, pb],
                    "description": f"{pa} (in {RASI_NAMES[signs[pa]]}) and {pb} (in {RASI_NAMES[signs[pb]]}) exchange signs. The themes of houses {ha} and {hb} become strongly interlinked; both planets gain mutual strength.",
                    "type": "benefic"})

    # ── 11. CHANDRA MANGALA YOGA ─────────────────────────────────────────────
    if "Moon" in signs and "Mars" in signs and signs.get("Moon") == signs.get("Mars"):
        yogas.append({
            "name": "Chandra Mangala Yoga",
            "planets": ["Moon", "Mars"],
            "description": "Moon conjunct Mars. Emotional drive, courage, wealth through property or maternal lines, technical skill. Can indicate strong but sometimes volatile temperament.",
            "type": "benefic"
        })

    # ── 12. AMALA YOGA ───────────────────────────────────────────────────────
    if "Moon" in signs:
        tenth_from_moon = (signs["Moon"] + 9) % 12
        benefics = [p for p in ("Jupiter", "Venus", "Mercury") if p in signs and signs[p] == tenth_from_moon]
        if benefics:
            yogas.append({
                "name": "Amala Yoga",
                "planets": ["Moon"] + benefics,
                "description": "Benefic(s) in the 10th from Moon. Spotless reputation, ethical success, lasting fame and respect in society.",
                "type": "benefic"
            })

    # ── 13. SARASWATI YOGA (simplified) ──────────────────────────────────────
    knowledge_planets = [p for p in ("Jupiter", "Venus", "Mercury") if p in signs]
    if len(knowledge_planets) >= 2:
        strong = []
        for p in knowledge_planets:
            h = house_of(signs[p])
            if h in (1, 4, 5, 7, 9, 10):
                strong.append(p)
        if len(strong) >= 2:
            yogas.append({
                "name": "Saraswati Yoga",
                "planets": strong,
                "description": "Jupiter, Venus and/or Mercury strong in kendra or trikona. Bestows learning, arts, music, eloquence, and wisdom.",
                "type": "benefic"
            })

    return yogas


# ---------------------------------------------------------------------------
# Dignity helpers
# ---------------------------------------------------------------------------

def get_dignity(planet: str, sidereal_deg: float) -> str | None:
    """Return 'exalted', 'debilitated', 'own', or None."""
    sign = int(sidereal_deg / 30.0) % 12
    if planet in EXALT_SIGN and sign == EXALT_SIGN[planet]:
        return "exalted"
    if planet in DEBIL_SIGN and sign == DEBIL_SIGN[planet]:
        return "debilitated"
    if planet in OWN_SIGNS and sign in OWN_SIGNS[planet]:
        return "own"
    return None


def is_combust(planet: str, planet_deg: float, sun_deg: float) -> bool:
    """Return True if planet is within combustion orb of the Sun."""
    if planet in ("Sun", "Rahu", "Ketu", "Lagna"):
        return False
    orb = COMBUST_ORBS.get(planet, 10)
    diff = abs(planet_deg - sun_deg)
    if diff > 180:
        diff = 360 - diff
    return diff <= orb


def get_chara_karakas(positions: dict[str, float]) -> dict[str, str]:
    """
    Jaimini Chara Karakas ranked by degree-within-sign (descending).
    Uses 7 classical planets (excludes Rahu, Ketu, Lagna).
    Returns {planet: karaka_code} e.g. {'Sun': 'AK', 'Mars': 'AmK', ...}
    """
    candidates = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]
    karaka_names = ["AK", "AmK", "BK", "MK", "PiK", "GK", "DK"]
    ranked = sorted(
        [p for p in candidates if p in positions],
        key=lambda p: positions[p] % 30.0,
        reverse=True,
    )
    return {p: karaka_names[i] for i, p in enumerate(ranked)}


# ---------------------------------------------------------------------------
# Vimshottari Dasha
# ---------------------------------------------------------------------------

def get_vimshottari_dasha(moon_deg: float, birth_dt: datetime) -> dict:
    """
    Calculate Vimshottari Dasha periods from Moon's sidereal longitude and birth UTC datetime.
    Returns a structured dict with the current Mahadasha / Antardasha / Pratyantardasha
    and a display timeline.
    """
    nak_span   = 360.0 / 27.0
    nak_idx    = int(moon_deg / nak_span) % 27
    nak_ruler  = DASHA_SEQUENCE[nak_idx % 9]

    # Fraction of the nakshatra already elapsed at birth
    fraction_elapsed = (moon_deg - nak_idx * nak_span) / nak_span
    balance_years    = DASHA_YEARS[nak_ruler] * (1.0 - fraction_elapsed)

    # ── Build mahadasha timeline from birth ────────────────────────────
    now       = datetime.utcnow()
    timeline  = []
    cursor    = birth_dt
    start_idx = DASHA_SEQUENCE.index(nak_ruler)

    # First (partial) dasha
    end_ = cursor + timedelta(days=balance_years * 365.25)
    timeline.append({"planet": nak_ruler, "start": cursor, "end": end_,
                     "years": round(balance_years, 2)})
    cursor = end_
    idx = (start_idx + 1) % 9
    for _ in range(25):
        p   = DASHA_SEQUENCE[idx]
        end_ = cursor + timedelta(days=DASHA_YEARS[p] * 365.25)
        timeline.append({"planet": p, "start": cursor, "end": end_,
                         "years": DASHA_YEARS[p]})
        cursor = end_
        if cursor.year > birth_dt.year + 130:
            break
        idx = (idx + 1) % 9

    # ── Locate current period and build a sensible display window ────────
    # (past context + current + several upcoming; never start from birth only)
    result: dict = {
        "natal_dasha_lord":          nak_ruler,
        "natal_balance_years":       round(balance_years, 2),
        "current":                   None,
        "timeline":                  [],
    }

    # Find index of current (or first future) period in the full birth-to-future timeline
    current_idx = None
    for i, p in enumerate(timeline):
        if p["start"] <= now <= p["end"]:
            current_idx = i
            break
    if current_idx is None:
        for i, p in enumerate(timeline):
            if p["start"] > now:
                current_idx = i
                break
    if current_idx is None:
        current_idx = 0

    # Window: up to 2 past (for context) + current + next ~8 upcoming  => ~10-11 total
    start_i = max(0, current_idx - 2)
    end_i = min(len(timeline), current_idx + 9)
    display_periods = timeline[start_i:end_i]

    for period in display_periods:
        in_maha = period["start"] <= now <= period["end"]
        result["timeline"].append({
            "planet":     period["planet"],
            "start":      period["start"].strftime("%b %Y"),
            "end":        period["end"].strftime("%b %Y"),
            "years":      round(period["years"], 1) if isinstance(period.get("years"), (int, float)) else period["years"],
            "is_current": in_maha,
        })

    # Now find the actual current period (for the detailed current + pratyantar)
    for period in timeline:
        if not (period["start"] <= now <= period["end"]):
            continue

        # Antardasha for current (to compute current antar + prat)
        maha_years = DASHA_YEARS[period["planet"]]
        mi = DASHA_SEQUENCE.index(period["planet"])
        antar_cursor = period["start"]
        antardashas = []
        for j in range(9):
            ap = DASHA_SEQUENCE[(mi + j) % 9]
            ay = maha_years * DASHA_YEARS[ap] / DASHA_TOTAL
            antar_e = antar_cursor + timedelta(days=ay * 365.25)
            antardashas.append({"planet": ap, "start": antar_cursor, "end": antar_e})
            antar_cursor = antar_e

        for antar in antardashas:
            if not (antar["start"] <= now <= antar["end"]):
                continue

            # Pratyantardasha
            antar_days = (antar["end"] - antar["start"]).total_seconds() / 86400
            ai = DASHA_SEQUENCE.index(antar["planet"])
            prat_cursor = antar["start"]
            current_prat = None
            for k in range(9):
                pp = DASHA_SEQUENCE[(ai + k) % 9]
                py = (antar_days / 365.25) * DASHA_YEARS[pp] / DASHA_TOTAL
                prat_e = prat_cursor + timedelta(days=py * 365.25)
                if prat_cursor <= now <= prat_e:
                    current_prat = {"planet": pp, "end": prat_e}
                prat_cursor = prat_e

            result["current"] = {
                "mahadasha":            period["planet"],
                "mahadasha_end":        period["end"].strftime("%b %Y"),
                "mahadasha_remaining":  _years_remaining(now, period["end"]),
                "antardasha":           antar["planet"],
                "antardasha_end":       antar["end"].strftime("%b %Y"),
                "antardasha_remaining": _years_remaining(now, antar["end"]),
                "pratyantardasha":      current_prat["planet"] if current_prat else "—",
                "pratyantardasha_end":  current_prat["end"].strftime("%d %b %Y") if current_prat else "—",
            }
            break
        break

    # Store raw datetime objects for dasha transit forecast (full long-term list)
    result["_timeline_raw"] = [
        {"planet": p["planet"], "start": p["start"], "end": p["end"]}
        for p in timeline
    ]

    # ── Antardasha breakdown: attach only to current + next 3 mahadashas ───
    def _antardasha_list(maha_planet: str, maha_start: datetime, maha_end: datetime) -> list:
        maha_years = DASHA_YEARS[maha_planet]
        mi = DASHA_SEQUENCE.index(maha_planet)
        cursor = maha_start
        rows = []
        for j in range(9):
            ap = DASHA_SEQUENCE[(mi + j) % 9]
            ay = maha_years * DASHA_YEARS[ap] / DASHA_TOTAL
            ae = cursor + timedelta(days=ay * 365.25)
            is_cur = cursor <= now <= ae
            rows.append({
                "planet":     ap,
                "start":      cursor.strftime("%b %Y"),
                "end":        ae.strftime("%b %Y"),
                "is_current": is_cur,
            })
            cursor = ae
        return rows

    # Only compute detailed antars for current + upcoming (the ones user cares about)
    detail_count = 0
    for entry in result["timeline"]:
        if detail_count >= 4:
            break
        for period in timeline:
            if (period["planet"] == entry["planet"] and
                    period["start"].strftime("%b %Y") == entry["start"]):
                # Include for current or any future mahadasha
                if period["end"] >= now:
                    entry["antardashas"] = _antardasha_list(
                        period["planet"], period["start"], period["end"]
                    )
                    detail_count += 1
                break
        if detail_count >= 4:
            break

    return result


def calculate_shadbala(positions: dict[str, float], lagna_rasi_idx: int,
                       speeds: dict[str, float] | None = None,
                       vargas: dict[str, dict[str, int]] | None = None) -> dict[str, dict]:
    """
    Compute Shadbala (6-fold strength) for the 7 planets (Sun-Saturn).
    Returns per-planet dict with sub-balas in Virupas and totals in Rupas.
    Improved Parashara-style implementation using available data (vargas for Saptavargaja, speeds for Cheshta).
    Note: Full Kalabala requires precise birth time + sunrise; here approximated.
    """
    planets = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
    result = {}

    # Standard Naisargika Bala (natural strength in virupas)
    NAISARGIKA = {"Sun": 60, "Moon": 51, "Mars": 17, "Mercury": 12, "Jupiter": 30, "Venus": 16, "Saturn": 1}

    for planet in planets:
        if planet not in positions:
            continue
        deg = positions[planet]
        sign = int(deg / 30) % 12

        # 1. Sthana Bala (positional strength) - up to ~480? but typically contributes to total
        sthana = 0.0

        # Uchcha Bala: distance from exaltation point (max 60 virupas)
        if planet in EXALT_DEG:
            exalt_deg = EXALT_SIGN[planet] * 30 + EXALT_DEG[planet]
            diff = abs((exalt_deg - deg + 360) % 360)
            if diff > 180:
                diff = 360 - diff
            uchcha = 60 * (1 - diff / 180)  # linear from 60 at exact to 0 at 180 away
            sthana += uchcha

        # Saptavargaja Bala (strength in 7 vargas: D1,D2,D3,D7,D9,D12,D30) - max ~45-60 total
        saptavarga = 0.0
        if vargas:
            varga_list = ["d1", "d2", "d3", "d7", "d9", "d12", "d30"]
            for vname in varga_list:
                if vname == "d1":
                    v_sign = sign
                else:
                    vkey = f"{vname}_signs"
                    vdata = vargas.get(vkey, {})
                    v_sign = vdata.get(planet, sign)
                # Points: 15 for exalt/own/friendly in varga, 7.5 neutral, 0 debilitated (simplified per standard scoring)
                if v_sign == EXALT_SIGN.get(planet, -1) or v_sign in OWN_SIGNS.get(planet, []):
                    saptavarga += 15 / 7.0 * 2  # boosted for accuracy
                elif v_sign == DEBIL_SIGN.get(planet, -1):
                    saptavarga += 0
                else:
                    saptavarga += 7.5 / 7.0
        sthana += saptavarga

        # Kendradi Bala (angular strength)
        house = ((sign - lagna_rasi_idx) % 12) + 1
        if house in (1, 4, 7, 10):
            sthana += 30
        elif house in (5, 9):
            sthana += 15
        else:
            sthana += 7.5

        # 2. Digbala (directional strength, max 60)
        # Standard directions: Sun/Mars east (max in 10th? ), Moon north, etc.
        dig_dirs = {"Sun": 0, "Moon": 3, "Mars": 0, "Mercury": 6, "Jupiter": 9, "Venus": 6, "Saturn": 9}  # approx house offsets
        target = dig_dirs.get(planet, 0)
        diff = min(abs((sign - target) % 12), 12 - abs((sign - target) % 12))
        digbala = 60 * (1 - diff / 6.0)

        # 3. Kalabala (temporal) - improved approx using available (full needs sunrise etc.)
        # Ayanabala etc approximated; use 20-40 range
        kalabala = 25.0
        if speeds and planet in speeds:
            # slight boost if in fast motion for some
            if abs(speeds[planet]) > 1.0:
                kalabala += 5

        # 4. Cheshtabala (motional strength) - use speed
        cheshta = 0.0
        if speeds and planet in speeds:
            sp = abs(speeds[planet])
            if speeds[planet] < 0:  # negative speed = retrograde
                cheshta = 45  # retro gives high cheshta in tradition
            else:
                cheshta = min(30, sp * 10)  # higher speed = more cheshta
        else:
            cheshta = 15

        # 5. Naisargika
        naisargika = NAISARGIKA.get(planet, 10)

        # 6. Drikbala (aspectual) - improved using planet_aspects
        drik = 0.0
        # Simple: each aspect from benefic adds, malefic subtracts (simplified, max ~60)
        # Use existing aspect logic
        p_rasi = sign
        aspects = planet_aspects(planet, p_rasi)  # but this is outgoing; for received we approximate
        # For simplicity, add fixed based on known benefics aspects
        if planet in ["Jupiter", "Venus", "Moon"]:
            drik = 20
        else:
            drik = 10
        # Could expand with full aspect calc from all planets, but this is better than before

        total_virupa = sthana + digbala + kalabala + cheshta + naisargika + drik
        total_rupa = round(total_virupa / 60.0, 2)

        result[planet] = {
            "sthana": round(sthana, 1),
            "dig": round(digbala, 1),
            "kala": round(kalabala, 1),
            "cheshta": round(cheshta, 1),
            "naisargika": round(naisargika, 1),
            "drik": round(drik, 1),
            "total_virupa": round(total_virupa, 1),
            "total_rupa": total_rupa,
            "is_strong": total_rupa >= 5.0,
        }

    return result


def get_chara_dasha(
    lagna_rasi_idx: int,
    birth_dt: datetime,
    chara_karakas: dict | None = None,
    positions: dict[str, float] | None = None,
) -> dict:
    """
    Jaimini Chara Dasha (sign-based dashas).
    - Sequence starts at Lagna sign.
    - Direction: forward (zodiacal) if Lagna odd (1-based), reverse if even.
    - Dasha length (years) for a sign = number of signs to its lord's position, counted in dasha direction.
    - For Scorpio/Aquarius uses Mars/Saturn (co-lord rules with Ketu/Rahu + AK can be extended).
    - Pairs with Chara Karakas (AK etc. available for future subperiod/AK-influenced refinements).
    Approximate but useful; full Parasara/Jaimini specials (e.g. stronger co-lord by aspect/house, exact AK counting) extensible.
    """
    now = datetime.utcnow()
    direction = 1 if ((lagna_rasi_idx + 1) % 2 == 1) else -1  # odd Lagna (Aries etc.): +1 forward

    def _dist_in_dir(from_s: int, to_s: int, dir_: int) -> int:
        d = 0
        s = from_s
        for _ in range(12):
            d += 1
            s = (s + dir_) % 12
            if s == to_s:
                return d
        return 12

    timeline = []
    cursor = birth_dt
    for i in range(12):
        s = (lagna_rasi_idx + i * direction) % 12
        name = RASI_NAMES[s]
        rasi_name = name

        # lord selection (special for Sc/Aq)
        if rasi_name == "Scorpio":
            lord_name = "Mars"  # Ketu co-lord; starter uses Mars (refine via AK/strength later)
        elif rasi_name == "Aquarius":
            lord_name = "Saturn"  # Rahu co-lord
        else:
            lord_name = RASI_RULERS.get(rasi_name, "Mars")

        # years = distance to lord sign in direction (or 12 if same)
        yrs = 12
        if positions and lord_name in positions:
            lord_sign = int(positions[lord_name] / 30.0) % 12
            yrs = _dist_in_dir(s, lord_sign, direction)
            if yrs == 0:
                yrs = 12

        end = cursor + timedelta(days=yrs * 365.25)
        is_cur = cursor <= now <= end
        timeline.append({
            "sign": name,
            "lord": lord_name,
            "start": cursor.strftime("%b %Y"),
            "end": end.strftime("%b %Y"),
            "years": yrs,
            "is_current": is_cur,
        })
        cursor = end

    current = None
    for t in timeline:
        if t.get("is_current"):
            current = {"sign": t["sign"], "end": t["end"], "lord": t.get("lord")}
            break

    return {
        "type": "chara",
        "natal_dasha_lord": RASI_NAMES[lagna_rasi_idx],
        "direction": "forward" if direction > 0 else "reverse",
        "current": current,
        "timeline": timeline,
        "note": "Approximate Jaimini Chara Dasha (direction + variable periods via lord distance). Special Scorpio/Aquarius use Mars/Saturn. See chara_karakas for AK etc. Sub-periods & full co-lord rules extensible.",
    }


def _years_remaining(now: datetime, end: datetime) -> str:
    delta = end - now
    if delta.days < 0:
        return "elapsed"
    years = delta.days / 365.25
    if years >= 2:
        return f"{years:.1f} yrs"
    months = delta.days / 30.44
    if months >= 1:
        return f"{months:.0f} mo"
    return f"{delta.days} days"


# ---------------------------------------------------------------------------
# Gochara (transit) helpers
# ---------------------------------------------------------------------------

# Average absolute daily motion (degrees/day) used for sign-exit estimates
PLANET_AVG_SPEED = {
    "Sun":     0.9856,
    "Moon":    13.176,
    "Mercury": 1.383,
    "Venus":   1.200,
    "Mars":    0.524,
    "Jupiter": 0.0831,
    "Saturn":  0.0335,
    "Rahu":    0.0529,
    "Ketu":    0.0529,
}

TRANSIT_IMPACT = {
    "critical": "🔴",
    "major":    "🟠",
    "positive": "🟢",
    "moderate": "🟡",
    "info":     "⚪",
}


def _jd_from_dt(dt: datetime) -> float:
    return swe.julday(dt.year, dt.month, dt.day,
                      dt.hour + dt.minute / 60.0 + dt.second / 3600.0)


def _find_sign_ingresses_in_range(
    planet_id: int, start_dt: datetime, end_dt: datetime, step_days: int = 10,
    ayanamsa_mode: int | None = None
) -> list[tuple[datetime, int]]:
    """Binary-search for each sign ingress of a planet between start_dt and end_dt.
    If ayanamsa_mode is None: use tropical (no sidereal correction).
    """
    if ayanamsa_mode is None:
        flags = swe.FLG_SPEED
    else:
        swe.set_sid_mode(ayanamsa_mode)
        flags = swe.FLG_SIDEREAL
    ingresses: list[tuple[datetime, int]] = []
    r, _ = swe.calc_ut(_jd_from_dt(start_dt), planet_id, flags)
    prev_sign = int(r[0] / 30) % 12
    current = start_dt
    while current < end_dt:
        nxt = min(current + timedelta(days=step_days), end_dt)
        r, _ = swe.calc_ut(_jd_from_dt(nxt), planet_id, flags)
        sign = int(r[0] / 30) % 12
        if sign != prev_sign:
            lo, hi = current, nxt
            for _ in range(16):
                mid = lo + (hi - lo) / 2
                r_mid, _ = swe.calc_ut(_jd_from_dt(mid), planet_id, flags)
                s_mid = int(r_mid[0] / 30) % 12
                if s_mid == prev_sign:
                    lo = mid
                else:
                    hi = mid
            ingresses.append((hi, sign))
            prev_sign = sign
        current = nxt
    return ingresses


def get_dasha_transit_forecast(
    dasha: dict,
    natal_positions: dict[str, float],
    natal_lagna_rasi_idx: int,
    ayanamsa_mode: int | str | None = None,
) -> list[dict]:
    """
    For the current Mahadasha + the next one, enumerate key Jupiter / Saturn /
    Rahu sign-changes and Double Transit windows.
    Returns a list of event dicts sorted chronologically.
    """
    now = datetime.utcnow()
    timeline_raw = dasha.get("_timeline_raw", [])
    if not timeline_raw:
        return []

    periods: list[dict] = []
    for i, p in enumerate(timeline_raw):
        if p["start"] <= now <= p["end"]:
            periods.append(p)
            if i + 1 < len(timeline_raw):
                periods.append(timeline_raw[i + 1])
            break
    if not periods:
        return []

    eff_mode = _resolve_ayanamsa_mode(ayanamsa_mode)

    natal_moon_sign  = int(natal_positions["Moon"] / 30) % 12
    natal_lagna_sign = natal_lagna_rasi_idx
    forecast_start   = now
    forecast_end     = min(periods[-1]["end"], now + timedelta(days=20 * 365.25))

    events: list[dict] = []

    def _dasha_label(dt: datetime) -> str:
        return next((p["planet"] for p in periods if p["start"] <= dt <= p["end"]), "")

    # ── Jupiter ingresses ─────────────────────────────────────────────────
    for dt_in, sign in _find_sign_ingresses_in_range(swe.JUPITER, forecast_start, forecast_end, 15, ayanamsa_mode=eff_mode):
        h_l = ((sign - natal_lagna_sign) % 12) + 1
        h_m = ((sign - natal_moon_sign)  % 12) + 1
        q   = ("positive" if h_l in (1, 5, 9) else
               "moderate" if h_l in (2, 4, 7, 10, 11) else "info")
        events.append({
            "date": dt_in, "planet": "Jupiter",
            "type": f"♃ Jupiter → {RASI_NAMES[sign]}",
            "detail": f"{h_l}th from Lagna · {h_m}th from Moon",
            "quality": q, "icon": TRANSIT_IMPACT.get(q, "⚪"),
            "dasha": _dasha_label(dt_in),
        })

    # ── Saturn ingresses ──────────────────────────────────────────────────
    for dt_in, sign in _find_sign_ingresses_in_range(swe.SATURN, forecast_start, forecast_end, 20, ayanamsa_mode=eff_mode):
        h_l  = ((sign - natal_lagna_sign) % 12) + 1
        h_m  = ((sign - natal_moon_sign)  % 12) + 1
        sade = (sign - natal_moon_sign)  % 12 in (0, 1, 11)
        ashta= (sign - natal_moon_sign)  % 12 == 7
        kant = (sign - natal_lagna_sign) % 12 in (0, 3, 6, 9)
        q    = ("critical" if sade or ashta else "major" if kant else "moderate")
        labels = []
        if (sign - natal_moon_sign) % 12 == 11: labels.append("Sade Sati begins (rising)")
        elif (sign - natal_moon_sign) % 12 == 0: labels.append("Sade Sati peak")
        elif (sign - natal_moon_sign) % 12 == 1: labels.append("Sade Sati (setting)")
        if ashta: labels.append("Ashtama Shani")
        if kant:  labels.append(f"Kantaka Shani ({h_l}th)")
        detail = " · ".join(labels) if labels else f"{h_l}th from Lagna · {h_m}th from Moon"
        events.append({
            "date": dt_in, "planet": "Saturn",
            "type": f"♄ Saturn → {RASI_NAMES[sign]}",
            "detail": detail,
            "quality": q, "icon": TRANSIT_IMPACT.get(q, "⚪"),
            "dasha": _dasha_label(dt_in),
        })

    # ── Rahu / Ketu axis shifts ───────────────────────────────────────────
    for dt_in, sign in _find_sign_ingresses_in_range(swe.MEAN_NODE, forecast_start, forecast_end, 15, ayanamsa_mode=eff_mode):
        ket_sign = (sign + 6) % 12
        h_r = ((sign      - natal_lagna_sign) % 12) + 1
        h_k = ((ket_sign  - natal_lagna_sign) % 12) + 1
        events.append({
            "date": dt_in, "planet": "Rahu",
            "type": f"☊ Rahu → {RASI_NAMES[sign]} / Ketu → {RASI_NAMES[ket_sign]}",
            "detail": f"Rahu {h_r}th · Ketu {h_k}th from Lagna",
            "quality": "info", "icon": TRANSIT_IMPACT["info"],
            "dasha": _dasha_label(dt_in),
        })

    # ── Double Transit windows (month-by-month sweep) ─────────────────────
    if eff_mode is None:
        flags = swe.FLG_SPEED
    else:
        swe.set_sid_mode(eff_mode)
        flags = swe.FLG_SIDEREAL
    step  = timedelta(days=30)
    cur   = forecast_start
    in_dbl: dict | None = None
    while cur <= forecast_end:
        jd_c = _jd_from_dt(cur)
        ju_r, _ = swe.calc_ut(jd_c, swe.JUPITER, flags)
        sa_r, _ = swe.calc_ut(jd_c, swe.SATURN,  flags)
        ju_s = int(ju_r[0] / 30) % 12
        sa_s = int(sa_r[0] / 30) % 12
        triggered = None
        for ref_sign, ref_lbl in ((natal_moon_sign, "Moon"), (natal_lagna_sign, "Lagna")):
            if (_transit_aspects_sign("Jupiter", ju_s, ref_sign) and
                    _transit_aspects_sign("Saturn", sa_s, ref_sign)):
                triggered = (ju_s, sa_s, ref_sign, ref_lbl)
                break
        if triggered and in_dbl is None:
            in_dbl = {"start": cur, "key": triggered}
        elif not triggered and in_dbl is not None:
            ju_s_d, sa_s_d, ref_s, ref_l = in_dbl["key"]
            events.append({
                "date": in_dbl["start"], "end_date_str": cur.strftime("%b %Y"),
                "planet": "Jupiter + Saturn",
                "type": f"⚡ Double Transit — {ref_l}",
                "detail": (f"♃ {RASI_NAMES[ju_s_d]} + ♄ {RASI_NAMES[sa_s_d]} both aspecting "
                           f"natal {ref_l} ({RASI_NAMES[ref_s]}). Closes ~{cur.strftime('%b %Y')}."),
                "quality": "critical", "icon": TRANSIT_IMPACT["critical"],
                "dasha": _dasha_label(in_dbl["start"]),
            })
            in_dbl = None
        cur += step
    if in_dbl is not None:
        ju_s_d, sa_s_d, ref_s, ref_l = in_dbl["key"]
        events.append({
            "date": in_dbl["start"], "end_date_str": forecast_end.strftime("%b %Y"),
            "planet": "Jupiter + Saturn",
            "type": f"⚡ Double Transit — {ref_l}",
            "detail": (f"♃ {RASI_NAMES[ju_s_d]} + ♄ {RASI_NAMES[sa_s_d]} both aspecting "
                       f"natal {ref_l} ({RASI_NAMES[ref_s]})."),
            "quality": "critical", "icon": TRANSIT_IMPACT["critical"],
            "dasha": _dasha_label(in_dbl["start"]),
        })

    events.sort(key=lambda e: e["date"])
    for e in events:
        e["date_str"] = e["date"].strftime("%b %Y")
        del e["date"]
    return events


def get_planet_positions_only(jd: float, ayanamsa_mode: int | None = None) -> dict[str, float]:
    """Return longitudes for the 9 grahas (no Lagna). If ayanamsa_mode is None: tropical (no correction)."""
    if ayanamsa_mode is None:
        flags = swe.FLG_SPEED
    else:
        swe.set_sid_mode(ayanamsa_mode)
        flags = swe.FLG_SIDEREAL
    planet_ids = {
        "Sun": swe.SUN, "Moon": swe.MOON, "Mercury": swe.MERCURY,
        "Venus": swe.VENUS, "Mars": swe.MARS, "Jupiter": swe.JUPITER,
        "Saturn": swe.SATURN, "Rahu": swe.MEAN_NODE,
    }
    pos: dict[str, float] = {}
    for name, pid in planet_ids.items():
        result, _ = swe.calc_ut(jd, pid, flags)
        pos[name] = result[0] % 360.0
    pos["Ketu"] = (pos["Rahu"] + 180.0) % 360.0
    return pos


def _friendly_duration(days: float) -> str:
    if days <= 0:
        return "imminent"
    if days < 14:
        return f"{int(days)} days"
    if days < 60:
        return f"{round(days / 7)} weeks"
    if days < 365:
        return f"{round(days / 30.44)} months"
    return f"{days / 365.25:.1f} yrs"


def _days_to_exit_sign(sidereal_deg: float, planet: str) -> float:
    """Approximate days until planet exits its current sign (forward motion assumed)."""
    remaining = 30.0 - (sidereal_deg % 30.0)
    speed = PLANET_AVG_SPEED.get(planet, 0.1)
    return remaining / speed


def _transit_aspects_sign(planet: str, planet_sign: int, target_sign: int) -> bool:
    """Return True if this transiting planet aspects the target sign (whole-sign Vedic aspects)."""
    aspected = {planet_sign, (planet_sign + 6) % 12}     # conjunction + 7th (universal)
    if planet == "Jupiter":
        aspected |= {(planet_sign + 4) % 12, (planet_sign + 8) % 12}
    elif planet == "Saturn":
        aspected |= {(planet_sign + 2) % 12, (planet_sign + 9) % 12}
    elif planet == "Mars":
        aspected |= {(planet_sign + 3) % 12, (planet_sign + 7) % 12}
    elif planet in ("Rahu", "Ketu"):
        aspected |= {(planet_sign + 4) % 12, (planet_sign + 8) % 12}
    return target_sign in aspected


def get_current_transits(natal_positions: dict[str, float],
                         natal_lagna_rasi_idx: int,
                         sarva: list[int],
                         ayanamsa_mode: int | str | None = None) -> dict:
    """
    Compute today's planetary positions and generate significant Gochara alerts.
    Returns { 'transit_positions': {...}, 'alerts': [...] }
    """
    _now = datetime.utcnow()
    now_jd = swe.julday(_now.year, _now.month, _now.day,
                        _now.hour + _now.minute / 60.0 + _now.second / 3600.0)
    eff_mode = _resolve_ayanamsa_mode(ayanamsa_mode)
    t = get_planet_positions_only(now_jd, ayanamsa_mode=eff_mode)   # today's positions (respecting tropical choice)
    today = datetime.utcnow()

    alerts: list[dict] = []

    natal_moon_sign  = int(natal_positions["Moon"]  / 30) % 12
    natal_lagna_sign = natal_lagna_rasi_idx
    natal_sun_sign   = int(natal_positions["Sun"]   / 30) % 12

    sat_sign = int(t["Saturn"]  / 30) % 12
    jup_sign = int(t["Jupiter"] / 30) % 12
    rah_sign = int(t["Rahu"]    / 30) % 12
    ket_sign = int(t["Ketu"]    / 30) % 12
    mar_sign = int(t["Mars"]    / 30) % 12

    sign_days = 30.0 / PLANET_AVG_SPEED["Saturn"]    # ≈ 895 days per sign

    # ── 1. SADE SATI ─────────────────────────────────────────────────────────
    sade_offset = (sat_sign - natal_moon_sign) % 12
    if sade_offset in (0, 1, 11):
        phase    = {0: "Peak",    11: "Rising",   1: "Setting"}[sade_offset]
        severity = {0: "critical", 11: "major",   1: "major"}[sade_offset]
        phases_remaining = {0: 2, 11: 3, 1: 1}[sade_offset]
        days_in_current  = _days_to_exit_sign(t["Saturn"], "Saturn")
        total_remaining  = days_in_current + (phases_remaining - 1) * sign_days
        exit_approx      = today + timedelta(days=total_remaining)
        sarva_score      = sarva[sat_sign] if sarva else "—"
        alerts.append({
            "type":     "SADE SATI",
            "severity": severity,
            "icon":     TRANSIT_IMPACT[severity],
            "phase":    phase,
            "body": (
                f"Saturn ({RASI_NAMES[sat_sign]}) is in the {phase} phase of Sade Sati — "
                f"the 12th/1st/2nd house from natal Moon ({RASI_NAMES[natal_moon_sign]}). "
                f"This 7.5-year cycle brings introspection, life restructuring, and karmic "
                f"consolidation. The {phase} phase "
                + {"Peak": "is the most intense — identity, health, and circumstances are most tested.",
                   "Rising": "marks the buildup — challenges in hidden matters, expenses, and isolation.",
                   "Setting": "is the release — slow improvement, gradual return of momentum."}[phase]
            ),
            "planet":     "Saturn",
            "sign":       RASI_NAMES[sat_sign],
            "house_from": f"{((sat_sign - natal_lagna_sign) % 12) + 1}th from Lagna",
            "sarva_score": sarva_score,
            "remaining":  _friendly_duration(total_remaining),
            "exit_approx": exit_approx.strftime("%b %Y"),
        })

    # ── 2. ASHTAMA SHANI (Saturn in 8th from natal Moon) ─────────────────────
    if (sat_sign - natal_moon_sign) % 12 == 7:
        days_rem = _days_to_exit_sign(t["Saturn"], "Saturn")
        sarva_score = sarva[sat_sign] if sarva else "—"
        alerts.append({
            "type":       "ASHTAMA SHANI",
            "severity":   "major",
            "icon":       TRANSIT_IMPACT["major"],
            "phase":      "Active",
            "body": (
                f"Saturn ({RASI_NAMES[sat_sign]}) transits the 8th house from natal Moon "
                f"({RASI_NAMES[natal_moon_sign]}). Associated with hidden obstacles, health caution, "
                f"sudden reversals, and delays. Avoid impulsive major decisions; use this period for "
                f"deep research and spiritual practice."
            ),
            "planet":      "Saturn",
            "sign":        RASI_NAMES[sat_sign],
            "house_from":  f"{((sat_sign - natal_lagna_sign) % 12) + 1}th from Lagna",
            "sarva_score": sarva_score,
            "remaining":   _friendly_duration(days_rem),
            "exit_approx": (today + timedelta(days=days_rem)).strftime("%b %Y"),
        })

    # ── 3. KANTAKA SHANI (Saturn in 1st, 4th, 7th, 10th from Lagna) ─────────
    kantaka_offset = (sat_sign - natal_lagna_sign) % 12
    if kantaka_offset in (0, 3, 6, 9):
        house_num = kantaka_offset + 1
        days_rem  = _days_to_exit_sign(t["Saturn"], "Saturn")
        alerts.append({
            "type":      f"KANTAKA SHANI ({house_num}th from Lagna)",
            "severity":  "major",
            "icon":      TRANSIT_IMPACT["major"],
            "phase":     "Active",
            "body": (
                f"Saturn in the {house_num}th house (kendra) from Lagna. "
                f"Creates friction in the themes of the {house_num}th house — "
                + {1: "self, health, and personal direction.",
                   4: "home, mother, property, and peace of mind.",
                   7: "relationships, business partnerships, and legal matters.",
                   10: "career, reputation, and public standing."}[house_num]
                + " Patience and steady effort yield results; resistance leads to delays."
            ),
            "planet":     "Saturn",
            "sign":       RASI_NAMES[sat_sign],
            "house_from": f"{house_num}th from Lagna",
            "sarva_score": sarva[sat_sign] if sarva else "—",
            "remaining":  _friendly_duration(days_rem),
            "exit_approx": (today + timedelta(days=days_rem)).strftime("%b %Y"),
        })

    # ── 4. JUPITER TRANSIT HOUSE (from Lagna + from Moon) ────────────────────
    jup_house_lagna = ((jup_sign - natal_lagna_sign) % 12) + 1
    jup_house_moon  = ((jup_sign - natal_moon_sign)  % 12) + 1
    jup_days_rem    = _days_to_exit_sign(t["Jupiter"], "Jupiter")
    jup_quality     = ("positive" if jup_house_lagna in (1, 5, 9) else
                       "moderate" if jup_house_lagna in (2, 4, 7, 10, 11) else "major")
    jup_interp = {
        1: "Guru directly blesses the Lagna — excellent for health, new beginnings, and self-expression.",
        2: "Expands wealth, family harmony, and speech.",
        3: "Effort-oriented; mental courage and sibling matters are highlighted.",
        4: "Home, property, and mother's wellbeing are under Jupiter's grace.",
        5: "Highly auspicious — intelligence, children, speculation, and creativity thrive.",
        6: "Service, health issues for enemies; legal matters need care.",
        7: "Partnership and marriage themes expand; good for negotiations.",
        8: "Hidden matters, inheritance, occult knowledge — mixed results.",
        9: "Best Jupiter transit position — dharma, fortune, and guru blessings flow abundantly.",
        10: "Career and public recognition expand; authority and ambition are favoured.",
        11: "Gains, friendships, and fulfilment of desires — very supportive.",
        12: "Spiritual growth, foreign travel, ashram; material losses possible.",
    }
    alerts.append({
        "type":      f"JUPITER TRANSIT — {jup_house_lagna}th from Lagna",
        "severity":  jup_quality,
        "icon":      TRANSIT_IMPACT[jup_quality],
        "phase":     "Ongoing",
        "body":      jup_interp.get(jup_house_lagna, "Jupiter in transit."),
        "planet":    "Jupiter",
        "sign":      RASI_NAMES[jup_sign],
        "house_from": f"{jup_house_lagna}th from Lagna · {jup_house_moon}th from Moon",
        "sarva_score": sarva[jup_sign] if sarva else "—",
        "remaining":   _friendly_duration(jup_days_rem),
        "exit_approx": (today + timedelta(days=jup_days_rem)).strftime("%b %Y"),
    })

    # ── 5. DOUBLE TRANSIT — Jupiter + Saturn both aspecting natal Moon or Lagna ──
    for ref_sign, ref_label in ((natal_moon_sign, "natal Moon"), (natal_lagna_sign, "Lagna")):
        jup_asp = _transit_aspects_sign("Jupiter", jup_sign, ref_sign)
        sat_asp = _transit_aspects_sign("Saturn",  sat_sign, ref_sign)
        if jup_asp and sat_asp:
            # Remaining = the shorter of Jupiter or Saturn's time in their current sign
            rem = min(_days_to_exit_sign(t["Jupiter"], "Jupiter"),
                      _days_to_exit_sign(t["Saturn"],  "Saturn"))
            alerts.append({
                "type":      f"DOUBLE TRANSIT — {ref_label}",
                "severity":  "critical",
                "icon":      TRANSIT_IMPACT["critical"],
                "phase":     "Active Window",
                "body": (
                    f"Jupiter ({RASI_NAMES[jup_sign]}) and Saturn ({RASI_NAMES[sat_sign]}) "
                    f"are simultaneously aspecting {ref_label} ({RASI_NAMES[ref_sign]}). "
                    f"This rare double transit is one of the most reliable timing markers "
                    f"for major life events — career changes, marriage, relocation, or "
                    f"significant new chapters. The window closes when either planet "
                    f"moves to the next sign (~{_friendly_duration(rem)} from now)."
                ),
                "planet":     "Jupiter + Saturn",
                "sign":       f"{RASI_NAMES[jup_sign]} + {RASI_NAMES[sat_sign]}",
                "house_from": f"Aspecting {ref_label}",
                "sarva_score": "—",
                "remaining":  _friendly_duration(rem),
                "exit_approx": (today + timedelta(days=rem)).strftime("%b %Y"),
            })

    # ── 6. RAHU / KETU over natal sensitives ─────────────────────────────────
    for node, node_sign, node_name in (("Rahu", rah_sign, "Rahu"), ("Ketu", ket_sign, "Ketu")):
        for sensitive_sign, sensitive_label in (
            (natal_moon_sign,  f"natal Moon ({RASI_NAMES[natal_moon_sign]})"),
            (natal_lagna_sign, f"natal Lagna ({RASI_NAMES[natal_lagna_sign]})"),
            (natal_sun_sign,   f"natal Sun ({RASI_NAMES[natal_sun_sign]})"),
        ):
            if node_sign == sensitive_sign:
                days_rem = _days_to_exit_sign(t[node], node)
                node_body = {
                    "Rahu": (
                        "Rahu amplifies, obsesses, and can bring unusual opportunities or disorientation "
                        "to the themes of this natal placement. Foreign connections, ambition, and "
                        "material desire are intensified."
                    ),
                    "Ketu": (
                        "Ketu detaches, spiritualises, and can bring losses or liberation related to "
                        "this natal placement. Past-life themes surface; material concerns may feel hollow. "
                        "Powerful for inner growth and moksha-oriented practice."
                    ),
                }[node]
                alerts.append({
                    "type":      f"{node_name} TRANSIT — over {sensitive_label}",
                    "severity":  "major",
                    "icon":      TRANSIT_IMPACT["major"],
                    "phase":     "Active",
                    "body":      node_body,
                    "planet":    node_name,
                    "sign":      RASI_NAMES[node_sign],
                    "house_from": f"{((node_sign - natal_lagna_sign) % 12) + 1}th from Lagna",
                    "sarva_score": sarva[node_sign] if sarva else "—",
                    "remaining":  _friendly_duration(days_rem),
                    "exit_approx": (today + timedelta(days=days_rem)).strftime("%b %Y"),
                })

    # ── 7. RAHU / KETU axis transit house (always informational) ─────────────
    rah_house = ((rah_sign - natal_lagna_sign) % 12) + 1
    ket_house = ((ket_sign - natal_lagna_sign) % 12) + 1
    rah_days_rem = _days_to_exit_sign(t["Rahu"], "Rahu")
    rah_interp = {
        1: "Rahu in Lagna — strong drive for reinvention; watch for impulsiveness and identity confusion.",
        2: "Obsessive focus on wealth, food, and speech. Foreign earnings possible.",
        3: "Ambition in communication, siblings, short travel, and media.",
        4: "Disruption or expansion in home/property matters; foreign residence.",
        5: "Unusual relationships with children; unconventional creativity and speculation.",
        6: "Powerful for overcoming enemies and competition; health vigilance needed.",
        7: "Karmic partnerships; foreign or unconventional spouse/business partner.",
        8: "Deep occult research, inheritance, sudden gains and losses.",
        9: "Questioning dharma and tradition; foreign guru or ideology.",
        10: "Ambition and career surge; rise can be rapid but needs ethical grounding.",
        11: "Strong gains, unusual friendships, fulfilment through unconventional paths.",
        12: "Foreign lands, spirituality, hidden matters; expenditure rises.",
    }
    alerts.append({
        "type":      f"RAHU/KETU AXIS — {rah_house}th / {ket_house}th",
        "severity":  "info",
        "icon":      TRANSIT_IMPACT["info"],
        "phase":     "Ongoing (~18 months/sign)",
        "body":      rah_interp.get(rah_house, "Rahu/Ketu transit active."),
        "planet":    "Rahu / Ketu",
        "sign":      f"Rahu: {RASI_NAMES[rah_sign]} · Ketu: {RASI_NAMES[ket_sign]}",
        "house_from": f"Rahu {rah_house}th · Ketu {ket_house}th from Lagna",
        "sarva_score": sarva[rah_sign] if sarva else "—",
        "remaining":  _friendly_duration(rah_days_rem),
        "exit_approx": (today + timedelta(days=rah_days_rem)).strftime("%b %Y"),
    })

    # Sort: critical first, then major, positive, moderate, info
    severity_order = {"critical": 0, "major": 1, "positive": 2, "moderate": 3, "info": 4}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 5))

    from agent.transit_filter import filter_gochara_alerts

    primary, secondary = filter_gochara_alerts(alerts)
    return {
        "transit_positions": t,
        "alerts": primary,
        "alerts_secondary": secondary,
    }


# ---------------------------------------------------------------------------
# Main chart calculation
# ---------------------------------------------------------------------------

def calculate_chart(date_str: str, time_str: str, place: str, ayanamsa: str = "lahiri") -> dict:
    """Calculate chart with optional ayanamsa: 'lahiri' (default), 'raman', 'krishnamurti', 'tropical'.
    'tropical' (or 'sayana'/'none') means no ayanamsa correction — pure tropical / Sayana positions.
    """
    lat, lon    = geocode_place(place)
    tz_name     = get_timezone_name(lat, lon)
    jd, birth_dt = birth_to_jd(date_str, time_str, lat, lon, tz_name)

    AYANAMSA_MAP = {
        "lahiri": swe.SIDM_LAHIRI,
        "raman": swe.SIDM_RAMAN,
        "krishnamurti": swe.SIDM_KRISHNAMURTI,
        # Add more as needed, e.g. "fagan_bradley": swe.SIDM_FAGAN_BRADLEY
    }

    mode = _resolve_ayanamsa_mode(ayanamsa)
    ayan_display = "tropical" if mode is None else (ayanamsa or "lahiri").lower().strip()

    positions, retrograde, speeds, ayanamsa_val = get_sidereal_positions(jd, lat, lon, ayanamsa_mode=mode)

    if mode is None:
        ayanamsa_val = 0.0

    lagna_rasi_idx = int(positions["Lagna"] / 30.0) % 12

    # Map: planet → rasi index (Lagna included for occupation, excluded from aspects)
    p_rasi: dict[str, int] = {p: int(deg / 30.0) % 12 for p, deg in positions.items()}

    # Precompute aspect map: rasi_idx → [(aspecting_planet, aspect_number)]
    aspects_on_rasi: dict[int, list] = {i: [] for i in range(12)}
    for p, ridx in p_rasi.items():
        if p == "Lagna":
            continue
        for target_ridx, asp_num in planet_aspects(p, ridx):
            aspects_on_rasi[target_ridx].append((p, asp_num))

    # Map: nakshatra_idx (0-based) → list of (planet, degree)
    planets_in_nak: dict[int, list] = {i: [] for i in range(27)}
    for p, deg in positions.items():
        nak_idx = int(deg / NAKSHATRA_SPAN) % 27
        planets_in_nak[nak_idx].append((p, deg))

    rows = []
    for i in range(27):
        nak_no, nak_name, nak_ruler = NAKSHATRA_DATA[i]
        best_planet = NAKSHATRA_BEST_PLANET[i]

        start_deg = i * NAKSHATRA_SPAN
        end_deg = (i + 1) * NAKSHATRA_SPAN  # may exceed 360 for last one

        # Rasi coverage
        start_rasi_idx = int(start_deg / 30.0) % 12
        # end_deg can be 360 exactly — treat as 0 (Aries)
        end_rasi_idx = int((min(end_deg, 359.9999)) / 30.0) % 12

        start_rasi = RASI_NAMES[start_rasi_idx]
        end_rasi = RASI_NAMES[end_rasi_idx]

        if start_rasi_idx == end_rasi_idx:
            rasi_display = start_rasi
            rasi_ruler_display = RASI_RULERS[start_rasi]
            deg_span = (
                f"{fmt_dm(start_deg % 30)} – {fmt_dm(end_deg % 30 or 30)} {start_rasi}"
            )
        else:
            rasi_display = f"{start_rasi} / {end_rasi}"
            rasi_ruler_display = (
                f"{RASI_RULERS[start_rasi]} / {RASI_RULERS[end_rasi]}"
            )
            boundary = (start_rasi_idx + 1) * 30.0
            deg_span = (
                f"{fmt_dm(start_deg % 30)} – 30°00′ {start_rasi}; "
                f"0°00′ – {fmt_dm(end_deg % 30)} {end_rasi}"
            )

        # Primary rasi (midpoint) for Bhava assignment
        mid_deg = start_deg + NAKSHATRA_SPAN / 2.0
        primary_rasi_idx = int(mid_deg / 30.0) % 12
        bhava_no = ((primary_rasi_idx - lagna_rasi_idx) % 12) + 1
        bhava_type = BHAVA_NAMES[bhava_no]

        # Planets occupying this Nakshatra
        occupants = planets_in_nak[i]
        native_parts = []
        for p, deg in occupants:
            native_parts.append(f"{p} {fmt_dms(deg)}")
        native_planet_str = "; ".join(native_parts)

        # Aspects received by planets in this Nakshatra
        aspects_received_parts = []
        if occupants:
            for p, deg in occupants:
                p_ridx = int(deg / 30.0) % 12
                for asp_planet, asp_list in [
                    (ap, planet_aspects(ap, p_rasi[ap]))
                    for ap in p_rasi
                    if ap != p and ap != "Lagna"
                ]:
                    for target_ridx, asp_num in asp_list:
                        if target_ridx == p_ridx:
                            aspects_received_parts.append(
                                f"{asp_planet} {ASPECT_LABELS.get(asp_num, str(asp_num))} aspect"
                            )
        aspects_received = (
            "; ".join(aspects_received_parts)
            if aspects_received_parts
            else ("N/A" if occupants else "")
        )

        # Aspects falling on this Bhava (house)
        occupant_names = {p for p, _ in occupants}
        bhava_asp_parts = [
            f"{ap} {ASPECT_LABELS.get(an, str(an))} aspect"
            for ap, an in aspects_on_rasi[primary_rasi_idx]
            if ap not in occupant_names
        ]
        aspects_on_bhava = "; ".join(bhava_asp_parts)

        rows.append({
            "no":              nak_no,
            "nakshatra":       nak_name,
            "rasi":            rasi_display,
            "degree_span":     deg_span,
            "nak_ruler":       nak_ruler,
            "rasi_ruler":      rasi_ruler_display,
            "bhava_no":        bhava_no,
            "bhava_type":      bhava_type,
            "native_planet":   native_planet_str,
            "best_planet":     best_planet,
            "aspects_received":aspects_received,
            "aspects_on_bhava":aspects_on_bhava,
        })

    # Dignity, combustion, Chara Karakas
    sun_deg       = positions.get("Sun", 0)
    dignity_map   = {p: get_dignity(p, deg)              for p, deg in positions.items()}
    combust_map   = {p: is_combust(p, deg, sun_deg)      for p, deg in positions.items()}
    chara_karakas = get_chara_karakas(positions)

    # Navamsa D9 sign per planet
    d9_signs = {p: get_navamsa_sign(deg) for p, deg in positions.items()}

    # Additional divisional charts (D3 Drekkana, D10 Dasamsa)
    d3_signs = {p: get_drekkana_sign(deg) for p, deg in positions.items()}
    d10_signs = {p: get_dasamsa_sign(deg) for p, deg in positions.items()}

    # More Vargas for Saptavargaja Bala and general depth (D2, D7, D12, D30)
    d2_signs = {p: get_hora_d2_sign(deg) for p, deg in positions.items()}
    d7_signs = {p: get_saptamsa_d7_sign(deg) for p, deg in positions.items()}
    d12_signs = {p: get_dwadasamsa_d12_sign(deg) for p, deg in positions.items()}
    d30_signs = {p: get_trimsamsa_d30_sign(deg) for p, deg in positions.items()}

    # Additional Vargas for more depth (D4 property/vehicles, D16 comforts, D20 spiritual, D24 education)
    d4_signs = {p: get_chaturthamsa_d4_sign(deg) for p, deg in positions.items()}
    d16_signs = {p: get_shodashamsa_d16_sign(deg) for p, deg in positions.items()}
    d20_signs = {p: get_vimsamsa_d20_sign(deg) for p, deg in positions.items()}
    d24_signs = {p: get_chaturvimshamsa_d24_sign(deg) for p, deg in positions.items()}

    # Higher Vargas for full depth (D27 strength, D40 maternal, D45 paternal, D60 karma)
    d27_signs = {p: get_nakshatramsa_d27_sign(deg) for p, deg in positions.items()}
    d40_signs = {p: get_khavedamsa_d40_sign(deg) for p, deg in positions.items()}
    d45_signs = {p: get_akshavedamsa_d45_sign(deg) for p, deg in positions.items()}
    d60_signs = {p: get_shashtiamsa_d60_sign(deg) for p, deg in positions.items()}

    # Ashtakavarga
    bav, sarva = calculate_ashtakavarga(positions, lagna_rasi_idx)

    # Yoga detection
    yogas = detect_yogas(positions, dignity_map, lagna_rasi_idx)

    # Vimshottari Dasha
    dasha = get_vimshottari_dasha(positions["Moon"], birth_dt)

    # Chara Dasha (Jaimini)
    chara_dasha = get_chara_dasha(lagna_rasi_idx, birth_dt, chara_karakas=chara_karakas, positions=positions)

    # Current transits + Gochara alerts
    gochara = get_current_transits(positions, lagna_rasi_idx, sarva, ayanamsa_mode=mode)

    # Dasha-period transit forecast (current + next Mahadasha)
    from agent.transit_filter import filter_forecast_events

    dasha_forecast_raw = get_dasha_transit_forecast(
        dasha, positions, lagna_rasi_idx, ayanamsa_mode=mode
    )
    dasha_forecast = filter_forecast_events(
        dasha_forecast_raw, positions, lagna_rasi_idx
    )

    # Shadbala (6 balas) - uses vargas for Saptavargaja
    vargas_for_shadbala = {
        "d2_signs": d2_signs, "d3_signs": d3_signs, "d7_signs": d7_signs,
        "d9_signs": d9_signs, "d12_signs": d12_signs, "d30_signs": d30_signs,
    }
    shadbala = calculate_shadbala(positions, lagna_rasi_idx, speeds=speeds, vargas=vargas_for_shadbala)

    return {
        "rows":          rows,
        "positions":     positions,
        "retrograde":    retrograde,
        "dignity":       dignity_map,
        "combust":       combust_map,
        "chara_karakas": chara_karakas,
        "d9_signs":      d9_signs,
        "d3_signs":      d3_signs,
        "d10_signs":     d10_signs,
        "d2_signs":      d2_signs,
        "d7_signs":      d7_signs,
        "d12_signs":     d12_signs,
        "d30_signs":     d30_signs,
        "d4_signs":      d4_signs,
        "d16_signs":     d16_signs,
        "d20_signs":     d20_signs,
        "d24_signs":     d24_signs,
        "d27_signs":     d27_signs,
        "d40_signs":     d40_signs,
        "d45_signs":     d45_signs,
        "d60_signs":     d60_signs,
        "bav":           bav,
        "sarva":         sarva,
        "yogas":         yogas,
        "dasha":          dasha,
        "chara_dasha":    chara_dasha,
        "dasha_forecast": dasha_forecast,
        "gochara":        gochara,
        "shadbala":       shadbala,
        "lagna_rasi":    RASI_NAMES[lagna_rasi_idx],
        "ayanamsa_mode": ayan_display,
        "ayanamsa":      ayanamsa_val,
        "lat":           lat,
        "lon":           lon,
        "tz":            tz_name,
        "jd":            jd,
    }
