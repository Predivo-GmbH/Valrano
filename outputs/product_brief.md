# Product Brief: Valrano

**Date:** 2026-05-04
**Phase:** 2 (Product Brief)
**Owner:** Predivo GmbH
**Based on:** Phase 1 Idea Validation (2026-05-04) + PRD v3 Full Scope
**Founder decisions:** Full Valrano (not Lite), B2B SaaS for listed corporations

---

## 1. App Name

Three options, evaluated against domain availability, value clarity, and brand consistency with the Signal family (SignalScore, SignalForge):

| Option | Domain | Conveys Value? | Signal Family Fit | Notes |
|--------|--------|---------------|-------------------|-------|
| **Valrano** | valrano.com | Yes -- "benchmark" is the exact verb the buyer uses. "Signal" implies actionable intelligence, not raw data. | Strong -- follows the [Noun]Signal pattern. | Working title. Two-word compound is clear but long. |
| **PeerSignal** | peersignal.com | Yes -- "peer" is the word corporate strategy teams use daily ("peer group", "peer comparison"). Slightly more specific than Valrano. | Strong -- same pattern. | Shorter, punchier. Risk: could be confused with P2P/social. |
| **BenchSignal** | benchsignal.com | Moderate -- "bench" alone is ambiguous (bench as in workbench? benchmark?). Requires explanation. | Strong -- same pattern. | Shortest. Less immediately clear to a cold prospect. |

**Recommendation for Roger's decision:** Valrano or PeerSignal. Both work. Valrano is more self-explanatory to a CFO who has never heard of the product. PeerSignal is more distinctive and memorable. Domain availability for all three should be verified before final decision.

---

## 2. One-Line Description

> Valrano automatically extracts financial and ESG KPIs from competitor PDF reports, normalizes them across currencies and accounting standards, and delivers AI-powered peer benchmarking to corporate strategy teams within 60 minutes of any publication.

---

## 3. Specific Target Persona

**Primary buyer and champion:** Head of Group Strategy / Head of Group Controlling at Holcim Ltd.

| Attribute | Detail |
|-----------|--------|
| **Title** | Head of Group Strategy, VP Strategy & Performance Management, or Head of Group Controlling |
| **Reports to** | CFO or CEO |
| **Team size** | 5-15 analysts (strategy analysts, financial controllers, IR associates) |
| **Location** | Holcim HQ, Zug, Switzerland |
| **Daily workflow** | Monitors 15 peer companies across 9 exchanges in 4 currencies. Manually downloads PDF quarterly/annual reports, re-keys numbers into Excel, converts currencies, reconciles KPI definitions (Recurring EBIT vs RCO vs Adjusted EBITDA), builds comparison tables for CFO/board. Repeats every earnings season (4x/year minimum) plus ad-hoc for board prep, M&A analysis, and CEO onboarding packages. |
| **Pain in their words** | "Aggregating data from disparate sources drains analyst hours" (DFIN). "Time-consuming manual research" that takes 3-5 working days per cycle. 64% cite "lack of customization" as primary frustration with current tools (IR Magazine 2025). |
| **Budget authority** | Can approve CHF 50K-100K/year for strategy tools without board approval. Larger amounts require CFO sign-off (which they can champion). |
| **Current tools** | Bloomberg terminal (financial data, not benchmarking-optimized), Excel (manual synthesis), PowerPoint (board decks), possibly AlphaSense (search, not extraction). |

**Secondary users (within the same account):**
- Investor Relations Officer (earnings call prep, analyst question anticipation)
- Sustainability Officer / ESG Lead (CO2 trajectory comparisons, CSRD compliance context)
- Board members (read-only executive briefings)

---

## 4. Core Problem Solved

Corporate strategy and controlling teams at listed companies spend 22-44 hours (3-5 working days) every quarter manually collecting, re-keying, currency-converting, and reconciling financial and ESG data from competitor PDF reports -- and they still end up with incomplete, stale comparisons that arrive too late for management to act on. The fundamental problem is not data availability (all reports are public) but data heterogeneity: every peer publishes at different times, in different formats, using company-specific KPI definitions (Recurring EBIT, RCO, Adjusted EBITDA), in different currencies (CHF, EUR, USD), under different accounting standards (IFRS, US GAAP). No existing tool -- not Bloomberg, not FactSet, not AlphaSense -- automates the full extraction-normalization-comparison workflow for corporates benchmarking against their own competitors. Every current solution was built for investors, not for the companies that actually compete against each other.

---

## 5. Exactly 3 MVP Features

The PRD lists 8 functional areas, 17 AI features, mobile apps, and enterprise integrations. For the first release, exactly three features deliver the core value that makes a Holcim strategy analyst say "I need this":

### Feature 1: Vision-LLM KPI Extraction from PDF Reports

Automatically extract financial KPIs (revenue, EBITDA/adjusted variants, operating profit, net income, free cash flow, net debt, ROIC) and core ESG KPIs (CO2 intensity, clinker factor, alternative fuel share) from published PDF quarterly and annual reports using Claude Vision. Covers the 15-peer pilot group across 4 languages (EN, DE, FR, IT), 4+ currencies, and heterogeneous report layouts.

- Structured output via tool-use schema
- Confidence scores per extracted value
- Human-in-the-loop review queue for confidence below 0.85
- Source page reference for every extracted number (audit trail)

**Why this is MVP-critical:** This is the core technical moat (Gap 2 from Phase 1). Without accurate extraction from European PDFs, there is no product. Everything else depends on this.

### Feature 2: Normalization Engine with KPI Taxonomy Mapping

Normalize all extracted values onto a comparable basis:

- Currency conversion using historical FX rates (point-in-time for balance sheet, period-average for P&L)
- KPI taxonomy mapping: map company-specific definitions (Recurring EBIT, RCO, RCOBD, Adjusted EBITDA) to canonical KPIs
- Restatement awareness (original vs restated values stored in parallel)
- One-off flagging (impairments, restructuring charges, M&A effects)
- Full audit trail per normalized value

**Why this is MVP-critical:** Extraction without normalization is just a pile of incomparable numbers. The normalization engine is the second layer of the moat (Gap 5 from Phase 1) and the reason a CHF 48K-72K price point is justified.

### Feature 3: Web Dashboard with Peer Comparison and Alerting

Browser-based dashboard showing:

- Peer comparison tables and charts (financial + ESG KPIs across all 15 peers)
- Ranking view: Holcim's position in peer group per KPI, with trend arrows
- Drill-down to source: click any number to see the original PDF page
- Configurable peer groups (by geography, business model, size)
- Email alerts on new peer publications and anomalous values
- CSV/Excel export for further analysis

**Why this is MVP-critical:** The extraction and normalization engines are invisible infrastructure. The dashboard is how the buyer experiences the value. A strategy analyst needs to see "Holcim vs 15 peers, normalized, with source references" in their browser to say "I need this." Email alerts ensure the product is pull-and-push, not just a passive dashboard.

### What is explicitly NOT in MVP (see Section 7)

All 14 remaining AI features (sentiment analysis, NL query, predictive scenarios, auto-briefing cards, etc.), mobile app, SSO/SAML, PowerBI/Tableau, native PDF/PowerPoint export, and enterprise API are deferred.

---

## 6. Chosen Tech Stack with Rationale

| Layer | Choice | PRD Suggested | Rationale for Deviation / Confirmation |
|-------|--------|---------------|---------------------------------------|
| **Frontend** | React 19 + Vite 8 + TypeScript + Tailwind 4 | Next.js 15 + Tailwind + shadcn/ui | React 19 + Vite is the proven stack across all 13 Predivo projects. Consistent tooling, proven CI/CD, known performance characteristics. Next.js adds SSR complexity that a B2B dashboard does not need (users are authenticated; no SEO on app pages). |
| **Charts** | Recharts (or Tremor/Nivo -- decide in Sprint 1) | Recharts | Confirmed. Standard React charting. |
| **Backend / API** | Supabase Edge Functions (Deno/TypeScript) | Next.js API Routes + Python services | Edge Functions handle AI extraction orchestration, normalization logic, and webhook endpoints. No need for a separate Python service layer -- Claude API calls work from TypeScript. Eliminates an entire infrastructure layer (Fly.io/Render). |
| **Database** | Supabase (Postgres) + pgvector | Supabase + TimescaleDB | Confirmed. pgvector for future RAG/NL query. TimescaleDB extension can be added later if time-series queries demand it; standard Postgres with proper indexing handles quarterly data at 15-peer scale. |
| **AI / LLM** | Claude Sonnet/Opus via Anthropic API | Claude + GPT-4o fallback | Confirmed. Claude Vision for extraction, Sonnet for routine tasks, Opus for hard cases. GPT-4o fallback is a Phase 2 consideration, not MVP. |
| **Auth** | Supabase Auth (email + magic link) | Supabase Auth + SSO | SSO/SAML deferred to Phase 2. Email auth is sufficient for pilot with 5-15 users at one company. |
| **Hosting / Deploy** | Metanet FTP via GitHub Actions | Vercel | All Predivo projects deploy via GitHub Actions FTP to Metanet hosting. Proven pattern, no vendor lock-in, consistent with existing infrastructure. Vercel adds unnecessary cost and a different deploy paradigm. |
| **Background Jobs** | Supabase pg_net + Edge Functions (chained) | Inngest | pg_net worker chaining is proven in YTMigration (F-039). Eliminates Inngest dependency and cost. Edge Functions handle extraction orchestration with retry logic. |
| **Email** | Metanet SMTP via Edge Function (nodemailer) | Resend | Consistent with all other Predivo projects. No additional vendor. |
| **Observability** | Console logging + Supabase dashboard | Axiom + Sentry | MVP does not need dedicated observability infra. Supabase dashboard + structured logging is sufficient. Sentry can be added in Phase 2. |
| **Mobile** | Deferred (PWA later) | React Native + Expo | Mobile app is out of MVP scope. PWA (add-to-homescreen) is a Phase 2 low-effort option. |

**Key architectural principle:** This stack matches the pattern proven across 13 Predivo projects. No new infrastructure to learn, no new deploy pipelines to build, no new vendor accounts to manage. The only new element is the AI extraction pipeline (Claude Vision calls from Edge Functions), which is a feature, not an infrastructure change.

---

## 7. Explicit Scope Guard: What This Is NOT

Everything below is out of scope for MVP (Phase 1 release). Each item is either deferred to a specific phase or explicitly excluded.

### Deferred to Phase 2 (post-pilot, based on customer feedback)

| Feature | PRD Reference | Why Deferred |
|---------|--------------|-------------|
| SSO / SAML / OIDC (Microsoft Entra ID, Okta) | F8.3 | Pilot has 5-15 users at one company. Email auth is sufficient. SSO is a procurement checkbox, not a pilot requirement. |
| PowerBI / Tableau native integration | F8.4 | Pilot users will use the web dashboard. BI tool integration is an upsell feature for Enterprise tier. |
| Excel plugin for live data | F8.5 | CSV/Excel export covers the MVP need. Live plugin is a Phase 2 convenience feature. |
| REST API for customer's own tools | F8.1 | No external integration needed during pilot. API is an Enterprise tier feature. |
| Webhook endpoints for third-party systems | F8.2 | Same as above. |
| Native PDF report export (corporate design) | F6.3 | Basic CSV/Excel export only in MVP. Formatted PDF reports are Phase 2. |
| PowerPoint export with editable charts | F6.4 | Phase 2. Board deck generation is high-value but not MVP-critical. |
| Embeddable charts (Confluence/SharePoint) | F6.6 | Phase 2. |
| MS Teams / Slack / SMS alerts | F7.4 | Email alerts only in MVP. Multi-channel is Phase 2. |
| Quiet hours and escalation paths | F7.5, F7.6 | Phase 2. |
| Strategic move detection | AI 9.4 | Phase 2. Requires additional extraction logic beyond financial KPIs. |
| Sentiment and tonality analysis | AI 9.3 | Phase 2. High-value but not core benchmarking. |
| Natural language query interface | AI 9.5 | Phase 2. Requires pgvector RAG setup and significant prompt engineering. |
| Predictive scenarios / what-if analysis | AI 9.6 | Phase 2. Requires validated baseline data first. |
| Auto-briefing card generator | AI 9.7 | Phase 2. |
| ESG/CO2 trajectory modeling (predictive) | AI 9.8 | Phase 2. MVP extracts current ESG KPIs but does not model trajectories. |
| Auto-recommended peer groups | AI 9.9 | Phase 2. MVP uses manually configured peer groups. |
| Risk factor extraction | AI 9.10 | Phase 2. |
| Earnings call Q&A anticipation | AI 9.11 | Phase 2. |
| Competitive move timing analysis | AI 9.13 | Phase 2. |
| Discrepancy detection (press release vs full report) | AI 9.14 | Phase 2. |
| Patent and innovation tracking | AI 9.15 | Phase 3 or later. Requires EPO/USPTO integration. |
| Geographic exposure heatmap | AI 9.16 | Phase 2. |
| Capital allocation compass | AI 9.17 | Phase 2. |
| Auto-summarization (earnings call transcripts) | AI 9.2 | Phase 2. Transcript sourcing has copyright concerns (PRD open question 5). |
| Translation layer (cross-language normalization) | AI 9.12 | Partial in MVP (Claude handles multilingual extraction natively). Full translation UI is Phase 2. |
| Multidimensional analysis (region x product x time) | F5.2 | Phase 2. Requires segment-level extraction, not just group-level. |
| Margin waterfall analysis | F5.3 | Phase 2. |
| Like-for-like calculation (organic vs M&A vs FX) | F4.5 | Phase 2. Complex decomposition that needs validated baseline first. |
| Inflation adjustment (IAS 29) | F4.6 | Phase 2. Only relevant for hyperinflation markets (Argentina, Turkey). |
| Adaptive polling (15-min during earnings season) | F1.3 | Phase 2. MVP uses manual upload + scheduled daily checks. |
| Publication calendar with auto-shift detection | F1.6 | Phase 2. |
| Multilingual UI (DE, EN, FR) | NFR | English-only UI in MVP. Multilingual is Phase 2. |
| ISO 27001 / SOC 2 Type II certification | NFR | 18-month timeline per PRD. Not MVP. |

### Deferred to Phase 3+

| Feature | Why |
|---------|-----|
| Mobile app (iOS/Android via React Native) | PWA is the Phase 2 path. Native app is Phase 3 if demand warrants. |
| White-label for consulting firms (PwC/KPMG) | Phase 3+ revenue channel. Requires multi-tenant architecture hardening. |
| Vertical expansion beyond building materials | Phase 3+. MVP proves the engine on one vertical. |
| Historical backfill beyond 4 quarters | Phase 2 adds 8 quarters; Phase 3 adds 5+ years. |

### Genuinely Out of Scope (not deferred -- not planned)

| Feature | Why |
|---------|-----|
| Real-time stock price data | Valrano is about published report KPIs, not market data. Bloomberg/Refinitiv own this. |
| ERP system integration | Out of scope per PRD. |
| Non-public / proprietary data ingestion | Public sources only. Compliance requirement. |
| In-house manual research team | Product is fully automated. Human-in-the-loop is for QA, not research. |
| Trading or portfolio management features | This is a corporate strategy tool, not an investor platform. |

---

## 8. Pricing (Confirmed)

| Tier | Annual Price | Included |
|------|-------------|----------|
| **Starter** | CHF 24,000-36,000/year | 5 peers, quarterly reports, financial KPIs only |
| **Professional** | CHF 48,000-72,000/year | 15 peers, quarterly + annual, financial + ESG KPIs |
| **Enterprise** | CHF 96,000-144,000/year | 25+ peers, all features, custom KPIs, API access |

Pilot target: Professional tier at CHF 48,000-72,000/year with Holcim.

---

## 9. Success Criteria for MVP

| Metric | Target |
|--------|--------|
| Extraction accuracy on core financial KPIs | 95%+ (stretch: 98%) |
| Extraction accuracy on ESG KPIs | 90%+ |
| Number of peers with complete extraction | 15 (full pilot group) |
| Time from PDF upload to normalized dashboard | Under 10 minutes per report |
| Holcim pilot team rating | "Would pay for this" (verbal or written) |
| Build timeline | 6-8 weeks to functional MVP |
| Build cost (infrastructure + API) | Under USD 5,000 |

---

*This product brief strips the PRD's full vision (17 AI features, 8 functional areas, mobile app, enterprise integrations) down to the minimum set that validates the core hypothesis: vision-LLM extraction + normalization + peer comparison dashboard is worth CHF 48K-72K/year to a Holcim strategy team. Everything else is Phase 2+.*
