"""
Filter transit alerts and forecast rows to Tier A/B impactful events.

Used by Gochara (get_current_transits), dasha forecast rendering, and Time Dial API.
"""
from __future__ import annotations

from typing import Any

# Gochara card severities
_SEV_ORDER = {"critical": 0, "major": 1, "positive": 2, "moderate": 3, "info": 4}

# Dial banner levels
_DIAL_SEV_SCORE = {"critical": 40, "major": 25, "positive": 10}

# Tier A dial groups — always shown (not subject to min_score cutoff)
_DIAL_TIER_A_GROUPS = frozenset({"sade", "ashtama"})

_DIAL_CATEGORY_ORDER: list[tuple[str, str]] = [
    ("saturn", "Saturn"),
    ("double_transit", "Double transit"),
    ("nodes", "Rahu / Ketu"),
    ("life_events", "Life events"),
]

_SENSITIVE_PRIORITY = ("Moon", "Lagna", "Sun")


def _dial_category(group: str, *, heuristic: bool = False) -> str:
    if heuristic or group.startswith("life:"):
        return "life_events"
    if group in ("sade", "ashtama", "kantaka"):
        return "saturn"
    if group.startswith("double:"):
        return "double_transit"
    if group.startswith("node:"):
        return "nodes"
    return "other"


def organize_dial_banner(alerts: list[dict], *, top_n: int = 3) -> dict[str, Any]:
    """Split sorted dial alerts into pinned top N and collapsible category buckets."""
    top = alerts[:top_n]
    remaining = alerts[top_n:]
    by_cat: dict[str, list[dict]] = {}
    for a in remaining:
        cat = a.get("category") or "other"
        by_cat.setdefault(cat, []).append(a)

    categories: list[dict[str, Any]] = []
    for cid, label in _DIAL_CATEGORY_ORDER:
        if by_cat.get(cid):
            categories.append({"id": cid, "label": label, "alerts": by_cat[cid]})
    if by_cat.get("other"):
        categories.append({"id": "other", "label": "Other", "alerts": by_cat["other"]})
    return {"top": top, "categories": categories}


def _alert_type_key(alert: dict) -> str:
    t = (alert.get("type") or "").upper()
    if "SADE SATI" in t:
        return "sade_sati"
    if "ASHTAMA SHANI" in t:
        return "ashtama"
    if "DOUBLE TRANSIT" in t:
        return "double_transit"
    if "KANTAKA SHANI" in t:
        return "kantaka"
    if "RAHU/KETU AXIS" in t:
        return "axis"
    if "JUPITER TRANSIT" in t:
        return "jupiter_house"
    if "TRANSIT — over" in t or "TRANSIT — OVER" in t:
        return "node_conjunct"
    return "other"


def _node_sensitive_label(alert: dict) -> str | None:
    t = alert.get("type") or ""
    for label in _SENSITIVE_PRIORITY:
        if label in t:
            return label
    return None


def _sarva_int(score: Any) -> int | None:
    if isinstance(score, int):
        return score
    return None


def filter_gochara_alerts(
    alerts: list[dict],
    *,
    max_primary: int = 6,
) -> tuple[list[dict], list[dict]]:
    """
    Returns (primary_cards, secondary_cards) for the Gochara tab.
    Collapses Rahu/Ketu axis essay into a short secondary line.
    """
    if not alerts:
        return [], []

    by_key: dict[str, list[dict]] = {}
    for a in alerts:
        by_key.setdefault(_alert_type_key(a), []).append(a)

    primary: list[dict] = []
    secondary: list[dict] = []

    has_sade = bool(by_key.get("sade_sati"))

    # Tier A — Sade Sati
    for a in by_key.get("sade_sati", []):
        primary.append(a)

    # Tier A — Ashtama (distinct from Sade)
    for a in by_key.get("ashtama", []):
        primary.append(a)

    # Tier A — Double transit: Moon and Lagna references only
    for a in by_key.get("double_transit", []):
        t = a.get("type") or ""
        if "natal Moon" in t or (
            "Lagna" in t and "7th" not in t and "5th" not in t
        ):
            primary.append(a)

    # Tier A — Kantaka unless Sade already covers same Saturn story
    if not has_sade:
        for a in by_key.get("kantaka", []):
            primary.append(a)

    # Tier A — Node conjunctions (max 2: Moon > Lagna > Sun)
    node_hits: list[tuple[int, dict]] = []
    for a in by_key.get("node_conjunct", []):
        label = _node_sensitive_label(a)
        if label:
            node_hits.append((_SENSITIVE_PRIORITY.index(label), a))
    node_hits.sort(key=lambda x: x[0])
    for _, a in node_hits[:2]:
        primary.append(a)

    # Tier B — Jupiter house (skip weak houses unless low Sarva)
    for a in by_key.get("jupiter_house", []):
        sarva = _sarva_int(a.get("sarva_score"))
        house_txt = a.get("house_from") or ""
        is_trikona = any(f"{h}th from Lagna" in house_txt for h in (1, 5, 9))
        if is_trikona or (sarva is not None and sarva < 22):
            secondary.append(a)
        elif a.get("severity") in ("critical", "major"):
            secondary.append(a)

    # Tier B — collapsed axis (short body)
    for a in by_key.get("axis", []):
        short = dict(a)
        short["severity"] = "info"
        short["body"] = (
            f"{a.get('sign', '')} — {a.get('house_from', '')}. "
            "Nodal axis themes: ambition, disruption, and karmic release (~18 months per sign)."
        )
        secondary.append(short)

    # Other unclassified — drop from default UI
    primary.sort(key=lambda x: _SEV_ORDER.get(x.get("severity", "info"), 5))
    secondary.sort(key=lambda x: _SEV_ORDER.get(x.get("severity", "info"), 5))

    return primary[:max_primary], secondary


def filter_forecast_events(
    events: list[dict],
    natal_positions: dict[str, float],
    natal_lagna_rasi_idx: int,
    *,
    max_rows: int = 15,
) -> list[dict]:
    """Keep impactful forecast rows only."""
    if not events:
        return []

    from agent.calculator import RASI_NAMES

    natal_moon_sign = int(natal_positions["Moon"] / 30) % 12
    natal_lagna_sign = natal_lagna_rasi_idx
    moon_name = RASI_NAMES[natal_moon_sign]
    lagna_name = RASI_NAMES[natal_lagna_sign]

    kept: list[dict] = []
    for ev in events:
        planet = ev.get("planet", "")
        quality = ev.get("quality", "info")
        typ = ev.get("type", "")
        detail = ev.get("detail", "")

        if "Double Transit" in typ or "⚡" in typ:
            kept.append(ev)
            continue

        if planet == "Saturn":
            kept.append(ev)
            continue

        if planet == "Jupiter":
            if quality in ("critical", "major", "positive"):
                kept.append(ev)
                continue
            # Ingress onto natal Moon or Lagna sign
            for name in (moon_name, lagna_name):
                if f"→ {name}" in typ or f"→ {name}" in typ:
                    kept.append(ev)
                    break
            else:
                if any(f"{h}th from Lagna" in detail for h in ("1", "5", "9")):
                    kept.append(ev)
            continue

        if planet == "Rahu":
            for name in (moon_name, lagna_name):
                if f"→ {name}" in typ or f"/ Ketu →" in typ and name in typ:
                    kept.append(ev)
                    break
            continue

        if quality in ("critical", "major"):
            kept.append(ev)

    return kept[:max_rows]


def _transit_aspects_sign(planet: str, p_sign: int, target: int) -> bool:
    aspected = {p_sign, (p_sign + 6) % 12}
    if planet == "Jupiter":
        aspected |= {(p_sign + 4) % 12, (p_sign + 8) % 12}
    elif planet == "Saturn":
        aspected |= {(p_sign + 2) % 12, (p_sign + 9) % 12}
    elif planet == "Mars":
        aspected |= {(p_sign + 3) % 12, (p_sign + 7) % 12}
    elif planet in ("Rahu", "Ketu"):
        aspected |= {(p_sign + 4) % 12, (p_sign + 8) % 12}
    return target in aspected


def compute_dial_alerts(
    transit_positions: dict[str, float],
    natal_positions: dict[str, float],
    lagna_rasi_idx: int,
    *,
    life_events: bool = False,
    min_score: int = 70,
    max_show: int = 8,
) -> tuple[dict[str, Any], int]:
    """
    Build and filter Time Dial banner alerts.
    Returns ({top, categories, alerts}, raw_count).
    Each alert: {level, color, text, sub, score, category}.
    """
    moon_sign = int(natal_positions["Moon"] / 30) % 12
    sun_sign = int(natal_positions["Sun"] / 30) % 12
    ven_sign = int(natal_positions["Venus"] / 30) % 12
    jup_natal_sign = int(natal_positions["Jupiter"] / 30) % 12
    lagna_sign = lagna_rasi_idx
    house7 = (lagna_sign + 6) % 12
    house5 = (lagna_sign + 4) % 12

    sat_sign = int(transit_positions["Saturn"] / 30) % 12
    jup_sign = int(transit_positions["Jupiter"] / 30) % 12
    rah_sign = int(transit_positions["Rahu"] / 30) % 12
    ket_sign = int(transit_positions["Ketu"] / 30) % 12

    raw: list[dict] = []

    def add(level: str, color: str, text: str, sub: str, group: str, *, heuristic: bool = False):
        raw.append({
            "level": level,
            "color": color,
            "text": text,
            "sub": sub,
            "group": group,
            "heuristic": heuristic,
        })

    # Double transit — Moon & Lagna always; 7th/5th only with life_events
    dt_targets = [
        (moon_sign, "Moon", None, False),
        (lagna_sign, "Lagna", None, False),
        (house7, "7th House", "💍 Marriage window", True),
        (house5, "5th House", "👶 Childbirth window", True),
    ]
    for ref_sign, ref_label, life_event, heuristic in dt_targets:
        if heuristic and not life_events:
            continue
        if _transit_aspects_sign("Jupiter", jup_sign, ref_sign) and _transit_aspects_sign(
            "Saturn", sat_sign, ref_sign
        ):
            label = (
                f"⚡ Double Transit — {ref_label} {life_event}"
                if life_event
                else f"⚡ Double Transit — {ref_label}"
            )
            add(
                "critical",
                "#ef4444",
                label,
                f"Jupiter + Saturn aspecting natal {ref_label}",
                f"double:{ref_sign}",
                heuristic=bool(life_event),
            )

    if life_events:
        jup_house = ((jup_sign - lagna_sign) % 12) + 1
        if jup_house == 7:
            add("positive", "#a78bfa", "💍 Jupiter 7th — Marriage Activation",
                "Guru transiting partnerships", "life:marriage", heuristic=True)
        if jup_sign == ven_sign:
            add("positive", "#f472b6", "💍 Jupiter over natal Venus",
                "Guru blessing marriage karaka", "life:marriage", heuristic=True)
        elif _transit_aspects_sign("Jupiter", jup_sign, ven_sign):
            add("positive", "#f472b6", "💍 Jupiter aspects natal Venus",
                "Guru aspecting relationships", "life:marriage", heuristic=True)
        sat_house = ((sat_sign - lagna_sign) % 12) + 1
        if sat_house == 7:
            add("major", "#c4b5fd", "💍 Saturn 7th — Relationship Crystallisation",
                "Serious commitments or delays", "life:marriage", heuristic=True)
        if rah_sign == house7 or ket_sign == house7:
            add("major", "#c4b5fd", "💍 Nodes on 7th — Karmic Union",
                "Partnership house activated", "life:marriage", heuristic=True)
        if jup_house == 5:
            add("positive", "#34d399", "👶 Jupiter 5th — Childbirth Activation",
                "Putra Bhava", "life:child", heuristic=True)
        if jup_sign == jup_natal_sign:
            add("positive", "#34d399", "👶 Jupiter over natal Jupiter",
                "Guru return", "life:child", heuristic=True)

    sade_off = (sat_sign - moon_sign) % 12
    if sade_off == 0:
        add("critical", "#ef4444", "🪐 Sade Sati — Peak", "Saturn in 1st from natal Moon", "sade")
    elif sade_off == 11:
        add("major", "#f97316", "🪐 Sade Sati — Rising", "Saturn in 12th from natal Moon", "sade")
    elif sade_off == 1:
        add("major", "#f97316", "🪐 Sade Sati — Setting", "Saturn in 2nd from natal Moon", "sade")

    if (sat_sign - moon_sign) % 12 == 7:
        add("major", "#f97316", "🪐 Ashtama Shani", "Saturn 8th from natal Moon", "ashtama")

    kant_off = (sat_sign - lagna_sign) % 12
    if kant_off in (0, 3, 6, 9) and sade_off not in (0, 1, 11):
        add("major", "#f97316", f"🪐 Kantaka Shani ({kant_off + 1}th)",
            "Saturn in kendra from Lagna", "kantaka")

    node_count = 0
    for n_sign, n_label in ((moon_sign, "Moon"), (lagna_sign, "Lagna"), (sun_sign, "Sun")):
        if node_count >= 2:
            break
        if rah_sign == n_sign:
            add("major", "#f97316", f"☊ Rahu over natal {n_label}",
                "Eclipse-axis on sensitive point", f"node:rahu:{n_label}")
            node_count += 1
        if node_count >= 2:
            break
        if ket_sign == n_sign:
            add("major", "#f97316", f"☋ Ketu over natal {n_label}",
                "Eclipse-axis on sensitive point", f"node:ketu:{n_label}")
            node_count += 1

    raw_count = len(raw)
    filtered = _score_and_filter_dial(raw, min_score=min_score, max_show=max_show)
    organized = organize_dial_banner(filtered)
    organized["alerts"] = filtered
    return organized, raw_count


def _score_and_filter_dial(
    raw: list[dict],
    *,
    min_score: int,
    max_show: int,
) -> list[dict]:
    seen_groups: set[str] = set()
    family_count: dict[str, int] = {}
    scored: list[tuple[int, dict]] = []

    has_sade = any(r["group"] == "sade" for r in raw)

    for r in raw:
        if r.get("heuristic"):
            continue

        g = r["group"]
        if g == "kantaka" and has_sade:
            continue
        if g in seen_groups and g.startswith(("double:", "sade", "ashtama")):
            continue

        score = _DIAL_SEV_SCORE.get(r["level"], 0)
        if "double:" in g:
            score += 35
        if g in _DIAL_TIER_A_GROUPS:
            score += 20
            fam = g
        elif g == "kantaka":
            score += 20
            fam = "saturn"
        elif g.startswith("node:"):
            score += 20
            fam = "node"
        else:
            fam = g.split(":")[0]

        family_count[fam] = family_count.get(fam, 0) + 1
        if family_count[fam] > 1:
            score -= 15 * (family_count[fam] - 1)

        if g not in _DIAL_TIER_A_GROUPS and score < min_score:
            continue

        seen_groups.add(g)
        out = {k: r[k] for k in ("level", "color", "text", "sub") if k in r}
        out["score"] = score
        out["category"] = _dial_category(g, heuristic=bool(r.get("heuristic")))
        scored.append((score, out))

    if life_events_raw := [r for r in raw if r.get("heuristic")]:
        for r in life_events_raw[:2]:
            score = _DIAL_SEV_SCORE.get(r["level"], 10) + 10
            if score >= min_score - 20:
                out = {k: r[k] for k in ("level", "color", "text", "sub") if k in r}
                out["score"] = score
                out["category"] = _dial_category(r["group"], heuristic=True)
                scored.append((score, out))

    scored.sort(key=lambda x: (-x[0], x[1]["level"]))
    return [a for _, a in scored[:max_show]]