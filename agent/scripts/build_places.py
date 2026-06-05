#!/usr/bin/env python3
"""
Build agent/data/places.json from GeoNames cities5000 (population >= 5000).

Source: https://www.geonames.org/ (CC BY 4.0) — run manually when updating the catalog.
  curl -o cities5000.zip https://download.geonames.org/export/dump/cities5000.zip
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "agent" / "data" / "_build"
OUT = ROOT / "agent" / "data" / "places.json"
CACHE = ROOT / "agent" / "data" / "geocode_cache.json"

COUNTRY_NAMES: dict[str, str] = {}
ADMIN1_NAMES: dict[str, str] = {}


def normalize(text: str) -> str:
    s = (text or "").strip().lower()
    s = s.replace(",", " ")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def load_country_names() -> None:
    path = BUILD / "countryInfo.txt"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        COUNTRY_NAMES[parts[0]] = parts[4]


def load_admin1_names() -> None:
    path = BUILD / "admin1CodesASCII.txt"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        code, name, _ascii, gid = line.split("\t")[:4]
        ADMIN1_NAMES[code] = name


def country_label(cc: str) -> str:
    return COUNTRY_NAMES.get(cc, cc)


def admin1_label(cc: str, a1: str) -> str:
    if not a1:
        return ""
    return ADMIN1_NAMES.get(f"{cc}.{a1}", a1)


def parse_cities() -> list[dict]:
    rows = []
    for line in (BUILD / "cities5000.txt").read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        p = line.split("\t")
        if len(p) < 19:
            continue
        gid, name, ascii_name = p[0], p[1], p[2] or p[1]
        alts = p[3]
        lat, lon = float(p[4]), float(p[5])
        cc, a1 = p[8], p[10]
        pop = int(p[14] or 0)
        rows.append({
            "id": gid,
            "name": name,
            "ascii": ascii_name,
            "alts": alts,
            "lat": lat,
            "lon": lon,
            "cc": cc,
            "a1": a1,
            "pop": pop,
        })
    return rows


def build() -> dict:
    load_country_names()
    load_admin1_names()
    cities = parse_cities()
    base_counts: dict[str, int] = defaultdict(int)
    for c in cities:
        base_counts[f"{normalize(c['ascii'])}|{c['cc'].lower()}"] += 1

    records: dict[str, dict] = {}
    keys: dict[str, str] = {}
    aliases: dict[str, str] = {}

    def register_key(key: str, gid: str, pop: int) -> None:
        if not key:
            return
        existing = keys.get(key)
        if not existing:
            keys[key] = gid
            return
        if records[existing]["pop"] >= pop:
            aliases[key] = existing
        else:
            aliases[key] = gid
            keys[key] = gid

    for c in sorted(cities, key=lambda x: -x["pop"]):
        gid = c["id"]
        cc = c["cc"]
        cc_l = cc.lower()
        a1 = c["a1"]
        ctry = country_label(cc)
        region = admin1_label(cc, a1)
        parts = [c["ascii"]]
        if region:
            parts.append(region)
        parts.append(ctry)
        display = ", ".join(parts)

        records[gid] = {
            "lat": c["lat"],
            "lon": c["lon"],
            "display": display,
            "pop": c["pop"],
            "cc": cc,
            "name": c["ascii"],
        }

        base = f"{normalize(c['ascii'])}|{cc_l}"
        if base_counts[base] > 1 and a1:
            primary = f"{base}|{a1.lower()}"
        else:
            primary = base
        register_key(primary, gid, c["pop"])
        register_key(f"{normalize(c['name'])}|{cc_l}", gid, c["pop"])

        if c["alts"]:
            for alt in c["alts"].split(","):
                alt = alt.strip()
                if not alt or len(alt) > 80:
                    continue
                ak = f"{normalize(alt)}|{cc_l}"
                if ak != primary:
                    register_key(ak, gid, c["pop"])

    # Merge legacy user cache entries
    if CACHE.exists():
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
        for k, v in cache.items():
            if k in keys:
                continue
            gid = f"cache:{k}"
            records[gid] = {
                "lat": float(v["lat"]),
                "lon": float(v["lon"]),
                "display": v.get("display", k),
                "pop": 0,
                "cc": "",
                "name": k,
            }
            keys[k] = gid

    countries: dict[str, str] = {}
    for cc, name in COUNTRY_NAMES.items():
        countries[normalize(name)] = cc.lower()
        countries[cc.lower()] = cc.lower()

    return {
        "version": 2,
        "meta": {
            "source": "GeoNames cities5000 (population >= 5000)",
            "license": "CC BY 4.0 — https://www.geonames.org",
            "count": len(records),
        },
        "countries": countries,
        "records": records,
        "keys": keys,
        "aliases": aliases,
    }


def main() -> None:
    if not (BUILD / "cities5000.txt").exists():
        raise SystemExit(f"Missing {BUILD / 'cities5000.txt'} — download cities5000.zip first.")
    data = build()
    OUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {data['meta']['count']} places -> {OUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()