# Valrano Feature Registry

**Purpose:** Single source of truth for every user-facing function and flow.
Each entry maps to one or more E2E test IDs. Features marked `NOT COVERED` need tests.

**Rule:** When adding, modifying, or removing any user-facing feature, update this file
AND add/update the corresponding E2E test in the same commit.

**Last updated:** 2026-05-28

---

## Auth Flows

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| AUTH-001 | Password login | Enter email + password → dashboard | — | NOT COVERED |
| AUTH-002 | OTP login | Enter email → receive code → enter OTP → dashboard | — | NOT COVERED |
| AUTH-003 | Registration | Enter email → OTP → set name + password → onboarding | — | NOT COVERED |
| AUTH-004 | Forgot password | Enter email → receive reset link | — | NOT COVERED |
| AUTH-005 | Reset password | Click link → enter new password → dashboard | — | NOT COVERED |
| AUTH-006 | Sign out | User menu → Sign out → landing page | — | NOT COVERED |
| AUTH-007 | Deleted user redirect | User deleted from backend → next page load → redirect to /login | — | NOT COVERED |
| AUTH-008 | Login page loads | /login has email input + submit | staging/public:3, auth-forms:1 | COVERED |
| AUTH-009 | Signup page loads | /signup has email input + submit | staging/public:4, auth-forms:2 | COVERED |
| AUTH-010 | Forgot password page loads | /forgot-password loads with form | auth-forms:3 | COVERED |
| AUTH-011 | Unauth redirect | /dashboard → /login when not logged in | staging/public:5, critical-path:3 | COVERED |

## Onboarding Flows

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ONB-001 | Wizard loads | /onboarding shows step 1 (Accounting Framework) | staging/auth:17-18 | COVERED |
| ONB-002 | Skip setup → banner visible | Click "Skip setup" → /dashboard → SetupProgressBanner visible | staging/auth:19 (partial — only checks redirect, not banner) | PARTIAL |
| ONB-003 | Skip setup → return to wizard | Skip → dashboard → click "Complete Setup" on banner → /onboarding | — | NOT COVERED |
| ONB-004 | Dismiss banner | Skip → dashboard → click X on banner → banner hidden | — | NOT COVERED |
| ONB-005 | Complete onboarding → no banner | Steps 1-4 complete → /dashboard → no banner | — | NOT COVERED |
| ONB-006 | Step 1: Upload report | Drop PDF → AI analysis → accounting profile created | — | NOT COVERED |
| ONB-007 | Step 2: Add competitors | Search + add competitors → saved to peer group | — | NOT COVERED |
| ONB-008 | Step 3: Analyze reports | View/download competitor reports from IR catalog | — | NOT COVERED |
| ONB-009 | Step 4: Publication schedule | Set dates manually or via AI suggest → finish setup | — | NOT COVERED |
| ONB-010 | Step navigation | Click breadcrumbs to jump between completed steps | staging/auth:20 | COVERED |
| ONB-011 | Skip schedule (step 4 only) | Click "Skip this step" on step 4 → dashboard | — | NOT COVERED |

## Dashboard

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| DASH-001 | Dashboard loads | /dashboard shows peer comparison table | staging/auth:1-4, features:1-5 | COVERED |
| DASH-002 | FY filter | Select fiscal year → table filters | features:3 (partial) | PARTIAL |
| DASH-003 | KPI category tabs | Click Financial/ESG/Operational → table filters | interactions:2 | COVERED |
| DASH-004 | Export PDF | Click "Export Brief" → PDF downloads | — | NOT COVERED |
| DASH-005 | Generate insights | Click "Generate Insights" → AI insights appear | — | NOT COVERED |
| DASH-006 | Insight actions | Bookmark / Mark acted / Dismiss an insight | — | NOT COVERED |
| DASH-007 | Sort columns | Click column header → table re-sorts | — | NOT COVERED |
| DASH-008 | Console errors | No JS errors on dashboard | staging/auth:2, smoke:3 | COVERED |

## My Company

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| MYCO-001 | Page loads with tabs | /my-company shows Profile, KPIs, Benchmark tabs | staging/auth:11-12, interactions:5 | COVERED |
| MYCO-002 | Inline field edit | Click sector/country/etc → edit → save | — | NOT COVERED |
| MYCO-003 | Upload report | Click "Upload Report" → dialog → upload PDF | — | NOT COVERED |
| MYCO-004 | Delete report | Click trash → confirm → report deleted | — | NOT COVERED |
| MYCO-005 | Retry extraction | Click retry on failed report → KPIs re-extracted | — | NOT COVERED |
| MYCO-006 | Manual KPI entry | Enter KPI values → save → toast success | — | NOT COVERED |
| MYCO-007 | Accounting profile analyze | Select report → "Analyze" → profile created | — | NOT COVERED |
| MYCO-008 | Accounting profile delete | Click delete → confirm → profile removed | — | NOT COVERED |

## Competitors / Peers

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| COMP-001 | Page loads | /competitors shows peer list or empty state | staging/auth:7-10 | COVERED |
| COMP-002 | Add competitor | Click "Add" → search → select → company added to peer group | staging/auth:9 (dialog opens only) | PARTIAL |
| COMP-003 | Remove competitor | Click trash → competitor removed from peer group | — | NOT COVERED |
| COMP-004 | Upload report for peer | Click "Upload Report" → dialog → upload PDF | — | NOT COVERED |
| COMP-005 | Tab switching | Click Competitors / Calendar / Review tabs | interactions:4 | COVERED |
| COMP-006 | Click company card | Click card → /companies/:id | — | NOT COVERED |
| COMP-007 | View mode toggle | Switch between grid and table view | — | NOT COVERED |

## Company Profile

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| PROF-001 | Page loads | /companies/:id shows company details | — | NOT COVERED |
| PROF-002 | Re-detect website | Click "Re-detect" → website URL updated | — | NOT COVERED |
| PROF-003 | Edit website URL | Click pencil → enter URL → save | — | NOT COVERED |
| PROF-004 | Auto-detect IR page | Click "Auto-detect" → IR URL found | — | NOT COVERED |
| PROF-005 | Edit IR URL | Click pencil → enter URL → save | — | NOT COVERED |
| PROF-006 | Add publication event | Click add → fill form → event created | — | NOT COVERED |

## Calendar

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| CAL-001 | Create event | Click "Add Event" → fill form → save | — | NOT COVERED |
| CAL-002 | AI suggest date | Click "AI Suggest Date" → date populated | — | NOT COVERED |
| CAL-003 | Inline date edit | Click date → change → save | — | NOT COVERED |
| CAL-004 | Inline time edit | Click time → change → save | — | NOT COVERED |
| CAL-005 | Delete event | Click trash → confirm → event deleted | — | NOT COVERED |
| CAL-006 | Check Now | Click "Check Now" → publication checked | — | NOT COVERED |
| CAL-007 | View mode toggle | Switch calendar / list view | — | NOT COVERED |
| CAL-008 | Suggest All Times | Click bulk suggest → times set for all | — | NOT COVERED |

## Review Queue

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| REV-001 | Approve single KPI | Click "Approve" on a row → value approved | — | NOT COVERED |
| REV-002 | Bulk approve | Select multiple → "Approve selected" → all approved | — | NOT COVERED |
| REV-003 | Flag for re-extraction | Click flag → value flagged | — | NOT COVERED |
| REV-004 | Confidence filter | Filter by confidence level | — | NOT COVERED |

## Analytics

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ANA-001 | Page loads | /analytics shows charts | staging/auth:13, interactions:6 | COVERED |
| ANA-002 | Tab switching | Click Trends / CAGR / Cross-Sectional | interactions:6 | COVERED |
| ANA-003 | Export CSV | Click "Export CSV" → file downloads | — | NOT COVERED |
| ANA-004 | KPI/company filter | Change filters → chart updates | — | NOT COVERED |

## Reports / Report Builder

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| RPT-001 | Page loads | /reports shows document list | staging/auth:14, interactions:7 | COVERED |
| RPT-002 | Create report | Click "New Report" → fill form → /reports/:id | interactions:7 (dialog opens only) | PARTIAL |
| RPT-003 | Generate benchmark doc | Click "Generate" → document generated | — | NOT COVERED |
| RPT-004 | Download branded report | Click "Download" → PDF downloads | — | NOT COVERED |
| RPT-005 | Delete report | Click trash → confirm → report deleted | — | NOT COVERED |
| RPT-006 | Tab filtering | Click All / Benchmark / Custom / Templates / Rules | — | NOT COVERED |

## Corporate Templates

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| TPL-001 | Upload template | Click "Upload" → file uploaded → placeholders parsed | — | NOT COVERED |
| TPL-002 | Map placeholders | Click "Map" → assign data sources → save | — | NOT COVERED |
| TPL-003 | Generate from template | Click "Generate" → file downloaded | — | NOT COVERED |
| TPL-004 | Delete template | Click trash → confirm → deleted | — | NOT COVERED |
| TPL-005 | Connect Google | Click "Connect" → OAuth → connected | — | NOT COVERED |
| TPL-006 | Disconnect Google | Click "Disconnect" → disconnected | — | NOT COVERED |
| TPL-007 | Add Google template | Click "Add" → enter URL → template added | — | NOT COVERED |

## Benchmark Rules

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| BRU-001 | Create rule | Click "Create Rule" → select KPIs → save | — | NOT COVERED |
| BRU-002 | Edit rule | Click pencil → modify → save | — | NOT COVERED |
| BRU-003 | Delete rule | Click trash → confirm → deleted | — | NOT COVERED |

## Settings

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| SET-001 | Page loads with tabs | /settings shows Team + Approval Chains | staging/auth:15, interactions:10 | COVERED |
| SET-002 | Invite team member | Enter email + role → "Add" → member added | — | NOT COVERED |
| SET-003 | Change member role | Dropdown → select new role → updated | — | NOT COVERED |
| SET-004 | Remove team member | Click "Remove" → confirm → removed | — | NOT COVERED |
| SET-005 | Create approval chain | Click "Create" → add steps → save | — | NOT COVERED |
| SET-006 | Edit approval chain | Click pencil → modify → save | — | NOT COVERED |
| SET-007 | Delete approval chain | Click trash → confirm → deleted | — | NOT COVERED |

## Account

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ACC-001 | Page loads | /account shows user info | staging/auth:16, interactions:8 | COVERED |
| ACC-002 | Change email | Click "Change Email" → enter new → verify | — | NOT COVERED |
| ACC-003 | Change password | Click "Change Password" → enter old + new → save | — | NOT COVERED |
| ACC-004 | Delete account | Click "Delete" → type DELETE → confirm → signed out | interactions:9 (button visible only) | PARTIAL |
| ACC-005 | Theme toggle | Click sun/moon → theme switches + persists | smoke:4 (checks dark default only) | PARTIAL |
| ACC-006 | Fiscal year setting | Select year → persists in localStorage | — | NOT COVERED |

## AI Chat

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| CHAT-001 | Send message | Type message → submit → streaming response | — | NOT COVERED |
| CHAT-002 | Delete chat session | Click delete → session removed | — | NOT COVERED |

## Global Layout

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| NAV-001 | Sidebar navigation | Click nav links → correct page loads | staging/auth:5, features:11 | COVERED |
| NAV-002 | Redirect routes | /peers→/competitors, /upload→/competitors, etc. | staging/auth:6 | COVERED |
| NAV-003 | User menu | Click avatar → dropdown with Account, Settings, Sign out | — | NOT COVERED |
| NAV-004 | Mobile hamburger | Click hamburger → nav drawer opens/closes | — | NOT COVERED |
| NAV-005 | Branding | "Valrano" logo visible in sidebar | staging/auth:3, features:12 | COVERED |

## Public Pages

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| PUB-001 | Landing page | / loads with hero + pricing | staging/public:1, auth-forms:7 | COVERED |
| PUB-002 | Privacy page | /privacy loads with content | staging/public:6, auth-forms:4 | COVERED |
| PUB-003 | Terms page | /terms loads with content | staging/public:7, auth-forms:5 | COVERED |
| PUB-004 | Imprint page | /imprint loads with content | staging/public:8, auth-forms:6 | COVERED |
| PUB-005 | 404 page | Unknown route → not-found page | staging/public:9, auth-forms:8 | COVERED |
| PUB-006 | Request demo | Fill form → submit → confirmation | — | NOT COVERED |
| PUB-007 | Accessibility (WCAG) | Landing page passes axe scan | accessibility:1 | COVERED |

## Upload Report Dialog (shared)

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| UPL-001 | Drag & drop PDF | Drop file → added to queue | — | NOT COVERED |
| UPL-002 | Click to browse | Click → file picker → select → added | — | NOT COVERED |
| UPL-003 | Upload & extract | Click "Upload & Extract" → progress → KPIs extracted | — | NOT COVERED |
| UPL-004 | Cancel upload | Click cancel during processing → stops | — | NOT COVERED |
| UPL-005 | Duplicate detection | Upload same file → confirm dialog | — | NOT COVERED |

## Edge Function Reachability

| ID | Feature | E2E Test | Status |
|----|---------|----------|--------|
| EF-001 | All 41 edge functions respond (not 404/500) | critical-path:5-45 | COVERED |
| EF-002 | Auth-protected functions reject no-auth | edge-fn-behavior:5-8 | COVERED |
| EF-003 | company-lookup returns valid shape | edge-fn-behavior:1 | COVERED |
| EF-004 | request-demo accepts valid input | edge-fn-behavior:2 | COVERED |
| EF-005 | stripe-webhook rejects bad signature | edge-fn-behavior:3 | COVERED |
| EF-006 | send-auth-email rejects bad signature | edge-fn-behavior:4 | COVERED |
| EF-007 | monitor-publications with service-role works | edge-fn-behavior:10 | COVERED |

---

## Coverage Summary

| Status | Count | Percentage |
|--------|-------|------------|
| COVERED | 38 | 35% |
| PARTIAL | 6 | 6% |
| NOT COVERED | 65 | 60% |
| **Total** | **109** | |

### Priority gaps (functional flows that catch regressions like the skip bug):

1. **ONB-002/003/004/005** — Onboarding skip + banner lifecycle (THE bug we just fixed)
2. **AUTH-001/002/003** — Login/registration flows (never tested end-to-end)
3. **AUTH-007** — Deleted user redirect (the other bug we just fixed)
4. **AUTH-006** — Sign out flow
5. **COMP-002 (full)** — Add competitor (dialog opens but submission not tested)
6. **ACC-004 (full)** — Delete account (button visible but flow not tested)
7. **CAL-001/005** — Calendar CRUD
8. **UPL-001/003** — Upload + extract pipeline
