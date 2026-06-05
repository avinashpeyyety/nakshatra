"""Offline geocoding tests."""

import pytest

from agent.geocode import (
    _parse_coordinates,
    allow_online_geocode,
    geocode_place,
    offline_mode,
    search_places,
)


def test_offline_mode_default():
    assert offline_mode() is True
    assert allow_online_geocode() is False


def test_parse_coordinates():
    assert _parse_coordinates("17.6936, 83.2921") == (17.6936, 83.2921)
    assert _parse_coordinates("28.61 77.20") == (28.61, 77.20)


def test_geocode_visakhapatnam_offline():
    lat, lon = geocode_place("visakhapatnam")
    assert 17.0 < lat < 18.0
    assert 82.0 < lon < 84.0


def test_geocode_alias_vizag():
    lat, lon = geocode_place("vizag")
    assert 17.0 < lat < 18.0


def test_geocode_coordinates():
    lat, lon = geocode_place("17.69, 83.29")
    assert abs(lat - 17.69) < 0.01
    assert abs(lon - 83.29) < 0.01


def test_geocode_unknown_offline_raises():
    with pytest.raises(ValueError, match="offline"):
        geocode_place("xyznonexistentcity12345")


def test_search_places():
    results = search_places("mum")
    assert results
    assert any("Mumbai" in r["label"] for r in results)


def test_geocode_worldwide_paris():
    lat, lon = geocode_place("Paris, France")
    assert 48.0 < lat < 49.0
    assert 2.0 < lon < 3.0


def test_search_london():
    results = search_places("london")
    assert results
    assert any("London" in r["label"] for r in results)


def test_catalog_is_worldwide():
    from agent.geocode import catalog_stats

    stats = catalog_stats()
    assert stats["version"] == 2
    assert stats["count"] > 50000