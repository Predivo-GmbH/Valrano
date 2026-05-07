# BenchmarkSignal — Core Feature Plan

**Created:** 2026-05-04
**Last Updated:** 2026-05-07
**Status:** Blocks 1-5 IMPLEMENTED (Sprints 6-8). Phase 1 (Accounting Profile) + Phase 2 (Dashboard Command Center) IMPLEMENTED 2026-05-07. See PRODUCT-VISION-2026-05-07.md for current roadmap.
**Purpose:** Define the full feature set for automated competitive benchmarking with document generation and approval workflow

---

## Vision

When a competitor (e.g., CRH, Heidelberg, Buzzi) publishes their annual or quarterly report, BenchmarkSignal:
1. **Detects** the publication automatically
2. **Downloads** the PDF from the IR page
3. **Extracts** KPIs using Vision-LLM
4. **Normalizes** to CHF using correct FX rates
5. **Generates** a board-ready benchmark document based on Holcim's custom rules
6. **Routes** the document through an approval chain (analyst → manager → senior leadership → C-suite)
7. **Delivers** the final approved document to the designated recipient

---

## What Already Exists (built in Sprints 1-5)

| Component | Status | Notes |
|-----------|--------|-------|
| 16 companies seeded (Holcim + 15 peers) | Done | `companies` table with ticker, exchange, reporting_currency, website_url |
| 15 KPI definitions | Done | Financial (11) + ESG (3) + Operational (1) |
| Manual PDF upload | Done | `upload-report` edge function → Supabase Storage |
| Vision-LLM extraction | Done | `extract-kpis` edge function → Claude Sonnet → `kpi_values` |
| FX normalization | Done | `normalize-kpis` edge function → EUR/USD/GBP → CHF |
| Dashboard peer comparison | Done | Table with signal coloring, tooltips, category tabs |
| Review queue | Done | Low-confidence values (<0.85) with approve action |
| Auth + Stripe billing | Done | 3-tier enterprise pricing, no self-serve |

---

## Feature Blocks to Build

### Block 1: Publication Calendar & Smart Monitoring

**What:** A publication calendar where Holcim's team manages **known competitor publication dates**. The system monitors IR pages on a targeted schedule around those dates — not blind daily scraping.

**Core insight:** Companies know when competitors will publish. Holcim's strategy team knows that CRH publishes annual results in late February, Heidelberg in mid-March, etc. The system should leverage this knowledge.

#### 1A: Publication Calendar UI (`/calendar`)

The calendar is the **central planning view** — a timeline of upcoming and past competitor publications.

**Calendar page features:**
- **Timeline view** (default): Chronological list grouped by month, showing upcoming publications as cards with company logo, report type, expected date, status
- **Calendar grid view** (toggle): Monthly calendar with publication dots, hover to see details
- **Status badges per event:**
  - `scheduled` — date set, not yet published (upcoming, shown in blue)
  - `due_today` — publication expected today (highlighted in amber)
  - `overdue` — expected date passed, not yet detected (shown in red)
  - `detected` — PDF found on IR page (shown in green)
  - `ingested` — PDF downloaded + KPIs extracted (shown in green with checkmark)
  - `benchmark_ready` — benchmark document generated (shown with document icon)
- **Quick-add:** Click a date → modal to add a publication event (select company, report type, optional time, optional direct PDF URL)
- **Bulk import:** Paste a list or upload CSV of publication dates (company, date, report type) for the year
- **AI suggestions:** When adding a company, AI analyzes the company's past publication pattern (e.g., "CRH typically publishes annual results in the last week of February") and pre-fills suggested dates for the upcoming year. User confirms or adjusts.
- **Filters:** By company, report type, status, date range
- **Notification preferences:** Per-event toggle for email alerts (e.g., "notify me when CRH FY2025 annual report is detected")

**Calendar card details (per publication event):**
- Company name + logo + ticker
- Report type (Annual / Quarterly Q1-Q4 / Half-Year / Sustainability)
- Expected publication date + time (if known)
- IR page URL (editable — can be a direct PDF link or the IR landing page)
- Monitoring window: start checking X hours before expected date, check every Y minutes
- Status + last check timestamp
- Link to the ingested report / benchmark document once generated

#### 1B: Company IR Configuration (`/settings/companies/:id`)

Each company gets an IR configuration panel (accessible from the calendar or from a company settings page):

- **IR page URL** — the Investor Relations page where reports appear
- **Direct report URLs** — if the user already has a direct PDF URL for an upcoming report, they can paste it (skips scraping entirely)
- **AI URL finder:** Button "Find IR Page" → AI searches for the company's IR page using company name + ticker + exchange. Presents top 3 suggestions with confidence scores. User picks one.
- **Publication history:** Table of past publications detected/ingested, with dates and links
- **Typical publication pattern:** AI-derived summary (e.g., "Annual: late Feb, Q1: late Apr, Q2: late Jul, Q3: late Oct")

#### 1C: Smart Monitoring Engine

Instead of daily brute-force cron, the system monitors **around expected publication dates**:

1. **Before publication date:** Starting 3 days before the expected date (configurable), a scheduled check runs every 6 hours
2. **On publication date:** Checks every 30 minutes
3. **Day after expected date (overdue):** Checks every 2 hours + sends alert to user ("CRH annual report was expected yesterday, not yet detected")
4. **Detection logic:**
   - If user provided a direct PDF URL → just check if it resolves (HEAD request, check Content-Type = PDF)
   - If user provided IR page URL → fetch HTML, find new PDF links matching patterns (annual report, quarterly, etc.), compare against known reports
   - AI-assisted parsing: if standard selectors don't find it, use Claude to analyze the IR page HTML and locate the report link
5. **On detection:** Create `reports` row with `status: 'detected'`, update calendar event status, trigger ingestion pipeline (Block 2)

**Monitoring is surgical, not brute-force.** Only companies with upcoming publications in the next 7 days get checked. Zero network traffic for companies with no expected publications.

**New DB tables:**

```
publication_events
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL FK companies,
  report_type text NOT NULL ('annual' | 'quarterly' | 'half_year' | 'sustainability'),
  fiscal_year integer NOT NULL,
  fiscal_quarter integer,
  expected_date date NOT NULL,
  expected_time time,
  actual_detected_at timestamptz,
  ir_page_url text (override per-event, falls back to company.ir_page_url),
  direct_pdf_url text (if user already has the direct link),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'due_today', 'overdue', 'detected', 'ingested', 'benchmark_ready', 'cancelled')),
  monitoring_start_hours_before integer DEFAULT 72,
  monitoring_interval_minutes integer DEFAULT 360,
  notify_on_detection boolean DEFAULT true,
  notes text,
  report_id uuid FK reports (linked after detection/ingestion),
  created_by uuid FK auth.users,
  created_at timestamptz, updated_at timestamptz,
  UNIQUE (company_id, report_type, fiscal_year, fiscal_quarter)

monitor_checks
  id uuid PRIMARY KEY,
  publication_event_id uuid NOT NULL FK publication_events,
  checked_at timestamptz NOT NULL DEFAULT now(),
  check_method text ('head_request' | 'html_scrape' | 'ai_parse'),
  result text ('not_found' | 'found' | 'error'),
  found_url text,
  error_message text,
  response_time_ms integer,
  created_at timestamptz
```

**Company table additions:**

```
companies ADD COLUMNS:
  ir_page_url text,
  typical_publication_pattern jsonb
    (e.g., {"annual": {"month": 2, "week": 4}, "quarterly_q1": {"month": 4, "week": 4}})
```

**New edge functions:**
- `check-publication` — checks a single publication event (HEAD request / HTML scrape / AI parse). Called on schedule.
- `suggest-ir-url` — AI finds the IR page URL for a company
- `suggest-publication-dates` — AI analyzes a company's history and suggests upcoming publication dates
- Invoked by GitHub Actions cron that runs every 30 minutes, queries `publication_events` for events in monitoring window

**New UI pages:**
- `/calendar` — publication calendar (timeline + grid views)
- `/calendar/add` or modal — add publication event
- `/settings/companies/:id` — company IR configuration + publication history

---

### Block 2: Automated Ingestion Pipeline

**What:** When a new publication is detected, automatically download, extract, and normalize — no human intervention.

**How it works:**
1. `monitor-publications` detects a new report → creates `reports` row with `status: 'detected'`
2. Pipeline orchestrator picks up detected reports and chains:
   - **Download:** Fetch PDF from `source_url` → store in Supabase Storage → update `pdf_storage_path`
   - **Extract:** Call `extract-kpis` (already built) → creates `extractions` + `kpi_values`
   - **Normalize:** Call `normalize-kpis` (already built) → fills `normalized_value` + `fx_rate_used`
   - **Generate:** Call `generate-benchmark` (Block 3) → creates benchmark document
3. Status progresses: `detected → downloading → processing → extracted → normalized → benchmark_generated`

**New edge functions:**
- `download-report` — downloads PDF from source_url, stores in Supabase Storage
- `pipeline-orchestrator` — chains download → extract → normalize → generate sequentially

**Key design decision:** Use pg_net fire-and-forget pattern (proven in YTMigration) for chaining edge functions. The orchestrator fires each step and the next step is triggered by a database trigger or webhook on status change.

---

### Block 3: Benchmark Document Generation

**What:** Based on the extracted + normalized KPI data, generate a structured benchmark document comparing the competitor against Holcim and the peer group.

**How it works:**
1. Customer (Holcim) configures **benchmark rules** that define:
   - Which KPIs to include in the benchmark
   - How to weight/rank them (e.g., Revenue growth more important than absolute revenue)
   - Target thresholds (e.g., "flag if competitor EBITDA margin exceeds ours by >5%")
   - Report format/template (sections, narrative style, chart types)
   - Which peer group to compare against
2. When new KPI data is normalized, the system:
   - Loads the benchmark rules for the customer
   - Pulls all peer group KPI data for the same fiscal year
   - Calls Claude to generate a narrative benchmark analysis
   - Produces a structured document (stored as JSON + rendered as HTML/PDF)
3. The generated document includes:
   - Executive summary (key findings, competitive position changes)
   - KPI comparison table (with signal coloring, YoY trends)
   - Per-KPI analysis (where competitor stands vs Holcim vs peer median)
   - Risk flags (areas where competitor outperforms)
   - Appendix with data sources, confidence scores, FX rates used

**New DB tables:**

```
benchmark_rules
  id, customer_company_id (FK companies), name, description,
  peer_group_id (FK peer_groups),
  kpi_selection jsonb (array of kpi_definition_ids + weights + thresholds),
  report_template text (template name or custom instructions),
  narrative_style text ('executive_brief' | 'detailed_analysis' | 'board_presentation'),
  auto_generate boolean DEFAULT true,
  created_by uuid (FK auth.users),
  created_at, updated_at

benchmark_documents
  id, benchmark_rule_id (FK benchmark_rules),
  trigger_report_id (FK reports — the competitor report that triggered this),
  trigger_company_id (FK companies — the competitor),
  customer_company_id (FK companies — Holcim),
  fiscal_year integer,
  title text,
  status text ('draft' | 'in_review' | 'approved' | 'delivered' | 'rejected'),
  content_json jsonb (structured document content),
  content_html text (rendered HTML),
  pdf_storage_path text (generated PDF in Storage),
  generated_at timestamptz,
  generated_by text ('system' | 'manual'),
  ai_model_used text,
  created_at, updated_at
```

**New edge functions:**
- `generate-benchmark` — takes report_id + benchmark_rule_id → generates document via Claude
- `render-benchmark-pdf` — converts content_json → HTML → PDF (using Puppeteer or similar)

---

### Block 4: Approval Workflow

**What:** Multi-step review and approval chain before the benchmark document reaches the final recipient.

**How it works:**
1. Customer configures an **approval chain** — an ordered list of roles/users who must review
2. When a benchmark document is generated (status = 'draft'), it enters the approval workflow
3. Each approver in sequence:
   - Gets notified (email + in-app notification)
   - Reviews the document (can view, comment, request changes)
   - Takes action: **Approve** (advances to next approver) or **Request Changes** (sends back to previous step with comments)
4. Status flow: `draft → in_review → [loop: review/revise] → approved → delivered`
5. Final approved document is delivered to the designated recipient (email with PDF attachment + in-app)

**New DB tables:**

```
approval_chains
  id, benchmark_rule_id (FK benchmark_rules),
  name text,
  steps jsonb (ordered array of { step_number, role, user_id, is_optional }),
  created_by uuid, created_at, updated_at

approval_steps
  id, document_id (FK benchmark_documents),
  chain_id (FK approval_chains),
  step_number integer,
  assignee_id uuid (FK auth.users),
  role text ('analyst' | 'manager' | 'director' | 'c_suite'),
  status text ('pending' | 'in_review' | 'approved' | 'changes_requested' | 'skipped'),
  comments text,
  reviewed_at timestamptz,
  created_at, updated_at

approval_comments
  id, step_id (FK approval_steps),
  author_id uuid (FK auth.users),
  comment text,
  attachment_path text,
  created_at
```

**New UI pages:**
- `/documents` — list of all benchmark documents with status badges
- `/documents/:id` — document viewer with approval sidebar (comments, approve/reject buttons)
- `/documents/:id/edit` — edit document content (for analysts making revisions)
- `/settings/approval-chains` — configure approval chains
- `/settings/benchmark-rules` — configure benchmark rules (KPI selection, weights, thresholds, template)

**New edge functions:**
- `advance-approval` — moves document to next approval step, sends notification
- `send-document-notification` — email notification to next approver
- `deliver-document` — sends final approved document to C-suite recipient

---

### Block 5: Notification System

**What:** Real-time notifications for publication detection, document generation, and approval actions.

**Components:**
- Email notifications (via existing Metanet SMTP)
- In-app notification bell (badge count + dropdown)
- Per-user notification preferences

**Triggers:**
- New competitor report detected
- Benchmark document generated (draft ready for review)
- Document assigned to you for approval
- Document approved/changes requested
- Final document delivered

**New DB table:**

```
notifications
  id, user_id uuid (FK auth.users),
  type text ('report_detected' | 'document_generated' | 'approval_assigned' | 'approval_action' | 'document_delivered'),
  title text, body text,
  link text (in-app URL),
  is_read boolean DEFAULT false,
  related_document_id uuid (FK benchmark_documents),
  related_report_id uuid (FK reports),
  created_at
```

---

## Implementation Priority / Sprint Plan

| Sprint | Block | Scope | Builds on |
|--------|-------|-------|-----------|
| **Sprint 6** | Block 3 | Benchmark rules + document generation | Existing extract + normalize |
| **Sprint 7** | Block 4 | Approval workflow + document viewer | Sprint 6 documents |
| **Sprint 8** | Block 1 | Automated publication monitoring | Existing companies table |
| **Sprint 9** | Block 2 | Automated ingestion pipeline | Sprint 8 monitoring + existing extraction |
| **Sprint 10** | Block 5 | Notification system | All previous blocks |

**Rationale for this order:**
- Sprint 6 first because document generation is the core value — even with manual upload, generating a proper benchmark document is the killer feature
- Sprint 7 next because the approval workflow is what makes this enterprise-grade (not just a data tool)
- Sprint 8-9 (automation) come after because the manual pipeline already works and you can demonstrate value to customers before automation is ready
- Sprint 10 (notifications) ties everything together

---

## New Pages Summary (after all sprints)

| Route | Sprint | Purpose |
|-------|--------|---------|
| `/documents` | 6 | Benchmark document list (filterable by status, company, date) |
| `/documents/:id` | 6 | Document viewer + approval sidebar |
| `/documents/:id/edit` | 7 | Document editor (analyst revisions) |
| `/settings/benchmark-rules` | 6 | KPI selection, weights, thresholds, templates |
| `/settings/approval-chains` | 7 | Approval chain configuration |
| `/calendar` | 8 | Publication calendar — timeline + grid views, status badges, filters |
| `/calendar/add` (or modal) | 8 | Add/edit publication event (company, date, report type, URL) |
| `/settings/companies/:id` | 8 | Company IR configuration, AI URL finder, publication history |
| `/notifications` | 10 | Notification center (or dropdown from bell icon) |

---

## New DB Tables Summary

| Table | Sprint | Purpose |
|-------|--------|---------|
| `benchmark_rules` | 6 | Customer's benchmark configuration |
| `benchmark_documents` | 6 | Generated benchmark documents |
| `approval_chains` | 7 | Approval workflow definitions |
| `approval_steps` | 7 | Per-document approval progress |
| `approval_comments` | 7 | Review comments on approval steps |
| `publication_events` | 8 | Calendar events for expected competitor publications (date, time, status, monitoring config) |
| `monitor_checks` | 8 | Per-check log for publication monitoring (method, result, found URL, timing) |
| `notifications` | 10 | In-app + email notification queue |

---

## New Edge Functions Summary

| Function | Sprint | Purpose |
|----------|--------|---------|
| `generate-benchmark` | 6 | Claude generates benchmark document from KPI data |
| `render-benchmark-pdf` | 6 | HTML → PDF rendering |
| `advance-approval` | 7 | Move document through approval chain |
| `send-document-notification` | 7 | Email approvers |
| `deliver-document` | 7 | Final delivery to C-suite |
| `check-publication` | 8 | Check a single publication event (HEAD / HTML scrape / AI parse) |
| `suggest-ir-url` | 8 | AI finds the IR page URL for a company |
| `suggest-publication-dates` | 8 | AI analyzes company history → suggests upcoming dates |
| `download-report` | 9 | Download detected PDF from IR page |
| `pipeline-orchestrator` | 9 | Chain: download → extract → normalize → generate |

---

## Company Column Additions

| Column | Type | Purpose |
|--------|------|---------|
| `ir_page_url` | text | URL of the company's Investor Relations page |
| `typical_publication_pattern` | jsonb | AI-derived pattern, e.g. `{"annual": {"month": 2, "week": 4}, "quarterly_q1": {"month": 4, "week": 4}}` |

---

## Known Risks

1. **IR page scraping reliability** — Company websites change layouts, use JavaScript rendering, or put PDFs behind CDNs. May need headless browser (Puppeteer) for some sites.
2. **PDF size vs edge function timeout** — Supabase edge functions have a 60s default timeout. Large PDFs (>50MB) may need chunked processing or a longer-running worker.
3. **Claude API costs** — Each extraction + benchmark generation = 2 Claude calls. At 15 peers × 4 reports/year = 120 calls/year. Budget ~$50-100/year at current Sonnet pricing.
4. **FX rate freshness** — Need a mechanism to keep `fx_rates` table updated. Could use a free API (e.g., exchangerate.host) via daily cron.
5. **Multi-tenant readiness** — Current schema is implicitly single-tenant (one peer group centered on Holcim). For multiple customers, `benchmark_rules` and `approval_chains` provide per-customer scoping.
