# Transit Dial & Gochara — Filter Plan (Impactful Events Only)

Analysis of why the **Time Dial** and **Gochara** surfaces show too many transit events, and a plan to keep the most meaningful ones for mass-market users.

**Code today:**
- Time Dial alerts: `computeTransitAlerts()` in `agent/static/index.html` (~lines 3057–3185)
- Gochara tab: `get_current_transits()` in `agent/calculator.py` (~1590–1835)
- Long-range list: `get_dasha_transit_forecast()` in `calculator.py` (~1394–1534), rendered in Gochara HTML via `server._render_gochara`

*Last updated: 2026-06-04*

---

## 1. Problem summary

When scrubbing the Time Dial (or viewing Gochara), users see a **long, repetitive banner** and many overlapping “events.” That happens because:

| Source | Behavior | Noise driver |
|--------|----------|--------------|
| **Time Dial** `computeTransitAlerts` | Recomputes on every date; **all** matches appended to banner | 15–25+ distinct alert strings possible per date |
| **Gochara** `get_current_transits` | Static “today” cards + forecast table | 8–15+ cards today; **every** Jup/Sat/Rahu **ingress** over ~20 years in forecast |
| **Banner UI** `updateTransitBanner` | Joins **every** alert with ` · ` | No cap, no grouping |
| **Wheel glow** `drawWheelAlertGlow` | Picks 1 challenge + 1 positive | OK visually; banner is the real clutter |

### Typical overlap examples (same Saturn position)

- **Sade Sati** (12th/1st/2nd from Moon)  
- **Ashtama Shani** (8th from Moon) — *only when offset = 7, but often confused with Sade*  
- **Kantaka Shani** (kendra from Lagna) — *often true simultaneously with Peak Sade if Moon in kendra*  
- **Double transit** on Moon **and** Lagna **and** 7th **and** 5th — up to **4 separate critical lines** for one sky configuration  

### “Life event” sprawl (Time Dial only)

Marriage and childbirth heuristics add **many positive/major** lines that are *astrologically plausible* but not *universally* significant:

- Jupiter 7th, Jupiter on Venus, Jupiter aspects Venus, Saturn 7th, nodes on 7th  
- Jupiter 5th, Jupiter on natal Jupiter, Jupiter aspects Jupiter, Jupiter 5th from Moon  

Most dates with favorable Jupiter will trigger **2–4** of these at once.

### Forecast table sprawl (Gochara tab)

`get_dasha_transit_forecast` emits **every sign ingress** for Jupiter (~every 1 yr), Saturn (~every 2.5 yr), and Rahu (~every 1.5 yr) across current + next Mahadasha (~15–40+ rows). Many are `moderate` or `info` — correct ephemeris, low user value.

---

## 2. Design principles for filtering

1. **One sky, one story** — Merge alerts that share the same root cause (e.g. one Saturn sign → one primary label + optional sub-bullets).  
2. **Classical > heuristic** — Prefer Parashari staples (Sade Sati, Ashtama, Double Transit, nodes on luminaries) over derived “marriage activation” combos unless user opts in.  
3. **Cap the banner** — Time Dial shows **top 3** by default; expand for detail.  
4. **Separate “now” vs “calendar”** — **Active** transits (ongoing) vs **upcoming** (dated ingresses); don’t mix 20-year ingress list with today’s banner.  
5. **Severity floor for dial scrub** — While dragging the dial, only show **critical + major** (hide positive fluff unless “Life events” toggle on).  
6. **Honest dedup** — Same `type` text already deduped in dial; extend to semantic groups (e.g. “Saturn pressure” bucket).

---

## 3. Retention tiers (what to keep)

### Tier A — Always retain (show prominently)

*These define the product’s transit credibility.*

| ID | Event | Source | Why |
|----|-------|--------|-----|
| A1 | **Sade Sati** (Rising / Peak / Setting) | Sat from Moon | Universal, long-cycle, high anxiety/interest |
| A2 | **Ashtama Shani** (8th from Moon) | Sat from Moon | Distinct from Sade; don’t merge away |
| A3 | **Double Transit** (Jup + Sat aspect Moon **or** Lagna) | Both | Primary timing technique; **one row per reference max** |
| A4 | **Kantaka Shani** (Sat in 1/4/7/10 from Lagna) | Sat from Lagna | Only if **not** already showing A1 peak on same Saturn (merge copy, one card) |
| A5 | **Rahu or Ketu conjunct natal Moon, Sun, or Lagna** | Node = sensitive | Eclipse-axis; **max 1 alert per node** (prefer Moon > Lagna > Sun) |
| A6 | **Saturn or Jupiter sign ingress** affecting **natal Moon or Lagna** house (1st) | Forecast + optional dial | Ingress *onto* sensitive sign, not every ingress |

### Tier B — Retain collapsed (secondary / expandable)

| ID | Event | Default UI |
|----|-------|------------|
| B1 | **Jupiter transit house** (1/5/9 from Lagna) | One card: “Guru {house} from Lagna” — hide 2/3/6/8/12 unless Sarva &lt; 22 |
| B2 | **Rahu/Ketu axis** house from Lagna | Fold into B1 area as single `info` line, not standalone essay |
| B3 | **Double Transit on 7th / 5th** (life-event refs) | **Off by default**; enable “Marriage & children hints” toggle |
| B4 | **Marriage heuristics** (Jup 7th, Jup–Venus, Sat 7th, nodes 7th) | Tier B toggle only; max **1** positive + **1** major when toggle on |
| B5 | **Childbirth heuristics** (Jup 5th, Jup return, etc.) | Same toggle; max **1** positive when toggle on |

### Tier C — Drop from default UI (archive / advanced)

| ID | Event | Action |
|----|-------|--------|
| C1 | Every Jup/Sat/Rahu ingress in forecast | Keep in data; **filter to** A6 + A3 windows + Sade phase changes only |
| C2 | Duplicate Double Transit lines (4 refs) | Keep Moon + Lagna only in default; 7th/5th behind toggle |
| C3 | “Jupiter {house}th — Auspicious” for trikona when B1 already shown | Dedup |
| C4 | Moderate/info forecast rows without house impact | Hide unless “Show all ingresses” |
| C5 | Rahu/Ketu axis long interpretive card (Gochara #7) | Replace with 2-line summary |

---

## 4. Target UX after filter

### Time Dial banner (scrubbing)

```text
Default (max 3 chips):
  🔴 Sade Sati — Peak · Saturn in Capricorn (~2.1 yrs left)
  🔴 Double Transit — natal Moon
  🟠 Ashtama Shani

  [ +2 more ]  → expands list
```

- **Play mode:** update at most every 600ms already; keep severity filter so play doesn’t flash 10 marriage lines.  
- **Wheel glow:** unchanged (1 challenge + 1 positive ring).  
- **Planet list:** unchanged (always useful).

### Gochara tab

| Section | Content |
|---------|---------|
| **Now** | Tier A only (≤6 cards), sorted critical → major |
| **Ongoing** | Tier B collapsed (Jupiter house, nodes axis summary) |
| **Upcoming** (5 yr) | Filtered forecast: Double windows, Sade phase change, ingress onto Moon/Lagna, Sat/Jup to kendra — **≤12 rows** |
| **Full ephemeris** (optional) | Link “Show all ingresses (advanced)” → current full table |

### Dasha forecast table

Reduce ~30–40 rows to **~8–15** by:

- Jupiter ingress: only if house from Lagna ∈ {1,5,9} or aspects Moon/Lagna (double transit precursor)  
- Saturn ingress: always (Sade phase label); merge Kantaka into same row  
- Rahu: ingress only when Rahu or Ketu hits Moon/Lagna sign (conjunction), not every 18-month move  

---

## 5. Scoring model (implementation-ready)

Assign each candidate alert a **score**; show if `score >= threshold` (dial: 70; gochara today: 50; forecast: 60).

| Factor | Points |
|--------|--------|
| severity `critical` | +40 |
| severity `major` | +25 |
| severity `positive` | +10 (dial: ignore unless life-events toggle +20) |
| Planet Saturn or nodes on Moon/Lagna | +20 |
| Double Transit | +35 |
| Duplicate of already-shown Saturn story | −30 |
| Heuristic marriage/child (no toggle) | −50 (exclude) |
| 4th+ alert same planet family | −15 each |

**Semantic merge key examples:**

- `saturn_story:{sat_sign}:{natal_moon_sign}` → one card  
- `double_transit:{ref_sign}` → one card  
- `node_conjunct:{node}:{sensitive}` → one card  

---

## 6. Implementation plan (phased)

Align with [ROADMAP.md](ROADMAP.md); suggest **v1.2.x** after Tier 0 trust.

### Phase 1 — Quick UX wins (1–2 days)

| Task | File |
|------|------|
| Cap banner to 3 + “+N more” expander | `index.html` `updateTransitBanner` |
| Dial: `computeTransitAlerts` return scored list; default `minScore=70` | `index.html` |
| Dedup Saturn: if Sade Sati active, suppress separate Kantaka unless different house narrative | `index.html` |
| Default double transit: Moon + Lagna only | `index.html` |

### Phase 2 — Shared filter module (2–3 days)

| Task | File |
|------|------|
| New `agent/transit_filter.py` — `score_alert()`, `merge_saturn_alerts()`, `filter_forecast_events()` | new |
| Wire `get_current_transits` through filter before return | `calculator.py` |
| Wire `_render_gochara` forecast through `filter_forecast_events` | `server.py` |
| Unit tests: given fixed positions, assert ≤6 alerts and expected Tier A ids | `tests/test_transit_filter.py` |

### Phase 3 — Product polish (1–2 days)

| Task | File |
|------|------|
| Toggle: “Life event hints (marriage / children)” | `index.html` + localStorage |
| Gochara “Advanced → all ingresses” collapsible | `server.py` HTML |
| ROADMAP item **P1.6** — document in refinement log | `ROADMAP.md` |

### Phase 4 — Optional depth

- Sarva bindu modifier (downgrade Jupiter if sign bindus &lt; 22)  
- Mahadasha context: boost events when transiting planet = current MD lord  
- Push filtered “next 90 days” iCal-style list (no email infra)

---

## 7. Keep / drop matrix (Time Dial `computeTransitAlerts`)

| Current alert | Default after filter |
|---------------|----------------------|
| Double Transit — Moon | **Keep** |
| Double Transit — Lagna | **Keep** |
| Double Transit — 7th / 5th | Toggle only |
| Jupiter 7th marriage | Toggle only |
| Jupiter over/aspect Venus | Toggle only (max 1) |
| Saturn 7th | Toggle only |
| Nodes on 7th | Toggle only |
| Jupiter 5th / over natal Jupiter / 5th from Moon | Toggle only (max 1) |
| Sade Sati (3 phases) | **Keep** (one) |
| Ashtama Shani | **Keep** |
| Kantaka Shani | **Merge** with Sade if same Saturn sign |
| Rahu/Ketu over Moon/Lagna/Sun | **Keep** Moon; Lagna if no node alert yet; drop Sun unless alone |
| Jupiter 1st/9th trikona | **Drop** if Jupiter house card exists in Gochara; else B1 |

---

## 8. Keep / drop matrix (Gochara `get_current_transits`)

| Current block | Default after filter |
|---------------|----------------------|
| Sade Sati | **Keep** |
| Ashtama Shani | **Keep** if not redundant with Sade copy |
| Kantaka Shani | **Merge** into Saturn section |
| Jupiter transit house (always) | **Keep** as single B1 card |
| Double Transit (×2 refs) | **Keep** max 2 |
| Rahu/Ketu over Moon/Lagna/Sun (up to 6) | **Keep** max 2 (Moon priority) |
| Rahu/Ketu axis info (always) | **Collapse** to 2 lines |
| Forecast: all ingresses | **Filter** per Phase 2 rules |

---

## 9. Success metrics

| Metric | Before (est.) | Target |
|--------|---------------|--------|
| Dial alerts per random date | 12–22 | ≤5 default, ≤8 expanded |
| Gochara cards (today) | 8–15 | ≤6 |
| Forecast rows | 25–45 | 8–15 |
| User comprehension (informal) | “Wall of text” | “3 things matter now” |

---

## 10. ROADMAP hook

Add to Tier 1 (v1.2.0):

| ID | Item |
|----|------|
| **P1.6** | Transit filter: Tier A/B/C, dial banner cap, shared `transit_filter.py` |

---

## 11. Refinement log

| Date | Change |
|------|--------|
| 2026-06-04 | Initial analysis and retention plan from Time Dial + Gochara + forecast code review. |
| 2026-06-04 | Phases 1–2 implemented: `transit_filter.py`, `POST /transit_dial_alerts`, Gochara primary/secondary, forecast filter, dial banner cap (3 + expand), life-events toggle. |

---

## Summary

**Keep:** Sade Sati, Ashtama Shani, Double Transit (Moon/Lagna), nodal hits on Moon/Lagna, and a **short** upcoming list (ingresses that touch sensitive points + double windows).  

**Collapse:** Saturn overlaps, ever-present Jupiter house prose, Rahu/Ketu axis essay.  

**Toggle:** Marriage/children heuristics and 7th/5th double transits.  

**Drop from default:** Raw ingress firehose in forecast and duplicate positive “activation” lines on every dial scrub.

Implement **Phase 1** first for immediate relief; **Phase 2** centralizes logic so Gochara and Time Dial stay consistent.