# BenchmarkSignal Feature Registry

**Project:** BenchmarkSignal (Automated Competitive Benchmarking for Listed Corporations)
**Last Updated:** 2026-05-04
**Total Features:** 16
**Implemented:** 0 / Unit Tests: 0 files / E2E Tests: 0 spec files / Accessibility: 0 spec files

---

## Overview

This document defines all features in the BenchmarkSignal project with their status, routes, critical assertions, and test coverage. Every feature with status "implemented" or "tested" must have test files referenced below.

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

**Status:** planned
**Route:** Global (nav bar)
**Components:** TBD

**Description:** Dark mode default, light mode toggle. Stored in localStorage, respects system preference on first visit.

**Critical Assertions:**
1. Defaults to dark mode
2. Toggle switches theme and persists
3. Respects prefers-color-scheme on first visit

---

### F-004: Dashboard (Peer Comparison)

**Status:** planned
**Route:** `/dashboard`
**Components:** TBD

**Description:** Main app view showing peer comparison table/chart, KPI selector, peer group filter, ranking view. Core value delivery screen.

**Critical Assertions:**
1. Renders peer comparison table with all active companies
2. KPI selector filters displayed metrics
3. Peer group filter switches active group
4. Ranking view shows position per KPI

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

**Status:** planned
**Route:** `/upload`
**Components:** TBD

**Description:** PDF upload with Vision-LLM extraction progress. Shows confidence scores and review queue for values below 0.85.

**Critical Assertions:**
1. Accepts PDF files only
2. Shows extraction progress
3. Displays confidence scores
4. Queues low-confidence values for review

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

**Status:** planned
**Route:** `/review`
**Components:** TBD

**Description:** Queue of extracted KPI values with confidence below 0.85. Reviewer can approve, edit, or reject.

**Critical Assertions:**
1. Shows only values needing review
2. Displays source PDF context
3. Allows approve/edit/reject
4. Updates confidence and reviewer info

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
