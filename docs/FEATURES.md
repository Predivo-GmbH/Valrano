# BenchmarkSignal Feature Registry

**Project:** BenchmarkSignal (Automated Competitive Benchmarking for Listed Corporations)
**Last Updated:** 2026-05-08
**Total Features:** 22 (core) + Phase 1-2 features (see PRODUCT-VISION-2026-05-07.md)
**Implemented:** 6 core + Accounting Profile (Phase 1) + Dashboard Command Center (Phase 2) + Landing Page redesign + Company Profile + Dev Tools + Source Transparency + Document Editability
**Unit Tests:** 4 files / **E2E Tests:** 1 spec file / **Accessibility:** 0 spec files

### Recent Changes (2026-05-08b)
- **Company Profile Navigation** — All company names in peer comparison table + "peers without data" are clickable `<Link>` to `/companies/:id` (commit `2ca5c3e`)
- **AI Insights Source Transparency** — Each insight shows company (linked), KPI badge (linked to analytics), FY year, timestamp. "Sources:" with 3 clickable links: Uploaded Reports, Company Profile, KPI Analytics (commit `0069c83`)
- **Benchmark Document Editability** — Click-to-edit `EditableText` component. Executive summary, key findings, section narratives editable in draft/in_review status. `useUpdateDocumentContent` mutation. Read-only when approved/delivered (commit `2ca5c3e`)
- **News Source Visibility** — Article titles are clickable external links. Source domain shown below title. Author + date inline (commit `0069c83`)

### Previous Changes (2026-05-08)
- **Company Profile Page** — `/companies/:id` route, info cards, KPI summary table, trend chart, publication history (commit `f95cdcc`)
- **Analytics Condensed Tables** — MAX_VISIBLE_KPIS=6, "+N more" expand/collapse for PivotPanel + HeatmapPanel (commit `f95cdcc`)
- **Export PDF Fix** — ReportBuilderPage buttons now functional (link to `/documents/:id` or call `onView`) (commit `f95cdcc`)
- **Dev Tools: News Gathering Toggles** — Per-user on/off for news fetching, saves API costs during testing (commit `adffe57`)
- **Dev Tools: DEV_EMAIL Fix** — Changed from deleted `roger@mueller.ro` to `dev@benchmarksignal.predivo.ch` (commit `adffe57`)
- **Dashboard Table Width Fix** — Peer comparison table fills card width, no dead space (commit `41a6918`)

### Previous Changes (2026-05-07)
- **Phase 1: Accounting Profile** — `accounting_profiles` table, `analyze-accounting-profile` edge function, Settings UI tab (commit `df7752d`)
- **Phase 2: Dashboard Command Center** — Pipeline metric cards, upcoming publications timeline, recent documents, AI insights placeholder (commit `2344294`)
- **Landing Page Redesign** — Animated hero, bento grid, stats counter, pricing table (commit `91f2bad`)
- **Dark Mode Contrast Fix** — 30+ readability issues fixed across 19 files (commit `60f7167`). See DESIGN_BRIEF.md §11 for color usage rules.

---

## Overview

This document defines all features in the BenchmarkSignal project with their status, routes, critical assertions, and test coverage. Every feature with status "implemented" or "tested" must have test files referenced below.

### Utility Test Coverage

| File | Test File | Tests |
|------|-----------|-------|
| `src/lib/format.ts` | `src/lib/__tests__/format.test.ts` | 13 tests (formatKpiValue + formatCurrency) |
| `src/lib/supabase.ts` | `src/lib/__tests__/supabase.test.ts` | 1 test |

---

### F-001: Password Gate

**Status:** planned
**Route:** All routes (wraps entire app)
**Components:** TBD

**Description:** SHA-256 password gate (BenchPilot2026) protecting the private beta. Stores unlock state in sessionStorage.

**Critical Assertions:**
1. Shows gate form on first visit
2. Rejects incorrect passwords
3. Unlocks with correct password
4. Renders children when unlocked

---

### F-002: User Authentication

**Status:** planned
**Route:** `/auth`, `/auth/confirm`
**Components:** TBD

**Description:** Supabase email + magic link auth. OTP: 6-digit, 600s expiry. Custom SMTP via Metanet.

**Critical Assertions:**
1. Sign up creates account and sends OTP
2. OTP verification completes login
3. Auth state persists across page reloads
4. Sign out clears session

---

### F-003: Theme Toggle (Dark/Light)

**Status:** implemented
**Route:** Global (nav bar)
**Components:** `src/components/layout/AppLayout.tsx`

**Description:** Dark mode default, light mode toggle. Stored in localStorage, respects system preference on first visit.

**Critical Assertions:**
1. Defaults to dark mode
2. Toggle switches theme and persists
3. Respects prefers-color-scheme on first visit

**Test Files:**
- Unit/Component: `src/components/layout/__tests__/AppLayout.test.tsx`
- E2E: `e2e/features.spec.ts` (F-003: Navigation), `e2e/smoke.spec.ts` (dark mode default)

---

### F-004: Dashboard (Peer Comparison)

**Status:** implemented
**Route:** `/dashboard`
**Components:** `src/pages/DashboardPage.tsx`

**Description:** Main app view showing peer comparison table/chart, KPI selector, peer group filter, ranking view. Core value delivery screen.

**Critical Assertions:**
1. Renders peer comparison table with all active companies
2. KPI selector filters displayed metrics
3. Peer group filter switches active group
4. Ranking view shows position per KPI

**Test Files:**
- Unit/Component: `src/pages/__tests__/DashboardPage.test.tsx`
- E2E: `e2e/features.spec.ts` (F-004: Dashboard)

---

### F-005: Report Detail View

**Status:** planned
**Route:** `/reports/:id`
**Components:** TBD

**Description:** Single company report view showing all extracted KPIs, trend charts, source PDF page references.

**Critical Assertions:**
1. Displays all KPIs from the report
2. Shows confidence scores per value
3. Links to source PDF page
4. Flags values needing review

---

### F-006: PDF Upload & Extraction

**Status:** implemented
**Route:** `/upload`
**Components:** `src/pages/UploadPage.tsx`

**Description:** PDF upload with Vision-LLM extraction progress. Shows confidence scores and review queue for values below 0.85.

**Critical Assertions:**
1. Accepts PDF files only
2. Shows extraction progress
3. Displays confidence scores
4. Queues low-confidence values for review

**Test Files:**
- Unit/Component: `src/pages/__tests__/UploadPage.test.tsx`
- E2E: `e2e/features.spec.ts` (F-006: Upload)

---

### F-007: KPI Normalization Engine

**Status:** planned
**Route:** N/A (backend)
**Components:** TBD (Edge Function)

**Description:** Normalizes extracted values: currency conversion (historical FX), KPI taxonomy mapping, restatement awareness.

**Critical Assertions:**
1. Converts currencies using correct FX rate type (period-average for P&L, point-in-time for BS)
2. Maps company-specific labels to canonical KPIs
3. Handles restated values
4. Produces audit trail

---

### F-008: Peer Group Management

**Status:** planned
**Route:** `/settings/peer-groups`
**Components:** TBD

**Description:** CRUD for peer groups. Configure which companies are in each group. One group can be set as default.

**Critical Assertions:**
1. Create new peer group with name and companies
2. Edit existing peer group
3. Delete peer group
4. Set default peer group

---

### F-009: Email Alerts

**Status:** planned
**Route:** `/settings/alerts`
**Components:** TBD

**Description:** Configure and receive email alerts when peers publish new reports or anomalous values detected.

**Critical Assertions:**
1. Enable/disable alerts per type
2. Configure alert scope (peer group or company)
3. Email sent on trigger

---

### F-010: Company Management

**Status:** planned
**Route:** `/settings/companies`
**Components:** TBD

**Description:** View and manage tracked companies. Add new companies with ticker, exchange, ISIN.

**Critical Assertions:**
1. List all tracked companies
2. View company details
3. Toggle active/inactive

---

### F-011: KPI Review Queue

**Status:** implemented
**Route:** `/review`
**Components:** `src/pages/ReviewPage.tsx`

**Description:** Queue of extracted KPI values with confidence below 0.85. Reviewer can approve, edit, or reject.

**Critical Assertions:**
1. Shows only values needing review
2. Displays source PDF context
3. Allows approve/edit/reject
4. Updates confidence and reviewer info

**Test Files:**
- E2E: `e2e/features.spec.ts` (F-011: Review)

---

### F-012: FX Rate Management

**Status:** planned
**Route:** N/A (backend + settings)
**Components:** TBD

**Description:** Historical FX rates for normalization. Auto-fetched daily, with manual override capability.

**Critical Assertions:**
1. Daily rates available for CHF/EUR, CHF/USD, CHF/GBP
2. Period-average rates calculated correctly
3. Manual override possible

---

### F-013: Data Export (CSV/Excel)

**Status:** planned
**Route:** `/dashboard` (export button)
**Components:** TBD

**Description:** Export peer comparison data as CSV or Excel file.

**Critical Assertions:**
1. CSV export contains all visible data
2. Excel export with proper formatting
3. Export respects active filters

---

### F-014: Landing Page

**Status:** planned
**Route:** `/`
**Components:** TBD

**Description:** Marketing homepage with hero, value prop, features, peer group preview, "Request a Demo" CTA. No public pricing.

**Critical Assertions:**
1. Hero section renders with correct copy
2. Feature sections display
3. CTA buttons link to demo request
4. No pricing displayed publicly

---

### F-015: Settings & Billing

**Status:** planned
**Route:** `/settings`
**Components:** TBD

**Description:** Account settings, peer group config, Stripe billing portal link.

**Critical Assertions:**
1. View account details
2. Update profile
3. Access billing portal

---

### F-016: User Profile

**Status:** planned
**Route:** `/settings/profile`
**Components:** TBD

**Description:** Extended user profile with full name, company, job title, default peer group, default currency.

**Critical Assertions:**
1. View profile data
2. Update profile fields
3. Set default peer group and currency

---

### F-017: Company Profile Page

**Status:** implemented
**Route:** `/companies/:id`
**Components:** `src/pages/CompanyProfilePage.tsx`

**Description:** Detailed company view accessible from Peers table "View Profile" links. Shows company info cards (currency, ISIN, FY end, website, IR page), KPI summary table for latest FY with YoY change indicators, multi-year trend chart, and publication history timeline.

**Critical Assertions:**
1. Loads company data by ID from URL param
2. Displays all available KPIs grouped by definition code
3. Shows YoY change with color-coded indicators
4. Links to external website and IR page
5. Publication events filtered to this company

---

### F-018: Dev Tools Panel (DevTierSwitcher)

**Status:** implemented
**Route:** Global (floating bottom-right, z-9999)
**Components:** `src/components/dev/DevTierSwitcher.tsx`, `src/lib/dev-flags.ts`

**Description:** Developer tools panel gated to DEV_EMAIL (`dev@benchmarksignal.predivo.ch`). Two sections: (1) Tier Override — switch subscription tier via localStorage for testing tier-gated features. (2) News Gathering — per-user toggle to enable/disable news fetching, preventing unnecessary API costs during development. Lists all users from `user_profiles` table.

**Critical Assertions:**
1. Only visible when logged in as DEV_EMAIL
2. Tier switches update subscription query cache immediately
3. News toggle persists in localStorage and blocks `useFetchNews` mutation
4. User list loads from `user_profiles` with name + company display

---

### F-019: AI Insights Source Transparency

**Status:** implemented
**Route:** `/dashboard`
**Components:** `src/pages/DashboardPage.tsx`

**Description:** Each AI insight displays full provenance: linked company name with ticker, KPI code badge linked to analytics page, fiscal year, generation timestamp, and a "Sources:" line with 3 clickable links (Uploaded Reports, Company Profile, KPI Analytics). Ensures managers can verify every AI-generated claim.

**Critical Assertions:**
1. Company name links to `/companies/:id`
2. KPI badge links to `/analytics?kpi=...`
3. Sources line shows 3 clickable links
4. All external references are verifiable

---

### F-020: Benchmark Document Editability

**Status:** implemented
**Route:** `/documents/:id`
**Components:** `src/pages/DocumentViewerPage.tsx`, `src/hooks/useBenchmark.ts`

**Description:** Click-to-edit inline editing for benchmark documents. `EditableText` component with textarea (multiline) or input (single-line). Executive summary, key findings, and section narratives are editable when document status is `draft` or `in_review`. Blue hint banner shown. Once approved/delivered, document is read-only. Changes persisted via `useUpdateDocumentContent` mutation to `content_json` column.

**Critical Assertions:**
1. Edit mode activates on click for draft/in_review documents
2. Save/Cancel buttons appear for multiline fields
3. Changes persist to database via mutation
4. Read-only when status is approved or delivered
5. Blue hint banner visible for editable documents

---

### F-021: News Source Visibility

**Status:** implemented
**Route:** `/news`
**Components:** `src/pages/NewsPage.tsx`

**Description:** News articles display clickable titles linking to source URL, extracted source domain shown below title in accent color, author name and published date inline. External link icon on each article.

**Critical Assertions:**
1. Article title is a clickable `<a>` link to source URL
2. Source domain extracted and displayed
3. Author and date shown when available
4. External link icon present

---

### F-022: Company Profile Navigation

**Status:** implemented
**Route:** `/dashboard`
**Components:** `src/pages/DashboardPage.tsx`

**Description:** All company names in the peer comparison table and "peers without data" section are clickable `<Link>` elements navigating to `/companies/:id`. Hover state with accent color underline.

**Critical Assertions:**
1. Company names in peer table link to `/companies/:id`
2. Company names in "peers without data" section also link
3. Hover shows accent color + underline
