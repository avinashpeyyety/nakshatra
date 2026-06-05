# Ship Strategy — Mass Market, Minimal Overhead

Strategy for launching **Nakshatra Chakram** with the smallest sustainable operating footprint. Two viable paths:

| Path | Model | Revenue |
|------|--------|---------|
| **A — Commercial** | Low-price subscription (Plus tier) | Stripe MRR |
| **B — FOSS** | Free & open source; **donations optional** | GitHub Sponsors, Ko-fi, etc. |
| **C — Private source** | Public installers + landing page; **no signups/trials** | Donations optional |

You can run **A only**, **B only**, **C only**, or **A + B** (open-core). **Path C** is documented in **[PUBLIC_RELEASE.md](PUBLIC_RELEASE.md)** (`scripts/package_desktop.sh`, `docs/` site). Pick one primary path for Year 1 to avoid split focus.

**Companion docs:** [ROADMAP.md](ROADMAP.md) (what to build) · [README.md](README.md) (what exists today)

*Last updated: 2026-06-04*

---

## 1. Strategic intent (shared)

| Goal | Choice |
|------|--------|
| **Market** | Mass market — curious learners, diaspora users, hobbyists, not elite consulting clients |
| **Overhead** | Least possible — no sales team, no custom charts-by-hand, no 24/7 support, no heavy infra |
| **Moat** | Nakshatra-first UX + tool-grounded AI + privacy (charts stay local) |
| **Non-goals (Year 1)** | Enterprise contracts, white-label, phone support, multi-language before PMF |

**Path A positioning:**  
*“Private Vedic birth chart and nakshatra wheel — serious calculations, no cloud chart storage, price of a coffee.”*

**Path B positioning:**  
*“Free, open Vedic nakshatra software you run yourself — community-supported, no paywall.”*

---

## 2. Path comparison — which to choose?

| Dimension | **A — Commercial** | **B — FOSS + donations** |
|-----------|-------------------|---------------------------|
| User cost | $3.99/mo or $29/yr (Plus) | $0 forever |
| Your revenue | Predictable MRR | Sporadic tips; “buy me a coffee” |
| Infrastructure | License API + Stripe | Static site + GitHub Releases only |
| AI advisor | You pay API; cap per subscriber | **User brings own API key (BYOK)** |
| Support expectation | Slightly higher | Community / GitHub Issues |
| Growth | SEO + conversion funnel | GitHub stars, distros, word of mouth |
| Legal | Terms, refunds, Stripe Tax | LICENSE + CLA optional; no refunds |
| Best if you want | Sustainable solo income | Maximum reach + ethos + contributors |

**Hybrid (later):** Open-source core (`calculator`, wheel UI) under AGPL-3.0; keep `chart_advisor` + hosted jobs as proprietary or paid plugin. Document clearly in repo root.

---

# Path A — Commercial (low-price subscription)

*Sections 3–12 below describe Path A unless labeled otherwise.*

---

## 3. Product shape for low overhead (Path A)

Ship **one** primary experience; defer everything that multiplies support and ops.

### What to sell (v1 commercial)

| Include | Defer / admin-only |
|---------|-------------------|
| Local/desktop or PWA app with full calculator + wheel | **Jobs & Agents tab** (scheduler, watch profile, advisor chat) — see [ARCHITECTURE.md](ARCHITECTURE.md); `NAKSHATRA_ADMIN=1` dev only |
| Free: D1 wheel, nakshatra table, 1 saved chart | Automation agent (Gmail/Calendar/Office) in consumer SKU |
| Paid: all vargas, dasha timelines, exports, 10+ saved charts | Unlimited AI chat on free tier |
| Paid: Chart-tab AI (BYOK) with **monthly cap** when shipped | Admin chart advisor UI as product surface |
| Optional: email transit digests (user SMTP) | Native iOS/Android store apps (Phase 2) |

**Technical delivery with minimal ops:**

1. **Phase A — Local paid unlock (lowest overhead)**  
   - Same FastAPI app; license key file or simple online activation.  
   - No server-side chart storage.  
   - You host: license API + static download page only.

2. **Phase B — Hosted PWA (still low overhead)**  
   - Single small VPS or serverless: auth + license + static frontend.  
   - Calculations still run **in browser** (WASM Swiss Ephemeris) or on server **stateless** per request — no chart DB.

3. **Avoid until revenue justifies cost**  
   - Multi-tenant chart cloud  
   - Built-in SMS  
   - Human chart reading marketplace  
   - App Store 15–30% fee on primary channel (use web/direct first)

---

## 4. Pricing — mass market, inexpensive (Path A)

Price for **volume and trust**, not maximum extraction. Anchor against AstroSage premium / Cosmic Insights (~$10–30/mo), but undercut with a simpler, privacy-first offer.

### Recommended tiers (USD; adjust for INR/EUR PPP later)

| Tier | Price | Purpose |
|------|-------|---------|
| **Free** | $0 | Acquisition; word of mouth |
| **Plus** | **$3.99/mo** or **$29/yr** | Core revenue — “less than one café coffee” |
| **Family** (optional) | **$5.99/mo** | 3 profiles — upsell without new product |

**Free tier (generous enough to spread):**

- Unlimited basic chart calculate (rate-limit IP only if abused)
- Nakshatra wheel + table
- 1 saved chart
- Vimshottari dasha summary (current period only)
- No AI advisor (or 3 messages/month as teaser)

**Plus tier:**

- Unlimited saved charts
- Full vargas, Shadbala, Ashtakavarga, yogas, gochara alerts UI
- Full dasha timelines + exports (JSON/SVG/PDF when shipped)
- AI advisor: **50 messages/month** (hard cap; prevents API bankruptcy)
- Priority: new features from [ROADMAP.md](ROADMAP.md) Tier 1–2

**Why not cheaper than $3.99?** Payment fees (~2.9% + $0.30) and tax/VAT complexity eat margins below ~$3. **Why not higher for v1?** Mass market needs low friction; raise price after retention proof.

### Annual discount

Push **$29/yr** (~39% off monthly) to reduce churn handling and payment processor per-transaction overhead.

---

# Path B — FOSS & donations only

No subscriptions, no paywalls, no license server. Sustainability = **low burn** + **optional gratitude payments** + **users fund their own AI**.

---

## B1. What “FOSS” means for this project

| Open | Closed / optional |
|------|-------------------|
| `calculator.py` (after P0.4 split), tests, wheel UI | Your private `jobs.db` / user chart data (never in repo) |
| FastAPI server + static `index.html` | Prebuilt API keys, hosted multi-tenant service |
| ROADMAP, docs, export formats | Automation agent (Gmail/Calendar) — optional separate repo or `contrib/` |

**Recommended license:** **AGPL-3.0** (or MPL-2.0 if you want file-level proprietary plugins later).

- **AGPL:** Anyone hosting a modified version must share source — protects nakshatra UX from closed SaaS clones without contributing back.
- **MIT:** Use only if you prioritize maximum adoption over copyleft.

**Swiss Ephemeris:** Keep copyright/attribution in `NOTICE` and About screen (LGPL obligations either way).

**GitHub:** Public repo `avinashpeyyety/nakshatra`. `main` = stable releases; tags `v1.0.0`, …

---

## B2. Feature set — everything free, no “Plus” tier

Ship **one full edition** in the open repo:

- Full 27-nakshatra wheel, table, vargas, dashas, yogas, gochara, Shadbala, Ashtakavarga
- Unlimited saved charts (local SQLite — user’s machine)
- JSON/SVG/PDF exports
- **Chart Advisor (product, planned):** BYOK in **Chart** tab — not the admin Jobs & Agents console
- No shipped scheduler; admin `jobs.py` stack stays out of default builds

**No donation required to unlock features.** Donations are requested, not enforced.

---

## B3. Donations — request, don’t nag

**Tone:** Grateful, rare, skippable — not modal spam every session.

| Placement | Copy (example) |
|-----------|----------------|
| About / Help | “Nakshatra Chakram is free software. If it helps you, consider a donation.” |
| README + website footer | Badges + one link |
| Release notes | Optional thank-you line |

**Channels (pick 1–2; zero monthly fee preferred):**

| Channel | Fee | Overhead |
|---------|-----|----------|
| **GitHub Sponsors** | 0% from individuals (GitHub covers fees) | Lowest; ties to repo |
| **Ko-fi** | ~5% | Simple one-time “coffee” |
| **Buy Me a Coffee** | ~5% | Same |
| **Patreon** | ~8–10% | Only if you add patron-only dev logs |

**Skip for Path B:** Stripe subscriptions, license keys, refund policies, sales tax nexus complexity (donations may still be taxable income — consult accountant once material).

**Realistic expectations:** Donation conversion often **&lt; 0.5%** of active users. Treat as bonus, not salary. Pair with day job or Path A hybrid later.

---

## B4. Cost structure (Path B) — even lower than commercial

| Item | Estimate |
|------|----------|
| Domain + static site | $2–5/mo (GitHub Pages = $0) |
| GitHub public repo | $0 |
| CI (GitHub Actions) | $0 within free minutes |
| LLM API | **$0** — BYOK only |
| Donation processor | % of donations only |
| Support | GitHub Issues + Discussions |

**Target fixed overhead: &lt; $10/mo** (domain only if using Pages).

---

## B5. Go-to-market (Path B)

| Priority | Channel |
|----------|---------|
| 1 | **GitHub README** + demo GIF of wheel |
| 2 | Lists: Awesome-Vedic, self-hosted, privacy tools |
| 3 | r/vedicastrology, r/selfhosted, Hacker News “Show HN” after Tier 0 tests |
| 4 | Packaged releases: `.dmg` / Windows zip / `docker compose` (one command) |
| 5 | Contributors: `good first issue` labels; ROADMAP checkboxes |

**Messaging:** Privacy, auditability, no account, forkable, Swiss Ephemeris — **not** “cheap alternative to AstroSage.”

---

## B6. Sustainability without subscriptions

| Lever | Action |
|-------|--------|
| **BYOK AI** | Never host inference; users pay xAI/OpenAI directly |
| **Community** | Accept PRs for yogas, places JSON, translations |
| **Grants** | NLnet / Sovereign Tech Fund — only if FOSS infra angle (long shot) |
| **Consulting** | Optional paid chart workshops — **off-repo**, not product scope |
| **Path A fork** | If donations &lt; $200/mo for 12 months, ship optional Plus build from same codebase (open-core) |

---

## B7. Path B — launch checklist

- [ ] Choose license (AGPL-3.0 recommended) → add `LICENSE`, `NOTICE` (Swiss Ephemeris)
- [x] Single public repo `avinashpeyyety/nakshatra` (source + installers + Pages)
- [ ] Remove any hardcoded API keys; Settings UI for BYOK
- [ ] Donation links in About + README (GitHub Sponsors + Ko-fi)
- [ ] Tier 0 golden tests (credibility for FOSS adoption)
- [ ] GitHub Releases with signed tags + changelog
- [ ] `CONTRIBUTING.md` + Code of Conduct (lightweight)
- [ ] Disclaimer in app (educational / not professional advice)
- [ ] Issue templates: bug / feature / chart-data-never-uploaded FAQ

---

## B8. Path B — risks

| Risk | Mitigation |
|------|------------|
| No income | Keep burn &lt; $10/mo; BYOK; day job or hybrid Path A |
| Fork without credit | AGPL; trademark “Nakshatra Chakram” in docs |
| Support burden | “Community support”; no SLA |
| API key theft from user machine | Local storage only; warn in SECURITY.md |
| Someone sells hosted clone | AGPL requires their source if they modify + network use |

---

## 9. Cost structure — keep overhead near zero (Path A)

### Fixed monthly baseline (bootstrap)

| Item | Lean estimate | Notes |
|------|----------------|-------|
| Domain + email | $2–5 | One domain, ImprovMX/forwarding |
| Hosting (license + site) | $5–20 | Fly.io / Railway / CF Workers + R2 |
| Stripe | % of revenue only | No monthly minimum |
| LLM API (Plus users) | **Variable — cap per user** | Biggest risk; enforce hard quotas |
| Swiss Ephemeris | $0 | LGPL — comply with license notice |
| Your time | Sweat equity | No employees in Year 1 |

**Target:** Operating cash **&lt; $50/mo** until ~500 paying users, then scale hosting modestly.

### Variable cost guardrails

| Risk | Control |
|------|---------|
| AI API runaway | Per-user monthly token/message cap; cheapest model for “calculation explain”; tools-only for facts |
| Geocoding | Offline city list (ROADMAP P1.4); Nominatim only as fallback |
| Support email | FAQ + in-app help; no phone |
| Refunds | 7-day automatic refund policy via Stripe; no negotiation |
| Fraud | Stripe Radar; block VPN license farming if abuse appears |

### What not to spend on (Year 1)

- Paid ads before retention &gt; 40% at 30 days
- Translators / localization beyond English
- SOC2, HIPAA-style compliance (not your market)
- Full-time support staff
- Apple/Google developer programs until web channel works

---

## 10. Go-to-market — low-touch channels (Path A)

### Channel priority

| Priority | Channel | Why low overhead |
|----------|---------|------------------|
| 1 | **SEO / content** | “Nakshatra calculator”, “Vedic birth chart free”, “27 nakshatras wheel” — evergreen |
| 2 | **YouTube / Shorts** | One wheel animation + “how to read your nakshatra” — reusable |
| 3 | **Reddit / forums** | r/vedicastrology, regional diaspora groups — authentic, no ad spend |
| 4 | **WhatsApp / Telegram share** | Export SVG/image with subtle watermark + link |
| 5 | **Affiliate micro-influencers** | 20% first-year rev share; self-serve coupon codes in Stripe |
| 6 | Paid Meta/Google | Only after CAC &lt; 3× monthly ARPU |

### Launch sequence (90 days)

```text
Week 1–4   Ship trust (ROADMAP Tier 0) + landing page + Stripe checkout
Week 5–8   Free public web demo (rate-limited) + email capture optional
Week 9–12  Plus tier + license activation + 10 beta users (friends/community)
Month 4+   Content SEO + one feature release/month (see ROADMAP releases)
```

### Messaging pillars

1. **Privacy** — “Your birth data never leaves your device” (local SKU) or “We don’t store charts” (stateless web).  
2. **Serious math** — Swiss Ephemeris, not random AI placements.  
3. **Nakshatra-native** — Wheel-first, not generic Western UI bolted on.  
4. **Honest limits** — “Approximate Jaimini” labeled (ROADMAP P0.2) builds trust vs overclaiming.

---

## 11. Monetization mechanics — simplest stack (Path A)

| Function | Tool | Overhead |
|----------|------|----------|
| Payments | **Stripe Checkout** + Customer Portal | Self-serve cancel/upgrade |
| Licenses | Stripe webhook → signed JWT or license key (HMAC) | One small endpoint |
| Downloads | GitHub Releases (private) or R2 bucket | No custom CDN |
| Email receipts | Stripe automatic | None |
| Product email | Buttondown / ConvertKit free tier | Newsletter optional |
| Analytics | Plausible or Umami self-hosted | Privacy-aligned |
| Support | GitHub Discussions or single support@ alias | Async only |

**No custom billing engine. No sales calls.**

### License flow (local app)

```text
User pays (Stripe) → webhook issues license key → user pastes in app → app validates signature offline
```

Renewal: key expiry + optional online refresh every 30 days (grace period 7 days for offline).

---

## 12. Legal & trust — minimum viable compliance (Path A)

| Item | Action |
|------|--------|
| Disclaimer | “For educational / entertainment purposes; not professional advice.” |
| Privacy policy | Short: what you collect (email, payment ID), what you don’t (chart DB) |
| Terms | Auto-renewal, refund window, acceptable use |
| Ephemeris | Swiss Ephemeris copyright notice in About |
| Taxes | Stripe Tax (when volume warrants) or manual threshold monitoring |
| India / EU users | Display price inclusive of GST/VAT when Stripe Tax enabled |

One page each; no lawyer-heavy stack until revenue &gt; $5k/mo.

---

## 13. Build vs buy — roadmap alignment (Path A)

Ship revenue enablers before prestige features.

| Ship for revenue (prioritize) | Build later |
|-------------------------------|-------------|
| ROADMAP P0 (trust) | P5 automation agent in consumer product |
| P1.1 varga tab, P1.5 PDF export | P2.6 Bhava Chalit |
| P3.1 advisor presets + **hard caps** | P3.5 multi-profile dashboard |
| Landing + Stripe | Native mobile apps |
| P1.4 offline places | White-label B2B |

**Rule:** Every release notes one **free** improvement (sharing/SEO) and one **Plus** hook (export, AI quota, saved charts).

---

## 14. Metrics — only what decisions need (Path A)

Track weekly in a spreadsheet (not a $500 analytics suite).

| Metric | Target (first 6 mo) |
|--------|---------------------|
| Free → Plus conversion | 2–5% |
| Monthly churn (Plus) | &lt; 8% |
| CAC (if paid ads) | &lt; $12 |
| ARPU (paid) | ~$3.50 net |
| Support tickets / 100 users | &lt; 2 |
| AI cost / paid user | &lt; $0.80/mo |
| Calculator errors (golden tests) | 0 regressions |

**Kill criteria:** If AI cost &gt; 40% of revenue for 2 months, cut free AI teaser further or raise Plus to $4.99.

---

## 15. Risks & mitigations (Path A)

| Risk | Mitigation |
|------|------------|
| “Another astrology app” | Nakshatra wheel + local privacy + transparent approximations |
| API cost blowout | Hard caps; tool-only advisor; no “unlimited chat” marketing |
| Support overload | Strict scope FAQ; community Discord only after 200+ paid |
| OneDrive/dev friction | GitHub canonical; release builds from CI |
| Competitor free tools | Compete on UX depth + exports + AI grounded in ephemeris |
| Underpricing | Add Family tier and annual plan before raising base |

---

## 16. Three-year path

### Path A — still lean

| Year | Focus | Overhead |
|------|-------|----------|
| **Y1** | Web/local Plus, SEO, English, Stripe only | Solo + contractors optional |
| **Y2** | INR pricing, Android PWA install, 2–3 affiliate partners | Part-time support VA if &gt; 2k paid |
| **Y3** | Optional “Pro” $9.99 for unlimited AI + batch family charts | Still no chart cloud storage |

**Exit of lean mode only when:** MRR &gt; $10k and support load forces a hire — not before.

### Path B — community scale

| Year | Focus | Overhead |
|------|-------|----------|
| **Y1** | Public repo, Tier 0 tests, GitHub Releases, BYOK, Sponsors badge | &lt; $10/mo |
| **Y2** | Contributors, docker image, Show HN / selfhosted lists | Donations + optional consulting |
| **Y3** | Consider open-core hybrid (Path A plugin) only if donations &lt; sustainability target | Still no hosted chart DB |

---

## 17. Decision checklists

### Path A — before first paid user

- [ ] Tier 0 trust (golden tests) — credibility for mass market
- [ ] Disclaimer + privacy + terms pages live
- [ ] Stripe product: Plus monthly + annual
- [ ] License or paywall enforced in app
- [ ] AI monthly cap implemented and tested
- [ ] Free tier clearly labeled; Plus comparison on one screen
- [ ] Refund policy documented
- [ ] One landing page + one demo chart (anonymous)
- [ ] Support@ or GitHub Discussions ready

### Path B — before public FOSS release

See **B7** above (license, public repo, BYOK, donation links, CONTRIBUTING).

---

## 18. Refinement log

| Date | Change |
|------|--------|
| 2026-06-04 | Initial ship strategy: mass market, $3.99/mo Plus, local-first delivery, Stripe-only stack, ROADMAP alignment. |
| 2026-06-04 | Added **Path B — FOSS + donations**: AGPL guidance, BYOK AI, GitHub Sponsors/Ko-fi, full feature set free, launch checklist B7. |

*Update this log when pricing, channels, license, or product scope changes.*

---

## Summary

**Path A (commercial):** Narrow, trustworthy product; **$3.99/mo or $29/yr**; Stripe + license endpoint; capped hosted AI; SEO growth. Trust first ([ROADMAP](ROADMAP.md) v1.1.0) → conversion hooks (v1.2.0) → depth (v2.0.0).

**Path B (FOSS):** Same core quality, **no paywall**; **donations optional** (GitHub Sponsors + Ko-fi); **users bring API keys**; public repo + AGPL; overhead **&lt; $10/mo**. Best for reach and community; pair with Path A later via open-core if donations alone are insufficient.

**Pick one primary path for Year 1**, or open-core after v1.1.0 trust work is done.