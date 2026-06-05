"""
Offline-first geocoding for birth place resolution.

Lookup order:
  1. Direct coordinates (decimal or DMS)
  2. Bundled places catalog (agent/data/places.json, GeoNames cities5000)
  3. Local user cache (agent/data/geocode_cache.json)
  4. Optional online Nominatim (NAKSHATRA_ALLOW_ONLINE_GEOCODE=1 only)
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from agent.data_paths import places_catalog_path, user_data_dir

_PLACES_PATH = places_catalog_path()
_CACHE_PATH = user_data_dir() / "geocode_cache.json"

_catalog_version: int | None = None
_records: dict[str, dict[str, Any]] | None = None
_keys: dict[str, str] | None = None
_alias_index: dict[str, str] | None = None
_places_v1: dict[str, dict[str, Any]] | None = None
_countries: dict[str, str] | None = None
_user_cache: dict[str, dict] | None = None
_user_cache_loaded = False


def allow_online_geocode() -> bool:
    """Online fallback is opt-in; default is fully offline."""
    return os.environ.get("NAKSHATRA_ALLOW_ONLINE_GEOCODE", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def offline_mode() -> bool:
    return not allow_online_geocode()


def _normalize_key(text: str) -> str:
    s = (text or "").strip().lower()
    s = s.replace(",", " ")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _load_user_cache() -> dict[str, dict]:
    global _user_cache, _user_cache_loaded
    if _user_cache_loaded:
        return _user_cache or {}
    _user_cache = {}
    try:
        if _CACHE_PATH.exists():
            _user_cache = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        _user_cache = {}
    _user_cache_loaded = True
    return _user_cache


def _save_user_cache_entry(key: str, lat: float, lon: float, display: str) -> None:
    cache = _load_user_cache()
    cache[key] = {"lat": lat, "lon": lon, "display": display}
    try:
        user_data_dir().mkdir(parents=True, exist_ok=True)
        _CACHE_PATH.write_text(
            json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8"
        )
    except Exception:
        pass


def _load_places_index() -> None:
    global _catalog_version, _records, _keys, _alias_index, _places_v1, _countries
    if _catalog_version is not None:
        return
    _records = {}
    _keys = {}
    _alias_index = {}
    _places_v1 = {}
    _countries = {}
    try:
        raw = json.loads(_PLACES_PATH.read_text(encoding="utf-8"))
        if raw.get("version") == 2:
            _catalog_version = 2
            _records = raw.get("records") or {}
            _keys = raw.get("keys") or {}
            _alias_index = raw.get("aliases") or {}
            _countries = raw.get("countries") or {}
        else:
            _catalog_version = 1
            _places_v1 = raw.get("places") or {}
            _alias_index = raw.get("aliases") or {}
    except Exception:
        _catalog_version = 1


def _country_to_cc(token: str) -> str:
    t = _normalize_key(token)
    if not t:
        return ""
    if len(t) == 2 and t.isalpha():
        return t
    _load_places_index()
    return (_countries or {}).get(t, "")


def _entry_coords(entry: dict) -> tuple[float, float]:
    return float(entry["lat"]), float(entry["lon"])


def _record_for_gid(gid: str) -> dict | None:
    _load_places_index()
    if _catalog_version == 2:
        return (_records or {}).get(gid)
    return (_places_v1 or {}).get(gid)


def _resolve_v2_key(key: str) -> dict | None:
    _load_places_index()
    if not key:
        return None
    gid = (_keys or {}).get(key) or (_alias_index or {}).get(key)
    if gid:
        return _record_for_gid(gid)
    return None


def _resolve_v1_key(key: str) -> dict | None:
    _load_places_index()
    cache = _load_user_cache()
    if key in (_places_v1 or {}):
        return _places_v1[key]
    if key in (_alias_index or {}):
        canon = _alias_index[key]
        if canon in (_places_v1 or {}):
            return _places_v1[canon]
    if key in cache:
        return cache[key]
    return None


def _resolve_key(key: str) -> dict | None:
    _load_places_index()
    if _catalog_version == 2:
        hit = _resolve_v2_key(key)
        if hit:
            return hit
    return _resolve_v1_key(key)


def _best_v2_match(name: str, cc: str = "") -> dict | None:
    """Highest-population record matching city name (and optional country code)."""
    _load_places_index()
    if _catalog_version != 2:
        return None
    cc_l = cc.lower() if cc else ""
    best: tuple[int, dict] | None = None
    for key, gid in (_keys or {}).items():
        parts = key.split("|")
        if not parts or parts[0] != name:
            continue
        if cc_l and (len(parts) < 2 or parts[1] != cc_l):
            continue
        rec = _record_for_gid(gid)
        if not rec:
            continue
        pop = int(rec.get("pop") or 0)
        if best is None or pop > best[0]:
            best = (pop, rec)
    return best[1] if best else None


def _parse_coordinates(place: str) -> tuple[float, float] | None:
    """Accept '17.69, 83.29' or '17.69 83.29' (lat lon)."""
    s = place.strip()
    m = re.match(
        r"^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$",
        s,
    )
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"Coordinates out of range: {lat}, {lon}")
    return lat, lon


def _lookup_offline(place: str) -> tuple[float, float, str] | None:
    key = _normalize_key(place)
    if not key:
        return None

    hit = _resolve_key(key)
    if hit:
        lat, lon = _entry_coords(hit)
        return lat, lon, hit.get("display") or place

    parts = [p.strip() for p in re.split(r"[,;]", place) if p.strip()]
    if len(parts) >= 2:
        city = _normalize_key(parts[0])
        cc = _country_to_cc(parts[-1])
        if city and cc:
            for try_key in (f"{city}|{cc}",):
                hit = _resolve_key(try_key)
                if hit:
                    lat, lon = _entry_coords(hit)
                    return lat, lon, hit.get("display") or place
            hit = _best_v2_match(city, cc)
            if hit:
                lat, lon = _entry_coords(hit)
                return lat, lon, hit.get("display") or place

    for part in parts or [place]:
        part_key = _normalize_key(part)
        if len(part_key) < 3:
            continue
        hit = _resolve_key(part_key)
        if hit:
            lat, lon = _entry_coords(hit)
            return lat, lon, hit.get("display") or place
        hit = _best_v2_match(part_key)
        if hit:
            lat, lon = _entry_coords(hit)
            return lat, lon, hit.get("display") or place

    if _catalog_version == 1:
        for canon, entry in (_places_v1 or {}).items():
            display = (entry.get("display") or "").lower()
            if key in canon or key in display:
                lat, lon = _entry_coords(entry)
                return lat, lon, entry.get("display") or place

    cache = _load_user_cache()
    for k, v in cache.items():
        if key in k or k in key:
            return float(v["lat"]), float(v["lon"]), v.get("display") or place

    return None


def _geocode_nominatim(place: str) -> tuple[float, float]:
    from geopy.geocoders import Nominatim

    geolocator = Nominatim(user_agent="nakshatra_chakram_local_v1", timeout=10)
    location = geolocator.geocode(place)
    if not location:
        raise ValueError(f"Could not find '{place}' via online geocoder.")
    return location.latitude, location.longitude


def geocode_place(place: str) -> tuple[float, float]:
    """Resolve place name or coordinates to (lat, lon). Offline by default."""
    place = (place or "").strip()
    if not place:
        raise ValueError("Birth place is required.")

    coords = _parse_coordinates(place)
    if coords:
        return coords

    found = _lookup_offline(place)
    if found:
        lat, lon, display = found
        _save_user_cache_entry(_normalize_key(place), lat, lon, display)
        return lat, lon

    if allow_online_geocode():
        try:
            lat, lon = _geocode_nominatim(place)
        except Exception as exc:
            raise ValueError(f"Geocoding failed for '{place}': {exc}") from exc
        _save_user_cache_entry(_normalize_key(place), lat, lon, place)
        return lat, lon

    raise ValueError(
        f"Unknown place '{place}' (offline mode). "
        "Pick a city from suggestions, use 'City, Country', or enter coordinates "
        "as 'latitude, longitude' (e.g. 17.69, 83.29). "
        "Set NAKSHATRA_ALLOW_ONLINE_GEOCODE=1 to allow internet lookup."
    )


def search_places(query: str, *, limit: int = 12) -> list[dict[str, Any]]:
    """Return place suggestions for UI autocomplete (offline catalog + cache)."""
    q = _normalize_key(query)
    if not q or len(q) < 2:
        return []

    _load_places_index()
    cache = _load_user_cache()
    seen: set[str] = set()
    results: list[tuple[int, int, dict[str, Any]]] = []

    def _add(score: int, pop: int, label: str, lat: float, lon: float, key: str) -> None:
        if key in seen:
            return
        seen.add(key)
        results.append((score, pop, {
            "key": key,
            "label": label,
            "lat": lat,
            "lon": lon,
        }))

    if _catalog_version == 2:
        for key, gid in (_keys or {}).items():
            name_part = key.split("|")[0]
            display = (_records or {}).get(gid, {}).get("display", "")
            pop = int((_records or {}).get(gid, {}).get("pop") or 0)
            score = 0
            if name_part == q:
                score = 100
            elif name_part.startswith(q):
                score = 90
            elif q in name_part:
                score = 70
            elif q in _normalize_key(display):
                score = 60
            if score:
                rec = _records[gid]
                _add(score, pop, rec.get("display") or display, float(rec["lat"]), float(rec["lon"]), key)

        for alias, gid in (_alias_index or {}).items():
            if alias.startswith(q) or q in alias:
                rec = (_records or {}).get(gid)
                if rec:
                    pop = int(rec.get("pop") or 0)
                    _add(50, pop, rec.get("display", alias), float(rec["lat"]), float(rec["lon"]), alias)
    else:
        for key, entry in (_places_v1 or {}).items():
            display = (entry.get("display") or "").lower()
            score = 0
            if key == q:
                score = 100
            elif key.startswith(q):
                score = 80
            elif q in key or q in display:
                score = 60
            if score:
                _add(score, 0, entry.get("display") or key, float(entry["lat"]), float(entry["lon"]), key)

    for key, entry in cache.items():
        if q in key:
            _add(30, 0, entry.get("display") or key, float(entry["lat"]), float(entry["lon"]), key)

    results.sort(key=lambda x: (-x[0], -x[1], x[2]["label"]))
    return [r[2] for r in results[:limit]]


def catalog_stats() -> dict[str, Any]:
    _load_places_index()
    meta = {}
    if _PLACES_PATH.exists():
        try:
            raw = json.loads(_PLACES_PATH.read_text(encoding="utf-8"))
            meta = raw.get("meta") or {}
        except Exception:
            pass
    count = len(_records or {}) if _catalog_version == 2 else len(_places_v1 or {})
    return {
        "version": _catalog_version or 1,
        "count": count,
        "meta": meta,
    }