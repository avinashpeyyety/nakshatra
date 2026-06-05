# Nakshatra Chakram — Development Roadmap

Living document for prioritized improvements and new features. Update checkboxes and the refinement log as work progresses.

**Repository:** [github.com/avinashpeyyety/nakshatra](https://github.com/avinashpeyyety/nakshatra) (public)

**Commercial strategy:** [SHIP_STRATEGY.md](SHIP_STRATEGY.md) — pricing, GTM, overhead, launch checklist.

**Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) — **Chart** ships; **Jobs & Agents** tab is admin-only (`NAKSHATRA_ADMIN=1`).

---

## Git workflow

| Branch / tag | Purpose |
|--------------|---------|
| `main` | Stable releases only |
| `develop` | Active development (default working branch) |
| `v1.0.0`, `v1.1.0`, … | Immutable snapshots; checkout anytime |

```bash
cd "/Users/avinashpeyyety/Library/CloudStorage/OneDrive-Personal/AI Projects/nakshatra_chakram"
git checkout develop          # daily work
git add . && git commit -m "…"
git push

# Release
git checkout main && git merge develop
git tag -a v1.1.0 -m "…"
git push && git push origin v1.1.0
git checkout develop
```

**Never commit:** `.env`, `credentials/token.json`, `agent/data/jobs.db`, watch profile, email settings, geocode cache.

---

## Status legend

| Mark | Meaning |
|------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done (note release tag in refinement log) |
| `[—]` | Deferred / explicitly skipped |

---

## Release targets

| Version | Theme | Target items |
|---------|--------|----------------|
| **v1.0.0** | Baseline | ✅ Shipped — initial app + local/GitHub setup |
| **v1.1.0** | Trust foundation | P0.1 – P0.4 |
| **v1.2.0** | Practitioner usability | P1.1 – P1.5 |
| **v1.3.0** | AI + monitoring polish | P3.1 – P3.3 |
| **v1.4.0** | AI + profiles | P3.4 – P3.5 |
| **v2.0.0** | Deeper Jyotish engine | Selected P2.x (not all at once) |

---

## Tier 0 — Trust & maintainability (do first)

Unlocks safe iteration on all other work. **Target: v1.1.0**

| ID | Item | Why | Effort | Status |
|----|------|-----|--------|--------|
| P0.1 | Golden-chart test suite (5–10 charts vs Jagannatha Hora / Parashara’s Light) | Calculation trust; regression safety | Medium | [ ] |
| P0.2 | UI labels for approximations (Chara dasha, Shadbala Kalabala, transit durations) | Sets correct expectations | Small | [ ] |
| P0.3 | Pre-commit hook (block secrets + `jobs.db` + geocode cache) | Prevents accidental leaks | Small | [ ] |
| P0.4 | Split `calculator.py` into modules (`vargas`, `dasha`, `gochara`, `strength`, `nakshatra_table`) | Maintainability | Medium | [ ] |

---

## Tier 1 — Quick wins (high value, low effort)

**Target: v1.2.0**

| ID | Item | Why | Effort | Status |
|----|------|-----|--------|--------|
| P1.1 | Divisional chart summary tab (planet × key vargas; optional “all vargas”) | Data exists; needs visible UI | Medium | [ ] |
| P1.2 | Compare two saved charts (transits, dasha, nakshatra diff) | Uses chart library | Medium | [ ] |
| P1.3 | Birth-time uncertainty (±range → Lagna / Moon nakshatra stability) | Critical near cusps | Medium | [ ] |
| P1.4 | Offline place picker (Indian cities JSON + Nominatim fallback) | Reduces network dependency | Medium | [x] |
| P1.5 | Export PDF / print layout (wheel + nakshatra table) | Practitioner sharing | Small–Med | [ ] |
| P1.6 | Transit filter (Time Dial + Gochara): Tier A/B/C, banner cap, shared `transit_filter.py` — see [TRANSIT_FILTER_PLAN.md](TRANSIT_FILTER_PLAN.md) | Dial shows too many overlapping events | Medium | [x] |

---

## Tier 2 — Core astrology depth (differentiator)

**Target: v2.0.0** (pick 2–3 items per cycle; do not batch all)

| ID | Item | Why | Effort | Status |
|----|------|-----|--------|--------|
| P2.1 | Expand yoga engine (Vesi/Vosi, Sakata, Vish, Lakshmi, etc.; cancellation flags) | User expectations vs ~13 yogas today | Med–Large | [ ] |
| P2.2 | Jaimini Chara dasha v2 (sub-periods, AK/co-lord, Scorpio/Aquarius rules) | README notes current gaps | Large | [ ] |
| P2.3 | Shadbala refinement (sunrise Kalabala, drik bala, classical thresholds) | Currently approximated | Large | [ ] |
| P2.4 | Vimshottari sub-period UI (deeper timeline / Sookshma) | Data partially exists | Medium | [ ] |
| P2.5 | Tara / nakshatra compatibility matrix | Fits product name & wheel UX | Medium | [ ] |
| P2.6 | Optional Bhava Chalit (Sripati / cusp-based) | Whole-sign only today | Large | [ ] |

---

## Tier 3 — Product & AI

| ID | Item | Why | Effort | Status | Release |
|----|------|-----|--------|--------|---------|
| P3.1 | Chart Advisor presets (D9 marriage, D10 career, dasha+transit, Sade Sati) | One-click use of existing tools | Small | [ ] | v1.3.0 |
| P3.2 | Advisor “sources” panel (show tool-fetched facts) | Auditable interpretations | Medium | [ ] | v1.3.0 |
| P3.3 | Smarter gochara alerts (SAV, active dasha lord, Moon sign) | Better `gochara_scan` signal | Medium | [ ] | v1.3.0 |
| P3.4 | Panchanga panel (tithi, vara, yoga, karana) | Natural ephemeris extension | Medium | [ ] | v1.4.0 |
| P3.5 | Multi-profile dashboard (family charts + ingress timeline) | Watch profile + library | Med–Large | [ ] | v1.4.0 |

---

## Tier 4 — UI / wheel polish

| ID | Item | Why | Effort | Status |
|----|------|-----|--------|--------|
| P4.1 | Split `index.html` into JS modules (no npm required) | ~3,600 lines monolith | Medium | [ ] |
| P4.2 | Wheel interactions (click nakshatra → table; highlight dasha lord) | Hero feature UX | Small–Med | [ ] |
| P4.3 | South Indian Rasi chart view | Expected by many users | Medium | [ ] |
| P4.4 | Wheel animation performance (throttle / static mobile mode) | Time dial + transits | Small | [ ] |

---

## Tier 5 — Platform & defer

| ID | Item | When |
|----|------|------|
| P5.1 | GitHub Actions CI (`pytest` on push) | After P0.1 golden tests |
| P5.2 | Automation agent expansion (Gmail/Calendar/Office) | After astrology core trusted |
| P5.3 | Cursor MCP launcher polish | Power users only |
| P5.4 | Extra ayanamsa modes (Fagan-Bradley, etc.) | Low demand |
| P5.5 | Signed macOS app / installer | After v2.0 stability |

---

## Explicitly out of scope (for now)

- Additional LLM providers (xAI / OpenAI / Anthropic already covered)
- React frontend rewrite
- Cloud-hosted chart database (conflicts with local-first privacy)
- More Office automation before core Jyotish depth

---

## Suggested sprint order

**Next sprint (on `develop`):** P0.1 → P0.3 → P1.1 → P1.3 → merge to `main` as **v1.1.0** when Tier 0 is done.

```text
2026-Q2  Tier 0 (trust)     → v1.1.0
2026-Q2  Tier 1 (usability) → v1.2.0
2026-Q3  Tier 3 (AI/alerts) → v1.3.0 – v1.4.0
2026-Q4  Tier 2 (depth)     → v2.0.0 (incremental)
         Tier 4 (wheel UI)  → parallel as capacity allows
```

---

## Progress summary

| Tier | Done | In progress | Total |
|------|------|-------------|-------|
| 0 | 0 | 0 | 4 |
| 1 | 0 | 0 | 6 |
| 2 | 0 | 0 | 6 |
| 3 | 0 | 0 | 5 |
| 4 | 0 | 0 | 4 |
| 5 | 0 | 0 | 5 |

*Update counts when checkboxes change.*

---

## Refinement log

Append dated notes when priorities shift, items ship, or scope changes.

| Date | Change |
|------|--------|
| 2026-06-04 | Initial roadmap published. Baseline v1.0.0 on `main`; development on `develop`. Next focus: Tier 0 then P1.1 / P1.3. |
| 2026-06-04 | [ARCHITECTURE.md](ARCHITECTURE.md): Jobs & Agents tab admin-only; product = Chart surface only. |
| 2026-06-04 | [TRANSIT_FILTER_PLAN.md](TRANSIT_FILTER_PLAN.md): retain impactful transits (P1.6). |
| 2026-06-04 | P1.6 shipped: `transit_filter.py`, Gochara filter, forecast cap, Time Dial API + banner cap + life-events toggle. |
| 2026-06-04 | P1.4 + fully local geocode: `agent/geocode.py`, `places.json`, offline default, `/api/places` autocomplete. |

---

## How to refine this doc

1. Edit checkboxes (`[ ]` → `[~]` → `[x]`) in the tables above.
2. Add a row to **Refinement log** with date + rationale.
3. Bump **Progress summary** counts.
4. Commit on `develop`: `docs: update ROADMAP progress for P0.1`
5. When a release ships, tag on `main` and note the tag in the log.

---

*Last updated: 2026-06-04*