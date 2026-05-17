# Valrano — Product & UX Restructure Plan

**Date:** 2026-05-05
**Context:** Based on 103 findings from 8-domain UI/UX audit
**Core principle:** Valrano automatically tracks what competitors publish, extracts the numbers, and lets you compare them against your own.

---

## The Core Mental Model

The product does one thing: **automatically track what competitors publish, extract the numbers, and let you compare them against your own.**

Everything else -- reports, analytics, trends -- is downstream of this automated data gathering.

The user's daily experience should be:
> "I open Valrano. I see how I compare against my competitors. If something changed overnight, I see it immediately. If I need a board presentation, I generate one from the data that's already there."

---

## Current Problems (Why Restructure)

1. **Leads with manual upload wizard** -- but the product's value is automation
2. **Dashboard is just a data table** -- should be a command center
3. **10 flat nav items treat everything as equally important** -- setup and daily use are fundamentally different
4. **No onboarding** -- user sees 10 nav items and an empty page
5. **Design system components exist but are unused** -- `<Button>`, `<Dialog>`, `<Select>` all built but never adopted

---

## Two Modes of Use

### Mode 1: Setup (done once, revisited rarely)
- Define your company and enter your KPI data
- Define your peer group (which competitors to track)
- Set up monitoring (where to find their annual reports)
- Configure benchmark rules and report templates

### Mode 2: Daily Use (the actual product)
- See the current state of your benchmark at a glance
- Get alerted when a competitor publishes new data
- Deep-dive into trends and analytics when needed
- Generate reports for the board when needed

---

## New Navigation: 5 Items

```
+-----------------------------------------------------------+
| Valrano    Dashboard  Peers  Analytics  Reports   | bell gear avatar
+-----------------------------------------------------------+
```

| Nav Item | Contains | Replaces |
|----------|----------|----------|
| **Dashboard** | Command center: KPI table, metric cards, alerts, activity feed | Dashboard (enhanced) |
| **Peers** | Competitor profiles, monitoring status, upload, calendar, review | Upload + Review + Calendar (merged) |
| **Analytics** | Trends, pivot tables, scatter plots, heatmaps (tabs) | Trends + Analytics (merged) |
| **Reports** | Report builder + generated benchmark documents | Documents + Reports (merged) |
| **gear Settings** | My Company, KPI data, benchmark rules, approval chains, notifications | My Company + Rules + Approval Chains (moved) |

---

## Dashboard: Command Center

The dashboard becomes a comprehensive command center showing everything that matters at a glance.

### Layout

```
+--------------------------------------------------------------+
| YOUR POSITION          PEERS TRACKED       DATA FRESHNESS     |
| P67 (above median)     6 companies         Last: 2 days ago   |
| up from P61 last FY    1 pending review    Next: CRH (Feb 27) |
+--------------------------------------------------------------+
| ALERTS                                                        |
| - CRH plc published FY2024 report -- extraction complete      |
| - Holcim revenue: +12% YoY -- moved from P45 to P62           |
| - 3 KPI values flagged for review                              |
+--------------------------------------------------------------+
|                                                                |
| PEER COMPARISON TABLE                                          |
| [Financial] [ESG] [Operational] [All]           FY: [2024 v]  |
| +----------+----------+----------+----------+                  |
| | Company  | Revenue  | EBITDA   | Net Debt | <-- sortable     |
| | * You    | 28.5B ^  | 5.2B     | 8.1B    | <-- highlighted  |
| | CRH plc  | 35.2B    | 6.8B     | 9.4B    |                  |
| | Cemex    | 15.8B    | 2.9B     | 12.1B   |                  |
| +----------+----------+----------+----------+                  |
|                                                                |
+--------------------------------------------------------------+
| RECENT ACTIVITY                    UPCOMING PUBLICATIONS       |
| - FY2024 benchmark doc generated   - Buzzi SpA -- Mar 2026    |
| - Your KPIs updated (2d ago)       - Heidelberg -- Apr 2026   |
| - CRH report extracted (2d ago)    - M. Marietta -- May 2026  |
+--------------------------------------------------------------+
```

### Key Changes from Current Dashboard
- **Your Position card** -- single number answering "how am I doing?" (from self-benchmark data)
- **Alerts bar** -- what changed since last visit (new publications, KPI movements, items needing review)
- **Your row highlighted** -- dynamically from My Company profile, not hardcoded to "Holcim"
- **Sortable columns** -- click any header to sort
- **Sticky table headers** -- don't scroll away
- **Smart year default** -- auto-detect most recent year with data
- **Recent Activity + Upcoming Publications** -- context about what happened and what's coming

---

## Peers Page: Unified Competitor Management

Replaces Upload + Review + Calendar. Everything about the companies you track in one place.

### Layout

```
+--------------------------------------------------------------+
| PEERS                                         [+ Add Peer]    |
| Manage your competitive peer group                            |
+--------------------------------------------------------------+
|                                                                |
| +-- CRH plc -----------------------------------------------+ |
| | green Monitoring active - Last report: FY2024 (Feb 2026)  | |
| | Next expected: Feb 2027                                    | |
| | KPIs: 15 extracted - 0 pending review                      | |
| | [View Profile]  [Upload Report]  [Check Now]               | |
| +-----------------------------------------------------------+ |
|                                                                |
| +-- Cemex SAB ----------------------------------------------+ |
| | yellow Monitoring active - Last report: FY2023             | |
| | Next expected: Mar 2026 (overdue!)                         | |
| | KPIs: 12 extracted - 3 pending review (!)                  | |
| | [View Profile]  [Upload Report]  [Check Now]               | |
| +-----------------------------------------------------------+ |
|                                                                |
+--------------------------------------------------------------+
```

### What This Replaces
- **Upload page** -> "Upload Report" button on each peer card (or "+ Add Peer" with upload)
- **Review page** -> flagged items shown inline per peer ("3 pending review"), click to review that peer's KPIs
- **Calendar page** -> publication dates and monitoring status shown inline per peer

### Adding a New Peer
1. Click "+ Add Peer"
2. Enter company name -> system searches public database
3. Set their IR page URL (or auto-discover)
4. Upload their latest annual report OR let monitoring find it
5. System auto-extracts -> auto-normalizes -> auto-benchmarks

### Peer Profile (sub-page: /peers/:id)
- Company details (name, ticker, sector, country)
- Monitoring configuration (IR page URL, check frequency)
- Publication history (all detected reports with dates)
- KPI data table (all extracted values by fiscal year)
- Review queue (flagged values for this peer only)

---

## Automation: End-to-End Pipeline

The current system requires 4 manual button clicks after upload. The new system chains automatically.

### Automated Flow

```
MONITORING (runs continuously per Calendar config)
    |
    v
IR page detected new PDF
    |
    v
Auto-download -> Auto-extract KPIs -> Auto-normalize to CHF -> Auto-generate benchmark doc
    |
    v
LOW-CONFIDENCE KPIs flagged for review (only if needed)
    |
    v
NOTIFICATION: "CRH plc FY2024 data is ready -- 15 KPIs extracted, 2 flagged for review"
    |
    v
Dashboard updates automatically -- new data reflected in peer comparison table
```

### Manual Upload as Fallback
- Available on each Peer card as "Upload Report"
- Runs the full pipeline in one shot (no 4-step manual wizard)
- Progress shown inline: "Uploading... Extracting... Normalizing... Done!"
- Only pauses if KPIs are flagged for review

---

## Analytics Page: Merged Analysis Tools

Merges current Trends + Analytics into one page with tabs.

### Tabs
- **Trends** -- Multi-year time-series charts, CAGR tables, momentum indicators
- **Pivot Table** -- Companies x KPIs matrix with signal coloring
- **Scatter Plot** -- Two-KPI correlation with on-chart company labels
- **Heatmap** -- Percentile-colored matrix with proper legend

### Key Improvements
- Smart year defaults (auto-detect data range, not hardcoded to current-1)
- Year range validation (startYear <= endYear)
- Column sorting on all tables
- Signal coloring on pivot table (not monochrome)
- On-chart labels for scatter plot
- Proper heatmap legend with percentile tick labels
- WCAG-compliant contrast on all data cells

---

## Reports Page: Merged Output

Merges current Documents + Report Builder into one page.

### Layout

```
+--------------------------------------------------------------+
| REPORTS                                      [+ New Report]   |
|                                                                |
| [All]  [Benchmark Docs]  [Custom Reports]                    |
|                                                                |
| +-- FY2024 Peer Benchmark -- CRH plc --- Auto-generated ----+|
| | Generated 2 days ago - Executive Brief - 15 KPIs           ||
| | [View]  [Export PDF]  [Export CSV]                          ||
| +------------------------------------------------------------+|
|                                                                |
| +-- Q4 2025 Board Presentation ---------- Custom Report -----+|
| | Draft - Board Presentation template - 6 KPIs               ||
| | [Edit]  [Generate]  [Delete]                               ||
| +------------------------------------------------------------+|
+--------------------------------------------------------------+
```

### Key Improvements
- Single place for all output documents
- Tab filter: All / Auto-generated / Custom
- "View" button available for all statuses (not just 'ready')
- View button uses Eye icon (not Download icon)
- After creating custom report: auto-navigate to viewer, prompt to generate
- KPI selector expanded to 256px with search, "Select All", category grouping
- Estimated time shown during generation: "Usually 30-60 seconds"

---

## Settings: Configuration Hub

Everything that's "configure once, rarely touch again."

### Structure

```
Settings
+-- My Company
|   +-- Company profile (name, sector, country, currency)
|   +-- KPI data entry (your numbers by fiscal year)
|   +-- Self-benchmark results (your percentile position)
+-- Benchmark Rules
|   +-- How auto-generated benchmark docs are configured
|   +-- Edit support (not just delete-and-recreate)
+-- Approval Chains
|   +-- Who approves what (currently orphaned, now accessible)
+-- Notifications
    +-- Email alerts for new publications
    +-- In-app notification preferences
```

### My Company Flow (Guided)
1. Enter company profile -> save
2. Enter KPI data (with proper labels, not truncated) -> save
3. See inline checklist: "Profile done / KPIs done / Ready to benchmark"
4. "View Your Position" button (only when KPIs are entered)
5. Results also surfaced on Dashboard "Your Position" card

---

## Onboarding: Welcome Wizard

New users see a 3-step setup wizard on first login.

### Step 1: Add Your Company (~2 min)
- Company name, sector, country
- Enter 5-10 key KPIs for the most recent fiscal year
- "You can add more KPIs later in Settings"

### Step 2: Add Your Peers (~3 min)
- Search and add 3-5 competitors
- Auto-discover IR page URLs
- Upload their latest annual reports (or let monitoring find them)

### Step 3: Set Up Monitoring (~1 min)
- Confirm IR page URLs for each peer
- System starts watching for new publications
- "We'll notify you when a peer publishes new data"

### After Wizard
- Dashboard loads with data (first upload auto-processed during wizard)
- SetupProgress banner shows remaining steps if wizard was partially completed
- Banner dismisses permanently once data is fully loaded

---

## Implementation Sprints

### Sprint A: Foundation (Critical fixes + Dashboard redesign)

| Task | Resolves |
|------|----------|
| Fix KPI editor data-loss bug (pre-populate values from existingKpis) | C2 |
| Fix hardcoded Holcim (dynamic lookup from My Company) | C1, D4-12, D8-1 |
| Fix year default (auto-detect most recent year with data) | C3, D4-2 |
| Fix PasswordGate (sessionStorage -> localStorage) | C4, D7-1 |
| Fix contrast (bg-tertiary to #252629, heatmap mid-band text) | C6, C7, D3-6, D3-11 |
| Fix YAxis (tickFormatter + unit label) | C8, D3-3 |
| Adopt `<Button>` globally | D6-1, D6-2, D6-6, D6-15, H1, H2 |
| Adopt `<Dialog>` globally (replace confirm() and hand-rolled modals) | C12, D2-1, D6-8, H18, H24 |
| Adopt `<Select>` globally (replace native select) | D3-2, D6-11 |
| Standardize typography scale | D3-1, D6-3, H23 |
| Replace signal color hardcodes with tokens | D3-4, D6-7 |
| Unify card border-radius | D6-4 |
| Standardize loading states (shared skeleton component) | D4-10, D6-9 |
| Replace `<a href>` with `<Link to>` in UploadPage | D6-14 |
| Redesign Dashboard as command center | D8-9, D3-10, D3-17 |
| Add column sorting to peer comparison table | D3-17, H3 |
| Make thead sticky | D3-10, H4 |
| Add "Your Position" metric card | D8-7 |
| Add alerts bar and activity feed | D8-8, D8-9 |

### Sprint B: Navigation Restructure

| Task | Resolves |
|------|----------|
| Collapse nav to 5 items (Dashboard, Peers, Analytics, Reports, Settings) | D1-1, D1-6, D1-7, D8-6, D8-10 |
| Build unified Peers page (company cards + monitoring + upload + review) | D2-5, D2-9, D1-8, D1-9, D4-5 |
| Merge Trends + Analytics into single Analytics page with tabs | D2-10, D2-8 |
| Merge Documents + Reports into single Reports page | D1-5, D8-14 |
| Move My Company, Rules, Approval Chains under Settings | D1-2, D1-3, D1-4, D1-10, D8-10 |
| Fix mobile nav (focus trap, scroll lock, backdrop) | D1-8, D7-2, D7-11 |
| Extract nav items to typed constant array | D6-10 |
| Auto-chain upload pipeline (upload -> extract -> normalize -> benchmark) | D2-2, D2-4, D8-5 |
| Rename "View" icon from Download to Eye | D8-12 |
| Surface ApprovalChainsPage under Settings | D1-4 |
| Add edit mode to Benchmark Rules | D2-11 |

### Sprint C: Onboarding + Automation

| Task | Resolves |
|------|----------|
| Build welcome wizard (3-step setup) | D4-1, D8-2, D4-4 |
| Wire monitoring pipeline to auto-trigger full extraction chain | D8-3, D2-4 |
| Add notification system (in-app + email for publications) | D8-3 |
| Fix My Company flow (only show benchmark when KPIs exist, inline checklist) | D8-4 |
| Add prerequisite checks on empty states | D4-3, D4-9, D4-11, D4-5 |
| Differentiate filtered-empty vs genuinely-empty states | D2-12 |
| Smart year defaults with data range detection | D4-2, D4-6 |
| Add "next step" CTAs after terminal actions | D8-8 |
| Add demo data seeding option | D4-8 |
| Trends chart minimum-data guard | D4-6 |

### Sprint D: Polish & Accessibility

| Task | Resolves |
|------|----------|
| Inline field validation with aria-invalid | D5-1, H26 |
| Searchable company combobox | D5-4, H27 |
| Add htmlFor/id to all form labels | D5-12, H28 |
| KPI selector: expand, add search, select-all, category groups | D2-16, D5-2, D8-13 |
| Scatter plot on-chart labels | D3-7, H19 |
| Pivot table signal coloring | D3-9, H20 |
| PercentileBar alignment fix | D3-8, H21 |
| MomentumBadge text size increase | D3-14, H22 |
| Touch targets 44px minimum | D7-4 |
| aria-label on all icon-only buttons | D7-6 |
| role="tablist/tab" on Analytics view switcher | D7-5 |
| role="status" on loading states | D7-9 |
| Signal red/amber WCAG fix (darker values in dark theme) | D7-7 |
| Colorblind secondary indicators | D7-8 |
| Fix muted-foreground contrast (raise to #A8B0BB) | D3-16 |
| Peer Median line color fix | D3-18 |
| ReportViewer H2 typography fix | D3-12 |
| Calendar banner collapse to disclosure | D3-13 |
| Notes/Description fields to textarea | D5-5 |
| Character counters on description fields | D5-14 |
| Review approve undo toast | D5-9 |
| LoginPage email field above tabs | D5-8 |
| PasswordGate visible label + loading state | D5-7 |
| Max-width standardization | D6-12 |
| Replace hand-rolled inputs with shadcn Input | D6-13 |
| Year range validation (startYear <= endYear) | D2-8 |
| Scatter same-KPI warning | D2-10 |
| Calendar delete loading state per row | D2-14 |
| Upload fiscal year validation in handler | D2-15 |
| ReportViewer regenerate auto-refresh | D2-17 |
| Trends chart multi-KPI navigation | D2-18 |
| Calendar auto-discover re-run button | D2-19 |
| ReviewPage empty state upload CTA | D2-20 |
| BenchmarkRules delete spinner | D2-21 |
| Report builder navigate after create | D2-6 |
| Report draft state generate button | D2-3 |
| MyBenchmark re-run label | D2-13 |
| Scatter preset correlations | D4-13 |
| html class="dark" -> system preference | D7-10 |
| Sticky column bg-inherit fix | D7-12 |
| Heatmap legend tick labels | D3-5 |
| KPI editor label width increase | D5-11, D8-11 |
| Estimated time on pipeline steps | D8-15 |
| Report generation estimated time | D8-15 |

---

## Finding Coverage

All 103 findings from the audit are mapped to a specific sprint task:
- Sprint A: ~25 findings (critical bugs + design system)
- Sprint B: ~20 findings (navigation + page merges)
- Sprint C: ~15 findings (onboarding + automation)
- Sprint D: ~43 findings (polish + accessibility)

No finding is dropped. Every issue has a resolution path.

---

## Implementation Progress

### Pre-Sprint: Dark Mode Contrast Fix (2026-05-07, commit `60f7167`)

Before starting Sprints A-D, a foundational dark mode readability audit was performed. This was necessary because the contrast issues made it impossible to properly evaluate UI changes during the sprint work.

**30+ fixes across 19 files:**
- All auth buttons: `text-white` → `text-primary-foreground` (invisible text in dark mode)
- All focus rings: `ring-primary` → `ring-accent` (invisible light gray → visible blue)
- All interactive links: `text-primary` → `text-accent`
- Notification toggles: visible OFF state border, blue ON state
- NotificationBell badge: red instead of invisible light gray
- FY dropdown: overflow fix
- Heatmap: dynamic text color based on percentile
- WelcomeWizard: stepper and peer selection contrast
- SetupProgressBanner: visible border
- CardFooter: visible background
- Settings tabs: visible active state
- SignUp progress dots: visible color

**Design pattern established:** See `DESIGN_BRIEF.md` §11 for mandatory color usage rules.

**Sprint A partial resolution:** This pre-sprint work resolved the contrast/color items from Sprint A:
- ~~Fix contrast (bg-tertiary, heatmap mid-band text)~~ → DONE (partially — CardFooter + heatmap fixed; full bg-tertiary token update still needed)
- Sprint A's "Adopt `<Button>` globally" and "Adopt `<Dialog>` globally" are NOT yet done — those are structural changes requiring more work.

### Phase 1: Accounting Profile (2026-05-07, commit `df7752d`)

Implemented per PRODUCT-VISION-2026-05-07.md Phase 1:
- `accounting_profiles` table + migration
- `analyze-accounting-profile` edge function (Claude Vision extraction)
- Settings UI tab for profile review/edit

### Phase 2: Dashboard Command Center (2026-05-07, commit `2344294`)

Implemented per PRODUCT-VISION-2026-05-07.md Phase 2:
- Pipeline-focused metric cards (active pipelines, next report, documents ready, pending reviews)
- Upcoming publications timeline (next 30 days)
- Recent documents section
- AI insights placeholder

### Landing Page Redesign (2026-05-07, commit `91f2bad`)

Complete redesign with animated hero, bento grid features, stats counter, pricing table.

---

## Future Considerations (Not In Scope)

- Global search across companies, KPIs, documents
- Bulk upload (multiple PDFs at once)
- Keyboard shortcuts / quick actions
- Email report delivery (scheduled)
- PDF export for reports (beyond CSV)
- Role-based access (admin vs analyst vs viewer)
