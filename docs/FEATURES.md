# Valrano Feature Registry

**Project:** Valrano (Automated Competitive Benchmarking for Listed Corporations)
**Last Updated:** 2026-08-17
**Total Features:** 22 (core) + Phase 1-2 features (see PRODUCT-VISION-2026-05-07.md)
**Implemented/Tested:** 19 of 22 core — planned: F-001 (password gate removed from app), F-009 (no user-configurable alerts yet), F-012 (FX override UI pending)
**Unit/Component/Integration Tests:** 44 files / **E2E Tests:** 25 spec files

### Recent Changes (2026-08-17)
- **Registry re-sync against actual codebase** — Audited routes (`src/components/AuthenticatedShell.tsx`), pages, edge functions, and tests. Moved 9 features from planned to implemented/tested: F-002, F-005, F-007, F-008, F-010, F-013, F-014, F-015, F-016. New tests: `src/pages/__tests__/UploadedReportPage.test.tsx` (F-005), `src/pages/__tests__/AnalyticsExport.test.tsx` (F-013), normalize-kpis reachability test in `tests/integration/critical-paths.test.ts` (F-007). F-001/F-009/F-012 stay planned (honestly not implemented as specified).


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
- **Dev Tools: DEV_EMAIL Fix** — Changed from deleted `roger@mueller.ro` to `dev@valrano.com` (commit `adffe57`)
- **Dashboard Table Width Fix** — Peer comparison table fills card width, no dead space (commit `41a6918`)

### Previous Changes (2026-05-07)
- **Phase 1: Accounting Profile** — `accounting_profiles` table, `analyze-accounting-profile` edge function, Settings UI tab (commit `df7752d`)
- **Phase 2: Dashboard Command Center** — Pipeline metric cards, upcoming publications timeline, recent documents, AI insights placeholder (commit `2344294`)
- **Landing Page Redesign** — Animated hero, bento grid, stats counter, pricing table (commit `91f2bad`)
- **Dark Mode Contrast Fix** — 30+ readability issues fixed across 19 files (commit `60f7167`). See DESIGN_BRIEF.md §11 for color usage rules.

---

## Overview

This document defines all features in the Valrano project with their status, routes, critical assertions, and test coverage. Every feature with status "implemented" or "tested" must have test files referenced below.

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

**Note (2026-08-17):** No password gate component exists in `src/` anymore — the app now uses Supabase auth (F-002) plus a waitlist modal (`src/features/waitlist/`). E2E specs still set `bs_unlocked` in localStorage as a legacy bypass. This feature is effectively obsolete; kept as planned until formally removed or re-scoped.

**Critical Assertions:**
1. Shows gate form on first visit
2. Rejects incorrect passwords
3. Unlocks with correct password
4. Renders children when unlocked

---

### F-002: User Authentication

**Status:** tested
**Route:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/verify`, `/auth/confirm`
**Components:** `src/pages/auth/*.tsx`, `src/contexts/AuthContext.tsx`, `src/components/auth/ProtectedRoute.tsx`

**Description:** Supabase email auth: password sign-in, OTP (6-digit), password reset, and email change flows. Protected routes redirect unauthenticated users to `/login`; deleted accounts are detected server-side and signed out. Custom SMTP via Metanet (`send-auth-email` edge function).

**Critical Assertions:**
1. Sign up creates account and sends verification
2. Login with email + password; OTP verification supported
3. Auth state persists across page reloads (Supabase session)
4. Sign out clears session; protected routes guard access

**Test Files:**
- Unit: `src/hooks/__tests__/useAuth.test.ts`
- E2E: `e2e/auth-flows.spec.ts` (all 7 auth routes + protected-route guards), `e2e/auth.setup.ts`

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

**Status:** implemented
**Route:** `/uploaded-reports/:id` (uploaded report detail), `/reports/:id` (generated report detail)
**Components:** `src/pages/UploadedReportPage.tsx`, `src/pages/ReportViewerPage.tsx`

**Description:** Uploaded-report view showing report metadata (title, company, type, FY, status badge), all extracted KPIs with per-value confidence scores (amber below 0.85, green at/above), source labels per value, and a "View PDF" button that opens a signed URL for the source PDF. Pending/processing states shown while extraction runs. Generated benchmark/custom report content is shown by `ReportViewerPage`.

**Critical Assertions:**
1. Displays all KPIs extracted from the report
2. Shows confidence scores per value, color-coded by the 0.85 review threshold
3. Source PDF accessible via signed URL
4. Pending/processing states communicated

**Test Files:**
- Component: `src/pages/__tests__/UploadedReportPage.test.tsx`

---

### F-006: PDF Upload & Extraction

**Status:** implemented
**Route:** `/upload`
**Components:** `src/pages/UploadPage.tsx`

**Description:** PDF upload with Vision-LLM extraction progress. Shows confidence scores and review queue for values below 0.85. Implemented as the `UploadReportDialog` component (`src/components/upload-report-dialog.tsx`); the standalone `/upload` route now redirects to `/competitors`.

**Critical Assertions:**
1. Accepts PDF files only
2. Shows extraction progress
3. Displays confidence scores
4. Queues low-confidence values for review

**Test Files:**
- Component: `src/components/__tests__/upload-report-dialog.test.tsx`
- E2E: `e2e/features.spec.ts` (F-006: Upload)

---

### F-007: KPI Normalization Engine

**Status:** implemented
**Route:** N/A (backend)
**Components:** `supabase/functions/normalize-kpis/index.ts`, trigger migration `supabase/migrations/20260516000000_auto_normalize_trigger.sql`

**Description:** Normalizes extracted KPI values after extraction: currency conversion via `fx_rates` using the correct rate type per KPI class (period_average for P&L KPIs, point-in-time/daily_close for balance-sheet KPIs, no conversion for ratios/percentages/volumes). Writes normalized values back to `kpi_values`.

**Critical Assertions:**
1. Converts currencies using correct FX rate type (period-average for P&L, point-in-time for BS)
2. Ratio/percentage/volume KPIs are not currency-converted
3. Edge function authenticates requests and validates `report_id`

**Note (2026-08-17):** Coverage is an integration reachability/auth test only. The FX-conversion math itself (rate-type selection, conversion result) has no unit test yet — add one when the classification logic is extracted into a testable module.

**Test Files:**
- Integration: `tests/integration/critical-paths.test.ts` (normalize-kpis reachable + authenticates)

---

### F-008: Peer Group Management

**Status:** implemented
**Route:** `/competitors` (replaces `/settings/peer-groups`; `/peers` redirects here)
**Components:** `src/pages/CompetitorsPage.tsx`, `src/hooks/useMyCompany.ts`, `src/hooks/useData.ts`

**Description:** Manage the user's peer set: add companies (search via `company-lookup` / `suggest-competitors` edge functions), remove peers with confirmation, organize via `peer_groups` + `peer_group_members` tables, per-peer monitoring status, and per-peer report upload.

**Critical Assertions:**
1. Add a company to the peer group (search + select flow)
2. Remove a peer with confirmation
3. Peer list renders with company info and monitoring status

**Test Files:**
- E2E: `e2e/authenticated/feature-gaps.spec.ts` (COMP-002: add competitor full flow), `e2e/authenticated/upload-dialog.spec.ts` (per-peer upload)

---

### F-009: Email Alerts

**Status:** planned
**Route:** `/settings/alerts`
**Components:** TBD

**Description:** Configure and receive email alerts when peers publish new reports or anomalous values detected.

**Note (2026-08-17):** Backend pieces exist (`monitor-publications`, `check-publication`, `insights-digest`, `send-document-notification` edge functions; in-app `NotificationBell`), but there is no user-facing alert configuration UI and no peer-publication email alert flow. Stays planned.

**Critical Assertions:**
1. Enable/disable alerts per type
2. Configure alert scope (peer group or company)
3. Email sent on trigger

---

### F-010: Company Management

**Status:** implemented
**Route:** `/competitors` (peer companies), `/my-company` (own company), `/companies/:id` (detail)
**Components:** `src/pages/CompetitorsPage.tsx`, `src/pages/MyCompanyTabsPage.tsx`, `src/pages/CompanyProfilePage.tsx`

**Description:** View and manage tracked companies. List peer companies with logos, tickers, and monitoring status; add via company search; remove peers; manage own company profile with inline editing; view per-company detail pages with KPI summary and publication history.

**Critical Assertions:**
1. List all tracked companies
2. View company details (F-017)
3. Edit own company profile inline (MYCO-002)

**Test Files:**
- E2E: `e2e/authenticated/my-company.spec.ts`, `e2e/authenticated/company-profile.spec.ts`, `e2e/authenticated/feature-gaps.spec.ts` (COMP-002)

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

**Note (2026-08-17):** `fx_rates` table exists and is seeded for CHF pairs (migration `20260504100001_seed_fx_rates.sql`) and consumed by `normalize-kpis` (F-007). No daily auto-fetch job and no manual-override UI exist yet. Stays planned.

**Critical Assertions:**
1. Daily rates available for CHF/EUR, CHF/USD, CHF/GBP
2. Period-average rates calculated correctly
3. Manual override possible

---

### F-013: Data Export (CSV)

**Status:** implemented
**Route:** `/analytics` (per-panel export buttons), `/reports/:id` (report content export)
**Components:** `src/pages/AnalyticsPage.tsx` (`downloadCsv`), `src/pages/ReportViewerPage.tsx`

**Description:** Export comparison data as CSV. Analytics panels (trends, CAGR, pivot table, heatmap) each offer an Export button producing a CSV of the visible data with headers; generated reports can be exported as CSV from the report viewer. Excel export is not implemented.

**Critical Assertions:**
1. CSV export contains all visible data (headers + company rows)
2. Export reflects the currently displayed panel data

**Test Files:**
- Component: `src/pages/__tests__/AnalyticsExport.test.tsx`

---

### F-014: Landing Page

**Status:** tested
**Route:** `/`
**Components:** `src/pages/LandingPage.tsx`

**Description:** Marketing homepage with animated hero, problem/solution sections, features, enterprise pricing teaser (no public tier prices), FAQ, and CTA opening the waitlist modal ("Registrations are paused") instead of a public signup. Redirects authenticated users to `/dashboard`.

**Critical Assertions:**
1. Hero section renders with correct copy
2. All content sections display
3. CTA buttons open the demo/waitlist flow
4. No tier pricing displayed publicly

**Test Files:**
- Component: `src/pages/__tests__/LandingPage.test.tsx`

---

### F-015: Settings & Billing

**Status:** implemented
**Route:** `/settings` (Team, Approval Chains, Admin tabs), `/account` (subscription view)
**Components:** `src/pages/SettingsPage.tsx`, `src/pages/AccountPage.tsx`

**Description:** Settings hub with tabs for Team management and Approval Chains, plus a super-admin-only Admin tab (F-018). The Account page shows the current subscription tier. Stripe billing portal is NOT yet wired — the "Manage Subscription" button is disabled ("coming soon"); `billing-portal` edge function exists but is not called from the UI.

**Critical Assertions:**
1. Settings page loads with tab navigation
2. Admin tab visible only to super admin
3. Subscription tier displayed on account page

**Test Files:**
- Component: `src/pages/__tests__/SettingsPage.test.tsx`
- E2E: `e2e/authenticated/settings.spec.ts`

---

### F-016: User Profile

**Status:** implemented
**Route:** `/account` (replaces `/settings/profile`)
**Components:** `src/pages/AccountPage.tsx`

**Description:** Account page with profile section (avatar initials, email, last sign-in), change email and change password flows with strength meter, subscription tier view, preferences (theme, default fiscal year persisted in localStorage), and danger-zone account deletion with typed confirmation. Full name / job title are captured during signup/onboarding, not edited here.

**Critical Assertions:**
1. View profile data (email, last sign-in)
2. Change email and password flows
3. Theme + default fiscal year preferences persist

**Test Files:**
- Component: `src/pages/__tests__/AccountPage.test.tsx`
- E2E: `e2e/authenticated/account.spec.ts`

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

**Test Files:**
- E2E: `e2e/authenticated/company-profile.spec.ts`

---

### F-018: Dev Tools Panel (DevTierSwitcher)

**Status:** implemented
**Route:** Global (floating bottom-right, z-9999)
**Components:** `src/components/dev/DevTierSwitcher.tsx`, `src/lib/dev-flags.ts`

**Description:** The standalone `DevTierSwitcher` floating panel was removed (see `src/components/layout/AppLayout.tsx`: "DevTierSwitcher removed — admin controls moved to Settings > Admin tab"). Its functionality now lives in the Admin panel (`src/pages/AdminPage.tsx`), gated to `SUPER_ADMIN_EMAIL` (`roger@mueller.ro`): (1) Tier Override — switch subscription tier via `admin_update_tier` RPC. (2) News Gathering — per-user localStorage toggle that blocks the `useFetchNews` mutation. (3) IR Catalog auto-scan toggle. Lists all users from the `admin_list_users` RPC.

**Critical Assertions:**
1. Only visible when logged in as the super admin (access denied otherwise)
2. Tier switches trigger the `admin_update_tier` mutation (invalidates subscription cache)
3. News toggle persists in localStorage and blocks `useFetchNews` mutation
4. User list loads with name + company display

**Test Files:**
- Component: `src/pages/__tests__/AdminPage.test.tsx`

---

### F-019: AI Insights Source Transparency

**Status:** implemented
**Route:** `/dashboard`
**Components:** `src/pages/DashboardPage.tsx`

**Description:** Each AI insight displays full provenance: linked company name with ticker, KPI code badge linked to analytics page, fiscal year, generation timestamp, and a "Sources:" line with 3 clickable links (Uploaded Reports, Company Profile, KPI Analytics). Ensures managers can verify every AI-generated claim.

**Critical Assertions:**
1. Company name links to `/companies/:id`
2. KPI badge links to `/analytics?kpi=...`
3. Fiscal year and generation timestamp shown for provenance
4. All external references are verifiable

Note: the current implementation renders per-insight provenance (linked company, linked KPI badge, fiscal year, generation time) rather than a fixed "Sources:" line with 3 links.

**Test Files:**
- Component: `src/pages/__tests__/DashboardInsights.test.tsx`

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

**Test Files:**
- Component: `src/pages/__tests__/DocumentViewerPage.test.tsx`

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

**Test Files:**
- Component: `src/pages/__tests__/NewsPage.test.tsx`

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

**Test Files:**
- Component: `src/pages/__tests__/DashboardInsights.test.tsx`
