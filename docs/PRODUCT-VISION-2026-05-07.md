# Valrano — Product Vision & Roadmap

> Created: 2026-05-07
> Status: APPROVED DIRECTION — ready for implementation

---

## 1. Core Value Proposition

Valrano automatically monitors competitor report publications, downloads and analyzes them using AI, normalizes all data to the user's own accounting framework, and delivers a board-ready comparison document — replacing weeks of manual cross-departmental work.

**The core loop:**

```
┌─────────────────────────────────────────────────────────────────┐
│  1. LEARN        User uploads own annual report                 │
│                  → AI builds Accounting Profile                 │
│                  → Normalization rules, KPI definitions,        │
│                     accounting policies auto-extracted           │
├─────────────────────────────────────────────────────────────────┤
│  2. SCHEDULE     User sets up peer group + publication calendar  │
│                  → Expected dates, report types, IR page URLs   │
│                  → AI suggests dates from historical patterns    │
├─────────────────────────────────────────────────────────────────┤
│  3. MONITOR      System watches for new publications            │
│                  → Time-precise cron (2-min hot window)          │
│                  → HEAD checks + HTML scraping + AI parsing      │
├─────────────────────────────────────────────────────────────────┤
│  4. INGEST       Auto-fetch PDF → Extract KPIs (Claude Vision)  │
│                  → Normalize using Accounting Profile            │
│                  → Currency conversion (FX rates)                │
├─────────────────────────────────────────────────────────────────┤
│  5. GENERATE     AI creates comparison document                 │
│                  → Profile-aware normalization                   │
│                  → Structured analysis + narrative               │
│                  → HTML + PDF output                             │
├─────────────────────────────────────────────────────────────────┤
│  6. REVIEW       User reviews, optionally edits                 │
│                  → Approval by responsible person                │
│                  → Delivered to board / stakeholders             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. What Exists Today (Audit 2026-05-07)

| Layer | Status | Details |
|-------|--------|---------|
| Database | 25 tables | Companies, reports, KPIs, publication events, benchmark documents, approval chains, notifications, subscriptions |
| Edge Functions | 20 deployed | Full pipeline: monitor → check → download → extract → normalize → generate → render-pdf → deliver |
| Pages | 24+ routes | Dashboard, Peers, Analytics, Reports, Calendar, Documents, Settings, Auth |
| Hooks | 15+ | Data, calendar, extraction, benchmark, AI suggestions, subscriptions |
| Monitoring | Cron every 2 min | Time-precise windows (6h → 2min hot → 30min → 2h → 12h) |
| Document Gen | Claude Sonnet 4.6 | tool_use structured output → HTML → PDF (Gotenberg/jsPDF) |
| Approval | DB schema ready | approval_chains, approval_steps, approval_comments tables — UI incomplete |
| Billing | Stripe 3-tier | starter / professional / enterprise with AI quota gating |
| Tests | 150+ | Hooks + pages + edge functions |

### What's Missing

| Feature | Gap |
|---------|-----|
| **Accounting Profile** | Does not exist. No way for AI to learn the user's accounting framework. All normalization is currency-only (FX conversion). No accounting policy interpretation. |
| **Dashboard as Command Center** | Shows a peer comparison table. Does NOT show the core workflow: upcoming events, pipeline status, recent documents, AI insights. |
| **AI Assistant** | No conversational AI. No way to ask questions about the data. No proactive insights. |
| **Profile-Aware Normalization** | `normalize-kpis` only does FX conversion. It does NOT adjust for accounting differences (IFRS vs US GAAP, capitalized R&D, lease treatment, EBITDA definition). |
| **Document Quality** | Generated documents use a fixed structure. Not customizable to user's reporting format. No accounting policy footnotes. |

---

## 3. Roadmap: 4 Phases

### Phase 1: Accounting Profile (THE FOUNDATION)

> **This must come first.** Every subsequent feature depends on the AI understanding the user's accounting framework. Without it, normalization is just FX conversion — not real benchmarking.

#### New: `accounting_profiles` table

```sql
CREATE TABLE accounting_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  company_name TEXT NOT NULL,

  -- Auto-detected by AI from uploaded report
  accounting_standard TEXT NOT NULL,         -- 'IFRS', 'US_GAAP', 'Swiss_GAAP_FER', 'HGB', etc.
  accounting_standard_confidence REAL,       -- 0-1

  -- Specific accounting policies (AI-extracted)
  policies JSONB NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "revenue_recognition": { "method": "over_time", "description": "...", "source_page": 42 },
  --   "rd_treatment": { "method": "capitalize", "threshold": "development_phase", "source_page": 55 },
  --   "lease_treatment": { "standard": "IFRS_16", "on_balance_sheet": true, "source_page": 60 },
  --   "ebitda_definition": {
  --     "excludes": ["restructuring", "impairments", "share_based_comp"],
  --     "includes": ["joint_venture_income"],
  --     "source_page": 23
  --   },
  --   "net_debt_definition": {
  --     "includes": ["bank_borrowings", "bonds", "lease_liabilities"],
  --     "excludes": ["pension_obligations"],
  --     "deducts": ["cash", "short_term_investments"],
  --     "source_page": 78
  --   },
  --   "goodwill_treatment": { "method": "impairment_only", "source_page": 65 },
  --   "pension_accounting": { "method": "projected_unit_credit", "source_page": 71 },
  --   "fx_translation": { "method": "closing_rate", "source_page": 44 },
  --   "segment_reporting": { "basis": "geographic", "segments": ["Europe","Americas","Asia-Pacific"] }
  -- }

  -- KPI mapping: how this company calculates each KPI
  kpi_mappings JSONB NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "EBITDA": {
  --     "formula": "operating_profit + depreciation + amortization",
  --     "adjustments": ["exclude restructuring costs", "exclude impairments"],
  --     "label_in_report": "Recurring EBITDA",
  --     "source_page": 23
  --   },
  --   "NET_DEBT": {
  --     "formula": "financial_debt - cash - short_term_investments",
  --     "includes_leases": true,
  --     "label_in_report": "Net financial debt",
  --     "source_page": 78
  --   }
  -- }

  -- Source report reference
  source_report_id UUID REFERENCES reports,
  source_report_title TEXT,

  -- AI model used for extraction
  ai_model TEXT,
  extracted_at TIMESTAMPTZ,

  -- User can manually override any field
  manually_edited BOOLEAN DEFAULT FALSE,
  last_edited_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)  -- One profile per user (for now)
);
```

#### New: `analyze-accounting-profile` edge function

**Input:** User's uploaded annual report (PDF in storage)
**Process:**
1. Load PDF pages (focus on Accounting Policies section, typically pages 40-80)
2. Claude Vision call with structured tool_use:
   - Detect accounting standard (IFRS / US GAAP / Swiss GAAP FER / etc.)
   - Extract specific policies for each accounting area
   - Map KPI definitions to how this company calculates them
   - Extract source page numbers for auditability
3. Insert/update `accounting_profiles` row
4. Return the profile for user review

**AI Prompt Strategy:**
```
You are a financial reporting analyst. Analyze this annual report and extract:

1. The accounting standard used (IFRS, US GAAP, Swiss GAAP FER, HGB, etc.)
2. Specific accounting policies for:
   - Revenue recognition method
   - R&D treatment (capitalize vs expense)
   - Lease accounting (IFRS 16 on-balance-sheet vs operating lease)
   - EBITDA definition (what's included/excluded)
   - Net debt definition (what's included/deducted)
   - Goodwill treatment (amortize vs impairment-only)
   - Pension accounting method
   - FX translation method
   - Segment reporting basis
3. For each KPI in our catalog, how does this company calculate it?
   Include the exact label used in their report and the page number.
```

#### New: Profile-aware normalization in `extract-kpis` and `normalize-kpis`

When extracting KPIs from a competitor's report, the AI receives the user's accounting profile as context:

```
Given the user's accounting profile:
- They define EBITDA as: operating profit + D&A, EXCLUDING restructuring and impairments
- They include lease liabilities in net debt

This competitor (CRH) reports "Adjusted EBITDA" which INCLUDES restructuring costs.
→ Extract the raw value but flag: "Accounting difference: CRH includes restructuring in EBITDA.
   Estimated adjustment: -$X million based on restructuring charges disclosed on p.45"
```

The normalization becomes:
1. **Currency normalization** (existing — FX conversion to CHF)
2. **Accounting normalization** (NEW — adjust for policy differences)
3. **Confidence scoring** (NEW — how confident is the adjustment?)

This adds new fields to `kpi_values`:
```sql
ALTER TABLE kpi_values ADD COLUMN accounting_adjustment REAL;        -- adjustment amount
ALTER TABLE kpi_values ADD COLUMN adjustment_reason TEXT;             -- why it was adjusted
ALTER TABLE kpi_values ADD COLUMN pre_adjustment_value REAL;         -- value before accounting normalization
ALTER TABLE kpi_values ADD COLUMN accounting_confidence REAL;        -- 0-1 confidence in the adjustment
```

#### UI: Accounting Profile Setup (Settings or Onboarding)

**Location:** New tab in Settings → "Accounting Profile" OR first step in onboarding wizard

**Flow:**
1. User uploads their company's annual report (or selects an already-uploaded report)
2. System runs `analyze-accounting-profile`
3. Results displayed in a structured card layout:
   - **Header:** "Your Accounting Framework" + detected standard badge (e.g., "IFRS")
   - **Policy cards:** One card per policy area, each showing:
     - Policy name
     - AI-detected value
     - Source page reference (clickable to PDF viewer)
     - Edit button (user can manually override)
   - **KPI mappings:** Table showing how each KPI is calculated
4. User confirms or edits → Profile saved
5. All future competitor extractions use this profile

**Critical UX principle:** The user should be able to see WHAT the AI detected and WHERE it found it. Source page references build trust.

---

### Phase 2: Dashboard Command Center

> The dashboard must reflect the core workflow, not just show data.

#### New Dashboard Layout (5 sections)

```
┌──────────────────────────────────────────────────────────────┐
│  GREETING + CONTEXT BAR                                       │
│  "Good afternoon · FY 2024 · IFRS · 16 peers"                │
│  [Year selector]                                              │
├──────────────────────────────────────────────────────────────┤
│  METRIC CARDS (4 cards — same as today but updated)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Pipeline │ │ Next     │ │ Documents│ │ Pending  │        │
│  │ Active   │ │ Report   │ │ Ready    │ │ Reviews  │        │
│  │ 2        │ │ CRH      │ │ 4        │ │ 1        │        │
│  │ extract..│ │ in 3d    │ │ this qtr │ │ awaiting │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├──────────────────────────────────────────────────────────────┤
│  UPCOMING PUBLICATIONS (Calendar Timeline — next 30 days)     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ May 12  CRH plc         Q1 2026    ⏱ 3 days        │    │
│  │ May 15  Heidelberg Mat.  Annual     ⏱ 6 days        │    │
│  │ May 22  Holcim           Q1 2026    ⏱ 15 days       │    │
│  │ Jun 01  Buzzi SpA        Annual     ⏱ 25 days       │    │
│  └──────────────────────────────────────────────────────┘    │
│  [View full calendar →]                                       │
├──────────────────────────────────────────────────────────────┤
│  PEER COMPARISON TABLE (existing — already redesigned)        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ (compact, sorted, with signal coloring)              │    │
│  └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  RECENT DOCUMENTS + ACTIVITY (combined)                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 📄 CRH Q1 Benchmark — draft, generated 2h ago       │    │
│  │ 📄 Holcim Annual Benchmark — approved, delivered 1d  │    │
│  │ ⬇ Heidelberg Materials annual report uploaded        │    │
│  └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  AI INSIGHTS (proactive, auto-generated)                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 💡 CRH's EBITDA margin declined 3.8pp YoY — largest │    │
│  │    drop in peer group. Driven by cement pricing.     │    │
│  │ 💡 Holcim's net debt/EBITDA at 1.3x — best in peer  │    │
│  │    group, improved from 1.8x in FY 2023.             │    │
│  │ [Ask AI a question →]                                │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

#### Metric Cards — Updated

| Card | Current | New |
|------|---------|-----|
| Your Position | Static "—" | Percentile position across KPIs (or "Set up profile" CTA) |
| Peers Tracked | "16" | "16 peers · 6 with data" |
| Data Freshness | "1d ago" | **"Next: CRH in 3d"** — shows next upcoming event |
| Pending Reviews | "0" | Documents awaiting review/approval |

#### Upcoming Publications Section (NEW)

A compact timeline showing the next 4-6 publication events:
- Company name + report type + fiscal year
- Countdown ("in 3d", "tomorrow", "due today", "2d overdue")
- Status indicator (scheduled / monitoring / detected / processing)
- Click → goes to Calendar page with that event focused

This is the HEART of the dashboard — it shows what's coming and what needs attention.

---

### Phase 3: AI Assistant

> Not just a chatbot — an analyst embedded in the platform.

#### Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend: Chat Panel (slide-in from right)      │
│  - Persistent across pages                       │
│  - Context-aware (current page + data)           │
│  - Message history per session                   │
│  - Suggested questions                           │
├─────────────────────────────────────────────────┤
│  Edge Function: ai-chat                          │
│  - Receives: message + page_context + user_id    │
│  - Loads: accounting_profile, relevant KPIs,     │
│    companies, reports, documents                 │
│  - Claude call with RAG context                  │
│  - Streaming response                            │
│  - Cites sources (page numbers, report titles)   │
├─────────────────────────────────────────────────┤
│  Context Engine:                                 │
│  - On Dashboard: all KPIs, all companies         │
│  - On Document: that specific document's data    │
│  - On Calendar: publication events               │
│  - On Analytics: trend data                      │
└─────────────────────────────────────────────────┘
```

#### New: `ai-chat` edge function

**Input:** `{ message, page_context, conversation_history[] }`
**Process:**
1. Load user's accounting profile
2. Load relevant data based on page_context:
   - Dashboard → all companies + latest KPIs + upcoming events
   - Document → specific benchmark document content_json
   - Peers → company details + KPI values
3. Build system prompt:
   ```
   You are a financial analyst assistant for Valrano.
   The user's company uses {accounting_standard} with these policies: {policies}.
   You have access to KPI data for {N} peer companies across {M} KPIs.
   Always cite sources (report title, page number) when referencing data.
   If you're unsure about an accounting adjustment, say so explicitly.
   ```
4. Stream Claude response back to client
5. Save conversation turn to `chat_sessions` table (for history)

#### New: `chat_sessions` + `chat_messages` tables

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,  -- auto-generated from first message
  page_context TEXT,  -- which page the chat started from
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',  -- [{report_id, page, text}]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Proactive AI Insights

**New: `generate-insights` edge function** (cron daily or on new data)
- Runs after any benchmark document is generated
- Compares latest KPIs against prior period and peer group
- Identifies: biggest movers, outliers, trend reversals, risk flags
- Stores in `ai_insights` table
- Displayed on dashboard

```sql
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  insight_type TEXT NOT NULL,  -- 'trend_reversal', 'outlier', 'risk_flag', 'opportunity'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_company_id UUID REFERENCES companies,
  related_kpi_code TEXT,
  fiscal_year INTEGER,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Phase 4: Enhanced Document Generation

> With the accounting profile in place, documents become dramatically better.

#### Improvements to `generate-benchmark`

1. **Accounting policy comparison section:**
   ```
   ACCOUNTING DIFFERENCES
   ┌──────────────────────────────────────────────────────────┐
   │ KPI        │ Your Policy       │ CRH Policy       │ Adj │
   ├────────────┼───────────────────┼──────────────────┼─────┤
   │ EBITDA     │ Excl. restructur. │ Incl. restructur.│ -42M│
   │ Net Debt   │ Incl. leases      │ Excl. leases     │+180M│
   │ R&D        │ Capitalize (dev)  │ Expense all      │ +25M│
   └──────────────────────────────────────────────────────────┘
   ```
   The reader immediately sees: "these numbers aren't raw — they've been adjusted to YOUR accounting framework."

2. **Source citations:**
   Every KPI value links to the source page in the competitor's report.
   "Revenue: CHF 31.5B (CRH Annual Report 2024, p.12)"

3. **Confidence indicators:**
   ```
   EBITDA: CHF 6.4B ✅ High confidence (direct extraction)
   Adj. EBITDA: CHF 6.8B ⚠️ Medium (estimated from disclosed adjustments)
   ```

4. **Board-ready PDF template:**
   - Cover page with company logos
   - Executive summary (1 page)
   - Detailed KPI comparison with accounting adjustments
   - Peer ranking tables
   - Risk flags and strategic implications
   - Data quality appendix (sources, confidence levels, FX rates)

---

## 4. Implementation Priority

```
Phase 1: Accounting Profile          ← MUST BE FIRST
├── 1a. accounting_profiles table + migration
├── 1b. analyze-accounting-profile edge function
├── 1c. Profile setup UI (Settings tab)
├── 1d. Modify extract-kpis to use profile context
├── 1e. Modify normalize-kpis for accounting adjustments
├── 1f. Add adjustment fields to kpi_values
└── 1g. Tests (profile extraction, normalization)

Phase 2: Dashboard Command Center    ← HIGH IMPACT, MODERATE EFFORT
├── 2a. Upcoming publications section
├── 2b. Updated metric cards (pipeline status, next report, pending reviews)
├── 2c. Recent documents section
├── 2d. Integrate with existing peer comparison table
└── 2e. Mobile responsive

Phase 3: AI Assistant                ← HIGH VALUE, HIGH EFFORT
├── 3a. chat_sessions + chat_messages tables
├── 3b. ai-chat edge function (with streaming)
├── 3c. Chat panel component (slide-in, persistent)
├── 3d. Context engine (page-aware data loading)
├── 3e. Proactive insights (generate-insights + ai_insights table)
├── 3f. Dashboard insights section
└── 3g. Tier gating (chat quota per plan)

Phase 4: Enhanced Documents          ← BUILDS ON PHASE 1
├── 4a. Accounting comparison section in generated documents
├── 4b. Source citations with page numbers
├── 4c. Confidence indicators per KPI
├── 4d. Board-ready PDF template
├── 4e. Manual edit before approval
└── 4f. Delivery to stakeholders
```

---

## 5. Data Flow After All Phases

```
USER UPLOADS OWN REPORT
         │
         ▼
┌─────────────────────┐
│ analyze-accounting-  │
│ profile              │ → accounting_profiles table
│ (Claude Vision)      │   (standard, policies, KPI mappings)
└─────────────────────┘
         │
         │  Profile created ✓
         │
COMPETITOR PUBLISHES REPORT
         │
         ▼
┌─────────────────────┐
│ monitor-publications │ → detected!
│ (cron */2 * * * *)  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ pipeline-orchestrator│
│  1. download-report  │ → PDF in storage
│  2. extract-kpis     │ → kpi_values (WITH accounting profile context)
│  3. normalize-kpis   │ → FX + accounting normalization
│  4. generate-benchmark│ → benchmark_documents (with adjustments table)
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ User reviews document │
│ (optionally edits)   │
│ → approves           │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ render-benchmark-pdf │ → Board-ready PDF
│ deliver-document     │ → Email to stakeholders
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ generate-insights    │ → ai_insights table
│ (proactive analysis) │   → Dashboard insights cards
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ ai-chat              │ ← User asks questions about the data
│ (grounded in profile │    at any time
│  + all KPI data)     │
└─────────────────────┘
```

---

## 6. Technical Notes

### Accounting Profile — AI Extraction Quality

The accounting profile extraction is the hardest AI task in the system. Key considerations:

1. **Annual reports are 100-300 pages.** The accounting policies section is typically pages 40-80 (Notes to the Financial Statements). We need to identify and extract only the relevant pages to stay within context limits.

2. **Multiple Claude calls:** One pass to find the accounting policies section (page range), then detailed extraction calls for each policy area.

3. **Validation:** After extraction, present results to the user with source page references. The user can verify and override. Over time, the system learns.

4. **Updates:** When the user uploads a new annual report, the profile should be re-analyzed and differences highlighted ("Your R&D treatment changed from capitalize to expense").

### Normalization Quality

Accounting normalization is inherently imperfect. The system must:
- Always show the raw (pre-adjustment) value alongside the normalized value
- Show the adjustment amount and reason
- Show confidence level
- Never hide that an adjustment was made

This transparency is critical for board-level trust.

### AI Assistant — Context Window Management

The chat assistant needs to load relevant data without exceeding context limits:
- Accounting profile: ~2K tokens
- KPI data for 16 companies × 15 KPIs: ~5K tokens
- Specific document content_json: ~3K tokens
- Conversation history: last 10 turns

Total: ~15-20K tokens of context per chat turn — well within limits.

---

## 7. What This Replaces

Today, a typical benchmarking cycle at a mid-size company looks like:

1. **Finance team** manually downloads competitor reports (1-2 hours per competitor × 16 competitors)
2. **Analysts** extract KPIs into Excel (4-8 hours per report)
3. **Multiple departments** contribute their sections (strategy, finance, operations)
4. **Chat/email coordination** to align on methodology
5. **Manual normalization** for currency and accounting differences (often inconsistent)
6. **PowerPoint/Word** document assembled manually
7. **Review cycles** with head of strategy
8. **Final delivery** to board

**Total: 2-4 weeks of cross-departmental work per quarterly cycle.**

Valrano reduces this to: upload your report once → system handles everything → review and approve the generated document.

---

## 8. Scope Boundaries (What We Are NOT Building Now)

- **Team collaboration** (multi-user, roles, in-app chat) — later phase
- **Historical trend analysis** — data accumulates naturally, analytics can be enhanced later
- **Industry-specific templates** — start with one universal format
- **Real-time stock price integration** — not relevant to the core use case
- **Competitor strategy analysis beyond KPIs** — stay focused on quantitative benchmarking
