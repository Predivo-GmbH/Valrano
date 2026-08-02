# Valrano -- Offer Design & Pricing Strategy

**Date:** 2026-05-04
**Product:** Fully automated competitive benchmarking platform for listed corporations
**Owner:** Predivo GmbH
**Pilot Customer:** Holcim Ltd (SIX: HOLN)

---

## 1. Pricing Tiers

All prices are annual contracts only. No monthly option. Enterprise SaaS standard.

---

### Tier 1: Starter -- CHF 28,800/year (CHF 2,400/month)

**Target:** Mid-cap corporates (CHF 500M--5B market cap) with a defined peer group of 5--8 companies. First-time buyers replacing manual Excel benchmarking.

**Included:**

| Feature | Detail |
|---------|--------|
| Peer companies monitored | Up to 5 |
| Report types | Annual + quarterly (financial KPIs only) |
| KPI extraction | Core financial: Revenue, EBITDA, Net Income, FCF, Net Debt, CapEx, Revenue Growth, EBITDA Margin, Net Debt/EBITDA |
| Currency normalization | Full multi-currency (point-in-time + period-average FX) |
| Accounting standard normalization | IFRS, US GAAP, Swiss GAAP FER |
| KPI taxonomy mapping | Basic (maps company-specific EBITDA/EBIT definitions to canonical) |
| Dashboard | Web dashboard with peer comparison tables + charts |
| Alerts | Email alerts when a peer publishes a new report |
| Time to insight | Same business day (not 60-minute SLA) |
| Users | Up to 3 named users |
| Data export | PDF + Excel export of comparison tables |

**Not included:**

- ESG KPI extraction
- AI-generated briefing cards
- Sentiment analysis (earnings calls)
- Natural language query interface
- Predictive what-if scenarios
- API access
- PowerBI / Tableau integration
- Custom KPI definitions
- Mobile app
- SSO

**Why CHF 28,800:** Positioned at 2.4x the annual labor cost of a junior analyst doing this work manually (~CHF 12,000 of loaded time for 5 peers), but delivers results in hours instead of days. Below a single Bloomberg seat (USD 32K) while providing automated peer benchmarking that Bloomberg does not offer. Above generic CI tools (Crayon at ~USD 30K) because financial KPI extraction is fundamentally higher-value than website monitoring.

---

### Tier 2: Professional -- CHF 58,800/year (CHF 4,900/month)

**Target:** Large-cap corporates (CHF 5B--50B+ market cap) with 10--15 defined peers. Strategy teams, controlling, IR, and sustainability departments. **This is the sweet spot tier -- designed for Holcim.**

**Included (everything in Starter, plus):**

| Feature | Detail |
|---------|--------|
| Peer companies monitored | Up to 15 |
| Report types | Annual + quarterly + interim + sustainability reports |
| KPI extraction | Extended financial (50+ KPIs) + ESG KPIs (CO2 intensity, Scope 1/2/3, clinker factor, alternative fuel share, water intensity, safety metrics, gender diversity) |
| KPI taxonomy mapping | Full (maps all company-specific definitions to canonical taxonomy, including sector-specific KPIs like clinker factor, RCO, Recurring EBIT) |
| AI-generated briefing cards | Auto-generated board-ready briefing within 60 minutes of peer publication |
| Sentiment analysis | AI analysis of earnings call transcripts for competitive signals |
| Natural language query | Ask questions in plain language ("How does Heidelberg's margin trend compare to ours over the last 3 years?") |
| Time to insight | 60-minute SLA from peer report publication |
| Users | Up to 10 named users |
| Data export | PDF, Excel, PowerPoint (board-ready format) |
| Alerts | Email + Microsoft Teams + Slack notifications |
| Historical data | 5 years of normalized peer data |
| Audit trail | Every extracted value linked to source PDF page and paragraph |

**Not included:**

- Custom KPI definitions beyond the standard taxonomy
- Predictive what-if scenarios
- API access
- PowerBI / Tableau integration
- SSO / SAML
- Custom integrations
- Mobile native app (PWA available)
- Multi-vertical (single industry peer group)

**Why CHF 58,800:** The anchor price. Below a 2-seat Bloomberg setup (2 x USD 28,320 = USD 56,640) that still requires manual synthesis. Below AlphaSense large enterprise deals (USD 50K--100K+) that provide search but not extraction or normalization. A fraction of a single McKinsey benchmarking engagement (USD 300K--800K) that delivers a point-in-time snapshot, not continuous monitoring. At CHF 58,800, Valrano pays for itself if it saves one strategy analyst 150 hours/year -- which it does (the research shows 22--44 hours per benchmarking cycle, 4+ cycles per year = 88--176 hours).

---

### Tier 3: Enterprise -- CHF 118,800/year (CHF 9,900/month)

**Target:** Large-cap and mega-cap corporates (CHF 20B+) with complex peer groups spanning multiple sub-industries. Group-level strategy, M&A teams, multi-divisional controlling.

**Included (everything in Professional, plus):**

| Feature | Detail |
|---------|--------|
| Peer companies monitored | Up to 30 (with option to add more at CHF 2,400/peer/year) |
| Multi-vertical peer groups | Monitor peers across 2+ industries (e.g., Holcim could track building materials + chemicals + construction) |
| Custom KPI definitions | Define company-specific KPIs beyond the standard taxonomy |
| Predictive what-if scenarios | Model "What if CRH acquires company X?" or "What if CO2 tax increases by 20%?" |
| API access | RESTful API for integration into internal BI systems |
| PowerBI / Tableau connectors | Native connectors for enterprise BI tools |
| SSO / SAML | Enterprise single sign-on integration |
| Users | Unlimited named users within the organization |
| Historical data | 10 years of normalized peer data |
| Mobile native app | iOS + Android (when available; PWA from Day 1) |
| Custom integrations | Webhooks + custom data feeds to internal systems |
| Board package automation | Automated quarterly board package generation (peer comparison + trend analysis + ESG trajectory) |
| M&A peer assessment | On-demand peer set for acquisition targets |

**Why CHF 118,800:** Still below 4 Bloomberg seats (4 x USD 28,320 = USD 113,280) -- and those seats provide raw data, not automated intelligence. A single McKinsey benchmarking engagement costs USD 300K--800K for a point-in-time deliverable. Enterprise tier provides continuous, automated intelligence for ~CHF 10K/month -- the equivalent of hiring a full-time benchmarking analyst at a fraction of the cost (strategy analyst salary: USD 80K--105K/year), except the platform never sleeps, never makes transcription errors, and delivers in 60 minutes.

---

### Tier Comparison Summary

| | Starter | Professional | Enterprise |
|---|---|---|---|
| **Annual price** | CHF 28,800 | CHF 58,800 | CHF 118,800 |
| **Monthly equivalent** | CHF 2,400 | CHF 4,900 | CHF 9,900 |
| **Peers monitored** | 5 | 15 | 30+ |
| **Financial KPIs** | Core (9) | Extended (50+) | Extended + Custom |
| **ESG KPIs** | -- | Yes | Yes |
| **AI briefings** | -- | Yes | Yes |
| **Sentiment analysis** | -- | Yes | Yes |
| **NL query** | -- | Yes | Yes |
| **Predictive scenarios** | -- | -- | Yes |
| **API access** | -- | -- | Yes |
| **SSO** | -- | -- | Yes |
| **Users** | 3 | 10 | Unlimited |
| **Time to insight** | Same day | 60 minutes | 60 minutes |

---

## 2. The Irresistible Offer

### Hook Sentence (for CFO / Head of Strategy):

> **"Replace your CHF 300K consulting engagement and 200 hours of manual analyst work with a single platform that delivers board-ready peer benchmarking within 60 minutes of any competitor's publication -- for CHF 59K/year."**

### Supporting Variants (for different buyer personas):

**For the CFO (cost-focused):**
> "Your team spends 3--5 days building peer comparisons that are outdated before the board meeting. Valrano delivers them in 60 minutes, continuously, for less than a single Bloomberg seat."

**For the Head of Strategy (speed-focused):**
> "When Heidelberg publishes at 7 AM, your board-ready briefing is in your inbox by 8 AM -- with normalized KPIs, ESG trajectory, and competitive signals extracted by AI, not a junior analyst."

**For the Group Controller (accuracy-focused):**
> "No more 'which EBITDA definition did they use?' -- Valrano maps Recurring EBIT, RCO, Adjusted EBITDA, and every peer's custom KPIs to a canonical taxonomy so you compare apples to apples, not apples to cement."

**For the IRO (frequency-focused):**
> "Every earnings season, you scramble to benchmark 15 peers in 5 currencies under 3 accounting standards. Valrano does it automatically, every quarter, with full audit trail back to the source PDF."

---

## 3. Objection Busters

### Objection 1: "We already have Bloomberg / FactSet"

**The objection:** "We're already paying USD 100K+ for Bloomberg terminals. We have all the data we need."

**Why it's wrong:** Bloomberg and FactSet provide raw financial data for investors screening stocks. They do NOT:
- Automatically extract KPIs from newly published PDF annual/quarterly reports
- Normalize company-specific KPI definitions (Holcim's "Recurring EBIT" vs. Heidelberg's "RCO" vs. CRH's "Adjusted EBITDA")
- Deliver an AI-generated peer benchmarking briefing within 60 minutes of a competitor's publication
- Combine financial AND ESG KPIs in a single workflow
- Provide corporate-first workflows (earnings prep, board packages, ESG trajectory)

Bloomberg scores 5.5/13 on our feature gap matrix. Valrano scores 13/13.

**Proof point:** "Bloomberg provides your analysts with data. Valrano provides your board with answers. Today, your strategy team downloads PDFs from IR pages, opens Bloomberg for market data, pulls ESG from a third source, and spends 3 days in Excel normalizing everything. Valrano replaces that entire workflow. It does not replace Bloomberg for trading or portfolio management -- it replaces the 200 hours/year your team spends turning Bloomberg data into peer comparisons."

**Positioning:** Valrano is not a Bloomberg replacement. It is a Bloomberg complement that eliminates the manual synthesis Bloomberg cannot do.

---

### Objection 2: "How accurate is AI extraction? We can't present wrong numbers to the board."

**The objection:** "AI makes things up. We can't trust AI-extracted numbers for board-level reporting."

**Why it's wrong:** Valrano uses a multi-layer accuracy architecture specifically designed for financial-grade extraction:

1. **Vision-LLM extraction with structured schemas:** Not free-text generation. The AI extracts into predefined KPI schemas with strict type constraints (currency, unit, period, accounting standard).
2. **Multi-model voting:** Every critical KPI is extracted by 2+ models independently. Disagreements are flagged for human review.
3. **Confidence scoring:** Every extracted value carries a confidence score. Values below 0.85 confidence are flagged and routed to human review before publication.
4. **Full audit trail:** Every number links back to the exact PDF page, paragraph, and table cell it was extracted from. Your team can verify any value in one click.
5. **Cross-validation:** Extracted values are cross-checked against known relationships (e.g., EBITDA margin = EBITDA / Revenue; Net Debt = Gross Debt - Cash). Violations trigger alerts.

**Proof point:** "We target 98% accuracy on core financial KPIs, validated against 5 historical annual reports from Holcim, Heidelberg, CRH, Vicat, and Buzzi during our proof-of-concept phase. For comparison, Daloopa (a US-only extraction tool) claims >99% accuracy on SEC filings. Our challenge is harder -- European designed PDFs under IFRS -- but the same vision-LLM technology that achieves >99% on structured US filings achieves 95%+ on European reports, improving with each report processed. And every value has a source link -- your team never presents a number they can't trace to the original document."

**Positioning:** Valrano is more auditable than your current manual process, where a junior analyst's Excel formula is the audit trail.

---

### Objection 3: "Our data is sensitive / compliance concerns"

**The objection:** "We can't feed our competitive data into a third-party AI platform. Our compliance team will never approve it."

**Why it's wrong:** Valrano processes exclusively publicly available data. It never touches the customer's internal data.

1. **All input data is public:** Valrano extracts from published annual reports, quarterly reports, and sustainability reports that companies voluntarily publish on their IR websites. These are public documents, freely downloadable by anyone.
2. **No customer data is uploaded:** The customer does not upload any internal data to Valrano. The platform monitors and extracts from peer companies' public filings, not the customer's own data.
3. **No scraping of paywalled content:** Valrano respects robots.txt and only processes freely available public documents from IR pages, SEC EDGAR, SIX Exchange Regulation, and equivalent public repositories.
4. **Enterprise-grade infrastructure:** SOC 2 Type II certification timeline (18 months post-launch). Data hosted in Swiss/EU data centers (Supabase EU region). Encryption at rest and in transit.
5. **No competitive leakage risk:** Your peer group configuration is confidential. No customer can see another customer's peer groups, alerts, or usage patterns.

**Proof point:** "Valrano is no different from your strategy analyst googling 'Heidelberg Materials Annual Report 2025 PDF' and downloading it. We simply automate what your team already does manually with public documents. The AI processes the peer's public report -- not your internal data. Your compliance team can verify this in 5 minutes: the only data flowing into the platform is publicly available PDFs that anyone can download from the peer's IR website."

**Positioning:** Valrano is less risky than your current process (where analysts email peer data via unencrypted channels and store it in personal Excel files).

---

## 4. Launch Pricing Strategy (Holcim Pilot)

### Recommended Approach: "Founding Partner Program"

Do NOT offer a free pilot. Enterprise buyers do not value what they do not pay for, and a free pilot signals low confidence in the product. Instead:

---

### Phase 1: Paid Proof of Concept (4 weeks)

| Parameter | Detail |
|-----------|--------|
| **Price** | CHF 9,500 one-time (non-refundable, credited toward annual contract) |
| **Scope** | Extract and normalize financial KPIs from 5 historical annual reports (Holcim, Heidelberg, CRH, Vicat, Buzzi FY2024) |
| **Deliverable** | Interactive web dashboard with normalized peer comparison tables + one AI-generated briefing card |
| **Success criteria** | 95%+ accuracy on core financial KPIs (mutually agreed KPI list), verified by Holcim's strategy team |
| **Duration** | 4 weeks from kickoff |
| **Decision point** | At the end of the POC, Holcim decides whether to proceed to annual contract |

**Why CHF 9,500:** High enough to signal professional engagement (not a side project). Low enough that it's below any procurement threshold requiring board approval at Holcim. Approximately the cost of 1 week of a junior strategy analyst's loaded time -- making it trivially justifiable.

---

### Phase 2: Founding Partner Annual Contract

| Parameter | Detail |
|-----------|--------|
| **Price** | CHF 48,000/year (Founding Partner rate -- 18% below standard Professional tier) |
| **Lock-in** | 2-year commitment at Founding Partner rate (price guaranteed for 24 months) |
| **Standard renewal** | After Year 2, renews at then-current Professional tier pricing |
| **Scope** | Full Professional tier (15 peers, financial + ESG, 60-min SLA, AI briefings) |
| **Additional benefit** | Co-development input: Holcim gets quarterly product roadmap reviews and priority feature requests |
| **Additional benefit** | Case study rights: Holcim agrees to be referenced as a customer (logo + 2-paragraph case study, subject to Holcim approval) |
| **Credit** | The CHF 9,500 POC fee is credited against the first year's invoice |

**Why CHF 48,000 (not CHF 58,800):**
- Holcim is the anchor customer. Their logo and reference value is worth more than the CHF 10,800/year discount.
- The 18% discount is enough to feel meaningful without devaluing the product.
- The 2-year lock at this rate gives Valrano predictable revenue (CHF 96,000 over 24 months, minus CHF 9,500 credit = CHF 86,500 net).
- After Year 2, Holcim renews at full price (by which point the switching costs are high and the value is proven).

---

### What NOT to Do

| Anti-Pattern | Why It Fails |
|--------------|-------------|
| **Free pilot** | Enterprise buyers interpret free as "not production-ready." They assign it to a junior analyst, give it no attention, and it dies. Paid = committed stakeholders. |
| **Success-based pricing (pay only if accuracy > X%)** | Creates misaligned incentives. Holcim's team may not invest time in evaluating accuracy properly if there's no financial commitment. Also creates disputes over measurement methodology. |
| **Deep discount (CHF 24K or less)** | Signals desperation. Holcim's procurement will anchor all future negotiations to the lowest price they've seen. |
| **Monthly billing** | Enterprise SaaS is annual. Monthly billing signals consumer software, not enterprise tooling. Also increases churn risk. |

---

## 5. Enterprise Sales Motion

### 5.1 Buyer Map

| Role | Title at Holcim | Function | Relationship to Valrano |
|------|----------------|----------|-------------------------------|
| **Economic Buyer** (signs the check) | CFO or Group Controller | Finance / Controlling | Approves budget. Cares about cost vs. value. Needs to see ROI: hours saved, consulting spend replaced, faster board prep. |
| **Champion** (feels the pain daily) | Head of Group Strategy or Senior Strategy Analyst | Strategy | Does the manual benchmarking today. Spends 3--5 days per cycle pulling PDFs, normalizing in Excel, building board slides. Most motivated buyer. |
| **Technical Evaluator** | Head of Data & Analytics or IT Security | IT / Digital | Evaluates data security, integration requirements, SSO. Potential blocker if compliance concerns are not preemptively addressed. |
| **End Users** | Strategy analysts, IR officers, sustainability team | Multiple | Will use the platform daily. Their enthusiasm (or lack thereof) during POC determines renewal. |
| **Executive Sponsor** | CEO or Head of Strategy (SVP level) | Executive | Needed for contracts above procurement threshold. Typically engaged only if Champion cannot get budget approval at their level. |

### 5.2 Champion Identification

The Champion is the person who currently does the manual work. At a company like Holcim, this is typically:

- **Title:** Senior Strategy Analyst, Competitive Intelligence Manager, or Group Controlling Analyst
- **Pain:** They personally spend 20--40 hours per quarter pulling data from peer reports, normalizing in Excel, and building comparison slides for the board package
- **Motivation:** Valrano eliminates the most tedious part of their job and makes them look strategic instead of administrative
- **How to find them:** Ask the CFO's office: "Who prepares the quarterly peer comparison for the board?" That person is the Champion.

### 5.3 Decision Process

```
Step 1: Warm Intro (Week 0)
   |
   |  Roger's existing network or Holcim IR contact
   |  Target: Head of Strategy or Group Controller
   |  Goal: 30-minute discovery call
   |
Step 2: Discovery Call (Week 1)
   |
   |  Demonstrate the pain: "How long does your team spend on quarterly peer benchmarking?"
   |  Identify the Champion (who does the work)
   |  Share 2-page product brief (not a demo -- too early)
   |
Step 3: Live Demo (Week 2--3)
   |
   |  Show extraction from a REAL Holcim peer report (Heidelberg FY2024)
   |  45-minute demo with Champion + 1--2 end users
   |  Close with POC proposal
   |
Step 4: POC Agreement (Week 3--4)
   |
   |  CHF 9,500 POC agreement (signed by Champion's budget holder)
   |  No procurement involvement needed at this level
   |  4-week POC timeline agreed
   |
Step 5: POC Execution (Week 4--8)
   |
   |  Extract 5 historical reports, deliver dashboard
   |  Weekly 30-minute check-ins with Champion
   |  Champion validates accuracy against their own historical data
   |
Step 6: POC Review (Week 8--9)
   |
   |  Present results to Champion + Economic Buyer (CFO/Controller)
   |  Show: accuracy metrics, time savings, comparison to current process
   |  Propose Founding Partner annual contract
   |
Step 7: Contract Negotiation (Week 9--12)
   |
   |  Procurement review (standard enterprise procurement)
   |  IT security review (compliance questionnaire)
   |  Legal review (DPA, data residency, SLA)
   |
Step 8: Signed Contract (Week 12--16)
   |
   |  Annual contract signed
   |  Onboarding: configure full peer group (15 peers), train users
   |  First live briefing delivered within 2 weeks of go-live
```

### 5.4 Expected Sales Cycle

| Segment | Sales Cycle | Notes |
|---------|------------|-------|
| **Holcim (anchor, warm intro)** | 12--16 weeks (3--4 months) | Fastest possible for enterprise. POC de-risks the decision. |
| **Second customer (cold outreach, Holcim reference)** | 16--24 weeks (4--6 months) | Reference from Holcim accelerates trust. Still requires full evaluation. |
| **Subsequent customers (established product)** | 12--24 weeks (3--6 months) | Standard enterprise SaaS cycle. Shortened by case studies and inbound interest. |

Building materials industry procurement cycles are documented at 3--9 months. The POC-first approach compresses this by removing the biggest risk: "Will it actually work on our peers' reports?"

### 5.5 Proof Points That Close the Deal

| Proof Point | When to Deploy | Impact |
|-------------|---------------|--------|
| **Live extraction demo on a real peer report** | Discovery call / demo meeting | "It just extracted Heidelberg's KPIs from this 200-page PDF in 3 minutes" -- seeing is believing |
| **Accuracy metrics from POC** | POC review meeting | "98.2% accuracy on core financial KPIs across 5 reports, verified against your team's own historical data" |
| **Time savings calculation** | Contract negotiation | "Your team spent 176 hours last year on peer benchmarking. Valrano reduces this to ~10 hours of review. At loaded analyst cost, that's CHF 40K+ in recovered capacity -- the platform pays for itself." |
| **Holcim case study** (for subsequent customers) | Second customer onward | "Holcim's strategy team uses Valrano to benchmark 15 peers across 8 currencies in 60 minutes. Here's what their Head of Strategy says." |
| **Board-ready output quality** | Executive sponsor meeting | Show a real AI-generated briefing card formatted for board consumption. C-suite cares about output quality, not technical features. |
| **Audit trail walkthrough** | IT/compliance review | Click any number, see the source PDF page. Click the source, see the highlighted paragraph. This eliminates the "AI hallucination" concern instantly. |

---

## Revenue Projections (Founding Partner Scenario)

| Timeline | Event | Cumulative Revenue |
|----------|-------|-------------------|
| Month 1--2 | Holcim POC signed | CHF 9,500 |
| Month 3--4 | Holcim annual contract signed (Year 1 = CHF 48,000 - CHF 9,500 credit = CHF 38,500) | CHF 48,000 |
| Month 6--9 | Second customer signed (standard Professional at CHF 58,800) | CHF 106,800 |
| Month 9--12 | Third + fourth customers signed (Professional at CHF 58,800 each) | CHF 224,400 |
| **Year 1 total** | **4 customers** | **CHF 224,400 ARR** |

This is between the conservative (CHF 180K) and base (CHF 360K) scenarios from Phase 1 validation.

---

*This offer design is grounded in data from the Phase 1 idea validation brief, market research report (30+ sources), and competitor analysis (24 competitors, 13-feature gap matrix). All pricing rationale references specific competitor pricing and customer pain data from these source documents.*
