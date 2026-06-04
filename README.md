# Nakshatra Chakram

**Local-first Vedic (Jyotish) birth chart app** — no signup, charts stay on your machine.

| | |
|---|---|
| **Download** | [Landing page](https://avinashpeyyety.github.io/nakshatra/#downloads) (macOS `.dmg`, Windows `.exe`) |
| **Full docs** | [Site](https://avinashpeyyety.github.io/nakshatra/) · [Feature list (markdown)](docs/FEATURES.md) |
| **Issues** | [Report a bug](https://github.com/avinashpeyyety/nakshatra/issues) (no chart attachments) |

Source for development is maintained in a **private** repository; this repo ships installers and documentation only.

---

## Features at a glance

| Area | What you get |
|------|----------------|
| **Wheel** | Sidereal chart (Swiss Ephemeris, Lahiri ayanamsa); interactive nakshatra wheel; retrograde & dignity cues |
| **Dasha** | Vimshottari (Maha / Antar / Pratyantar) and Jaimini Chara timelines |
| **Yogas** | Auto-detection of major yogas with short interpretations |
| **Gochara** | Current transits, ranked alerts, Sade Sati & sign-change context for your chart |
| **Charts** | Multiple named birth profiles, saved locally |
| **Places** | Offline city catalog (no geocoding API required) |

**Privacy:** no account, no cloud chart database. macOS data: `~/Library/Application Support/Nakshatra Chakram/`.

**Not included in public builds:** Jobs, Agents, or scheduler tabs (admin/dev only).

---

## Download

**[Get the latest installers](https://avinashpeyyety.github.io/nakshatra/#downloads)**

## Install (macOS)

1. Download `nakshatra-chakram-*-macos.dmg` from the landing page.
2. Open the DMG → drag **Nakshatra Chakram** to **Applications** → launch.
3. Requires **Python 3.10+** (python.org or Homebrew; system 3.9 is not enough). First launch installs dependencies (a few minutes).
4. Browser opens at `http://127.0.0.1:8765`. If blocked: **right-click → Open** or **Privacy & Security → Open Anyway**.

## Install (Windows)

1. Download `nakshatra-chakram-*-windows.exe` from the landing page.
2. Run the executable. SmartScreen: **More info → Run anyway**.
3. Browser opens at `http://127.0.0.1:8765`.

## Support

[GitHub Sponsors](https://github.com/sponsors/avinashpeyyety) · [Ko-fi](https://ko-fi.com/avinashpeyyety)

## License

Installers distributed as-is for personal use. Swiss Ephemeris has its own license (see in-app notices).

*Educational software — not professional advice.*