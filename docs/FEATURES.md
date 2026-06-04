# Nakshatra Chakram — features

Local-first Vedic birth chart app. **Chart edition** (public installers): Wheel, Dasha, Yogas, Gochara only.

## Quick reference

| Tab | Purpose |
|-----|---------|
| **Wheel** | Birth chart + interactive nakshatra wheel |
| **Dasha** | Vimshottari and Jaimini period timelines |
| **Yogas** | Classical yoga detection and notes |
| **Gochara** | Transits and alerts for the active chart |

## Wheel

- Swiss Ephemeris sidereal longitudes (default **Lahiri**; Raman, Krishnamurti optional)
- Nakshatra wheel: lagna at top, planets by longitude
- Retrograde and dignity indicators
- Offline place lookup (bundled city catalog)
- Multiple named charts, stored on disk

## Dasha

- **Vimshottari:** Maha / Antar / Pratyantar, balance at birth, past and upcoming periods
- **Jaimini Chara:** sign-based periods from lagna

## Yogas

- Automatic detection (e.g. Gajakeshari, Pancha Mahapurusha variants, Kemadruma, Neecha Bhanga Raja, Parivartana, and others)
- Short interpretations in the Yogas tab

## Gochara

- Live planetary positions and ranked transit alerts
- Context for saved chart: Sade Sati, sign changes, major aspects
- Dasha-period notes (Jupiter / Saturn / Rahu ingresses, double-transit windows)

## Privacy

- No signup or license server
- No central chart database; data stays on your computer
- macOS: `~/Library/Application Support/Nakshatra Chakram/`
- App listens on `127.0.0.1:8765` (installed build)

## Requirements

| Platform | Notes |
|----------|--------|
| **macOS** | Python **3.10+** required; first launch creates local venv |
| **Windows** | Standalone `.exe`; no separate Python |

## Not in public installers

Jobs, Agents, scheduler, and admin tooling — development builds only (`NAKSHATRA_ADMIN=1`).

---

[Download](https://avinashpeyyety.github.io/nakshatra-chakram-releases/#downloads) · [Landing page](https://avinashpeyyety.github.io/nakshatra-chakram-releases/) · [Issues](https://github.com/avinashpeyyety/nakshatra-chakram-releases/issues)