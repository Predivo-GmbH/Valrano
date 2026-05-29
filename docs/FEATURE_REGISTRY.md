# Valrano Feature Registry

**Purpose:** Single source of truth for every user-facing function and flow.
Each entry maps to one or more E2E test IDs. Features marked `NOT COVERED` need tests.

**Rule:** When adding, modifying, or removing any user-facing feature, update this file
AND add/update the corresponding E2E test in the same commit.

**Last updated:** 2026-05-29

---

## Auth Flows

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| AUTH-001 | Password login | Enter email + password → dashboard | auth-flows:1 | COVERED |
| AUTH-002 | OTP login | Enter email → receive code → enter OTP → dashboard | auth-flows:2 | COVERED |
| AUTH-003 | Registration | Enter email → OTP → set name + password → onboarding | auth-flows:3 | COVERED |
| AUTH-004 | Forgot password | Enter email → receive reset link | auth-flows:4 | COVERED |
| AUTH-005 | Reset password | Click link → enter new password → dashboard | auth-flows:5 | COVERED |
| AUTH-006 | Sign out | User menu → Sign out → landing page | staging/auth:AUTH-006 | COVERED |
| AUTH-007 | Deleted user redirect | User deleted from backend → next page load → redirect to /login | feature-gaps:AUTH-007 | COVERED |
| AUTH-008 | Login page loads | /login has email input + submit | staging/public:3, auth-forms:1 | COVERED |
| AUTH-009 | Signup page loads | /signup has email input + submit | staging/public:4, auth-forms:2 | COVERED |
| AUTH-010 | Forgot password page loads | /forgot-password loads with form | auth-forms:3 | COVERED |
| AUTH-011 | Unauth redirect | /dashboard → /login when not logged in | staging/public:5, critical-path:3 | COVERED |

## Onboarding Flows

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ONB-001 | Wizard loads | /onboarding shows step 1 (Accounting Framework) | staging/auth:17-18 | COVERED |
| ONB-002 | Skip setup → banner visible | Click "Skip setup" → /dashboard → SetupProgressBanner visible | staging/auth:19 | COVERED |
| ONB-003 | Skip setup → return to wizard | Skip → dashboard → click "Complete Setup" on banner → /onboarding | staging/auth:ONB-003 | COVERED |
| ONB-004 | Dismiss banner | Skip → dashboard → click X on banner → banner hidden | staging/auth:ONB-004 | COVERED |
| ONB-005 | Complete onboarding → no banner | Steps 1-4 complete → /dashboard → no banner | onboarding:ONB-005 | COVERED |
| ONB-006 | Step 1: Upload report | Drop PDF → AI analysis → accounting profile created | onboarding:ONB-006 | COVERED |
| ONB-007 | Step 2: Add competitors | Search + add competitors → saved to peer group | onboarding:ONB-007 | COVERED |
| ONB-008 | Step 3: Analyze reports | View/download competitor reports from IR catalog | onboarding:ONB-008 | COVERED |
| ONB-009 | Step 4: Publication schedule | Set dates manually or via AI suggest → finish setup | onboarding:ONB-009 | COVERED |
| ONB-010 | Step navigation | Click breadcrumbs to jump between completed steps | staging/auth:20 | COVERED |
| ONB-011 | Skip schedule (step 4 only) | Click "Skip this step" on step 4 → dashboard | onboarding:ONB-011 | COVERED |

## Dashboard

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| DASH-001 | Dashboard loads | /dashboard shows peer comparison table | staging/auth:1-4, features:1-5 | COVERED |
| DASH-002 | FY filter | Select fiscal year → table filters | dashboard-actions:DASH-002 | COVERED |
| DASH-003 | KPI category tabs | Click Financial/ESG/Operational → table filters | interactions:2 | COVERED |
| DASH-004 | Export PDF | Click "Export Brief" → PDF downloads | dashboard-actions:DASH-004 | COVERED |
| DASH-005 | Generate insights | Click "Generate Insights" → AI insights appear | dashboard-actions:DASH-005 | COVERED |
| DASH-006 | Insight actions | Bookmark / Mark acted / Dismiss an insight | dashboard-actions:DASH-006 | COVERED |
| DASH-007 | Sort columns | Click column header → table re-sorts | dashboard-actions:DASH-007 | COVERED |
| DASH-008 | Console errors | No JS errors on dashboard | staging/auth:2, smoke:3 | COVERED |

## My Company

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| MYCO-001 | Page loads with tabs | /my-company shows Profile, KPIs, Benchmark tabs | staging/auth:11-12, interactions:5 | COVERED |
| MYCO-002 | Inline field edit | Click sector/country/etc → edit → save | my-company:MYCO-002 | COVERED |
| MYCO-003 | Upload report | Click "Upload Report" → dialog → upload PDF | my-company:MYCO-003 | COVERED |
| MYCO-004 | Delete report | Click trash → confirm → report deleted | my-company:MYCO-004 | COVERED |
| MYCO-005 | Retry extraction | Click retry on failed report → KPIs re-extracted | my-company:MYCO-005 | COVERED |
| MYCO-006 | Manual KPI entry | Enter KPI values → save → toast success | my-company:MYCO-006 | COVERED |
| MYCO-007 | Accounting profile analyze | Select report → "Analyze" → profile created | my-company:MYCO-007 | COVERED |
| MYCO-008 | Accounting profile delete | Click delete → confirm → profile removed | my-company:MYCO-008 | COVERED |

## Competitors / Peers

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| COMP-001 | Page loads | /competitors shows peer list or empty state | staging/auth:7-10 | COVERED |
| COMP-002 | Add competitor | Click "Add" → search → select → company added to peer group | staging/auth:9, feature-gaps:COMP-002 | COVERED |
| COMP-003 | Remove competitor | Click trash → competitor removed from peer group | navigation:COMP-003 | COVERED |
| COMP-004 | Upload report for peer | Click "Upload Report" → dialog → upload PDF | feature-gaps:COMP-004 | COVERED |
| COMP-005 | Tab switching | Click Competitors / Calendar / Review tabs | interactions:4 | COVERED |
| COMP-006 | Click company card | Click card → /companies/:id | navigation:COMP-006 | COVERED |
| COMP-007 | View mode toggle | Switch between grid and table view | navigation:COMP-007 | COVERED |

## Company Profile

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| PROF-001 | Page loads | /companies/:id shows company details | company-profile:PROF-001 | COVERED |
| PROF-002 | Re-detect website | Click "Re-detect" → website URL updated | company-profile:PROF-002/003 | COVERED |
| PROF-003 | Edit website URL | Click pencil → enter URL → save | company-profile:PROF-002/003 | COVERED |
| PROF-004 | Auto-detect IR page | Click "Auto-detect" → IR URL found | company-profile:PROF-004/005 | COVERED |
| PROF-005 | Edit IR URL | Click pencil → enter URL → save | company-profile:PROF-004/005 | COVERED |
| PROF-006 | Add publication event | Click add → fill form → event created | company-profile:PROF-006 | COVERED |

## Calendar

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| CAL-001 | Create event | Click "Add Event" → fill form → save | calendar:CAL-001 | COVERED |
| CAL-002 | AI suggest date | Click "AI Suggest Date" → date populated | calendar:CAL-002 | COVERED |
| CAL-003 | Inline date edit | Click date → change → save | calendar:CAL-003/004 | COVERED |
| CAL-004 | Inline time edit | Click time → change → save | calendar:CAL-003/004 | COVERED |
| CAL-005 | Delete event | Click trash → confirm → event deleted | calendar:CAL-005 | COVERED |
| CAL-006 | Check Now | Click "Check Now" → publication checked | calendar:CAL-006 | COVERED |
| CAL-007 | View mode toggle | Switch calendar / list view | calendar:CAL-007 | COVERED |
| CAL-008 | Suggest All Times | Click bulk suggest → times set for all | calendar:CAL-008 | COVERED |

## Review Queue

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| REV-001 | Approve single KPI | Click "Approve" on a row → value approved | review-queue:REV-001 | COVERED |
| REV-002 | Bulk approve | Select multiple → "Approve selected" → all approved | review-queue:REV-002 | COVERED |
| REV-003 | Flag for re-extraction | Click flag → value flagged | review-queue:REV-003 | COVERED |
| REV-004 | Confidence filter | Filter by confidence level | review-queue:REV-004 | COVERED |

## Analytics

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ANA-001 | Page loads | /analytics shows charts | staging/auth:13, interactions:6 | COVERED |
| ANA-002 | Tab switching | Click Trends / CAGR / Cross-Sectional | interactions:6 | COVERED |
| ANA-003 | Export CSV | Click "Export CSV" → file downloads | analytics:ANA-003 | COVERED |
| ANA-004 | KPI/company filter | Change filters → chart updates | analytics:ANA-004 | COVERED |

## Reports / Report Builder

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| RPT-001 | Page loads | /reports shows document list | staging/auth:14, interactions:7 | COVERED |
| RPT-002 | Create report | Click "New Report" → fill form → /reports/:id | interactions:7, feature-gaps:RPT-002 | COVERED |
| RPT-003 | Generate benchmark doc | Click "Generate" → document generated | reports:RPT-003 | COVERED |
| RPT-004 | Download branded report | Click "Download" → PDF downloads | reports:RPT-004 | COVERED |
| RPT-005 | Delete report | Click trash → confirm → report deleted | reports:RPT-005 | COVERED |
| RPT-006 | Tab filtering | Click All / Benchmark / Custom / Templates / Rules | reports:RPT-006 | COVERED |

## Corporate Templates

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| TPL-001 | Upload template | Click "Upload" → file uploaded → placeholders parsed | corporate-templates:TPL-001 | COVERED |
| TPL-002 | Map placeholders | Click "Map" → assign data sources → save | corporate-templates:TPL-002 | COVERED |
| TPL-003 | Generate from template | Click "Generate" → file downloaded | corporate-templates:TPL-003 | COVERED |
| TPL-004 | Delete template | Click trash → confirm → deleted | corporate-templates:TPL-004 | COVERED |
| TPL-005 | Connect Google | Click "Connect" → OAuth → connected | corporate-templates:TPL-005/006, feature-gaps:TPL-005 | COVERED |
| TPL-006 | Disconnect Google | Click "Disconnect" → disconnected | corporate-templates:TPL-005/006, feature-gaps:TPL-006 | COVERED |
| TPL-007 | Add Google template | Click "Add" → enter URL → template added | feature-gaps:TPL-007 | COVERED |

## Benchmark Rules

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| BRU-001 | Create rule | Click "Create Rule" → select KPIs → save | reports:BRU-001 | COVERED |
| BRU-002 | Edit rule | Click pencil → modify → save | reports:BRU-002/003 | COVERED |
| BRU-003 | Delete rule | Click trash → confirm → deleted | reports:BRU-002/003 | COVERED |

## Settings

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| SET-001 | Page loads with tabs | /settings shows Team + Approval Chains | staging/auth:15, interactions:10 | COVERED |
| SET-002 | Invite team member | Enter email + role → "Add" → member added | settings-actions:SET-002 | COVERED |
| SET-003 | Change member role | Dropdown → select new role → updated | settings-actions:SET-003 | COVERED |
| SET-004 | Remove team member | Click "Remove" → confirm → removed | settings-actions:SET-004 | COVERED |
| SET-005 | Create approval chain | Click "Create" → add steps → save | settings-actions:SET-005 | COVERED |
| SET-006 | Edit approval chain | Click pencil → modify → save | settings-actions:SET-006/007 | COVERED |
| SET-007 | Delete approval chain | Click trash → confirm → deleted | settings-actions:SET-006/007 | COVERED |

## Account

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| ACC-001 | Page loads | /account shows user info | staging/auth:16, interactions:8 | COVERED |
| ACC-002 | Change email | Click "Change Email" → enter new → verify | account:ACC-002 | COVERED |
| ACC-003 | Change password | Click "Change Password" → enter old + new → save | account:ACC-003 | COVERED |
| ACC-004 | Delete account | Click "Delete" → type DELETE → confirm → signed out | account:ACC-004 | COVERED |
| ACC-005 | Theme toggle | Click sun/moon → theme switches + persists | account:ACC-005 | COVERED |
| ACC-006 | Fiscal year setting | Select year → persists in localStorage | account:ACC-006 | COVERED |

## AI Chat

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| CHAT-001 | Send message | Type message → submit → streaming response | chat:CHAT-001 | COVERED |
| CHAT-002 | Delete chat session | Click delete → session removed | chat:CHAT-002 | COVERED |

## Global Layout

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| NAV-001 | Sidebar navigation | Click nav links → correct page loads | staging/auth:5, features:11 | COVERED |
| NAV-002 | Redirect routes | /peers→/competitors, /upload→/competitors, etc. | staging/auth:6 | COVERED |
| NAV-003 | User menu | Click avatar → dropdown with Account, Settings, Sign out | navigation:NAV-003 | COVERED |
| NAV-004 | Mobile hamburger | Click hamburger → nav drawer opens/closes | navigation:NAV-004 | COVERED |
| NAV-005 | Branding | "Valrano" logo visible in sidebar | staging/auth:3, features:12 | COVERED |

## Public Pages

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| PUB-001 | Landing page | / loads with hero + pricing | staging/public:1, auth-forms:7 | COVERED |
| PUB-002 | Privacy page | /privacy loads with content | staging/public:6, auth-forms:4 | COVERED |
| PUB-003 | Terms page | /terms loads with content | staging/public:7, auth-forms:5 | COVERED |
| PUB-004 | Imprint page | /imprint loads with content | staging/public:8, auth-forms:6 | COVERED |
| PUB-005 | 404 page | Unknown route → not-found page | staging/public:9, auth-forms:8 | COVERED |
| PUB-006 | Request demo | Fill form → submit → confirmation | request-demo:PUB-006 | COVERED |
| PUB-007 | Accessibility (WCAG) | Landing page passes axe scan | accessibility:1 | COVERED |

## Upload Report Dialog (shared)

| ID | Feature | User Flow | E2E Test | Status |
|----|---------|-----------|----------|--------|
| UPL-001 | Drag & drop PDF | Drop file → added to queue | upload-dialog:UPL-001 | COVERED |
| UPL-002 | Click to browse | Click → file picker → select → added | upload-dialog:UPL-002 | COVERED |
| UPL-003 | Upload & extract | Click "Upload & Extract" → progress → KPIs extracted | upload-dialog:UPL-003 | COVERED |
| UPL-004 | Cancel upload | Click cancel during processing → stops | upload-dialog:UPL-004 | COVERED |
| UPL-005 | Duplicate detection | Upload same file → confirm dialog | upload-dialog:UPL-005 | COVERED |

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
| COVERED | 109 | 100% |
| PARTIAL | 0 | 0% |
| NOT COVERED | 0 | 0% |
| **Total** | **109** | |

All 109 features are now covered by E2E tests. The 14 previously uncovered gaps
(10 NOT COVERED + 4 PARTIAL) were resolved on 2026-05-29 using:
- **Supabase Admin API** for test user lifecycle (AUTH-007 deleted user redirect)
- **`page.setInputFiles()`** for file upload flows (UPL-001 through UPL-005, COMP-004)
- **Route interception** for OAuth flows (TPL-005 connect)
- **Pre-seeded DB records** via service_role for Google connection tests (TPL-006, TPL-007)
- **Full form interaction** for submission flows (COMP-002, RPT-002)
