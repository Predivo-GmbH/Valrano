# BenchmarkSignal — Manual Test Plan

**Created:** 2026-05-04
**Status:** Not yet executed
**Purpose:** Thoroughly verify all implemented features before moving to Phase 4 (Marketing)

---

## Recommended Execution Order

**A → B → C → D → E → F → G → H → I → K**

Phase J overlaps with C/D/F so it's mostly covered. Phase F (Upload) is the most critical to test with a real PDF — ideally a public annual report from one of the seeded companies (e.g., Holcim, Nestle, or ABB).

---

## Phase A: Public Landing Page (no login required)

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| A1 | Landing loads | Visit https://benchmarksignal.predivo.ch | Full landing page renders — Hero, Problem, Solution, Features, Pricing, FAQ, CTA footer | |
| A2 | Nav links | Click Features, Pricing, FAQ in nav | Smooth-scrolls to each section | |
| A3 | Mobile nav | On phone (or resize to 375px): tap hamburger icon | Mobile menu opens with all nav links | |
| A4 | Demo CTA | Click "Request a Demo" on any pricing card | Opens email client with pre-filled mailto:roger@predivo.ch | |
| A5 | FAQ accordion | Click each FAQ question | Answer expands/collapses, only one open at a time | |
| A6 | Sign in link | Click "Sign in" in footer or nav | Navigates to /login (hits PasswordGate) | |
| A7 | Create Account | Click "Get Started" or "Create Account" | Navigates to /signup (hits PasswordGate) | |

---

## Phase B: Password Gate

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| B1 | Gate blocks | Navigate to /login or /signup | PasswordGate form appears ("Private beta — enter the access code") | |
| B2 | Wrong password | Enter "wrong123", click Enter | "Incorrect password" error appears | |
| B3 | Correct password | Enter "BenchPilot2026", click Enter | Gate unlocks, login/signup page renders | |
| B4 | Persists in session | Reload the page | Still unlocked (no gate re-prompt) | |
| B5 | New session resets | Open incognito/new browser | Gate appears again | |

---

## Phase C: Authentication — Sign Up

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| C1 | Signup form | Navigate to /signup | 3-step form: Email → Password → Verify | |
| C2 | Enter email | Enter a real email you can check | Proceeds to password step | |
| C3 | Password strength | Type a weak password (e.g., "abc") | Strength meter shows weak, submit disabled or warns | |
| C4 | Strong password | Enter a strong password (8+ chars, mixed) | Strength meter shows strong, can proceed | |
| C5 | OTP sent | Submit signup form | "Check your email" message, 6-digit OTP code arrives in inbox | |
| C6 | OTP input | Enter the 6-digit code | Auto-submits on last digit, redirects to /dashboard | |
| C7 | Welcome email | Check inbox | Welcome email from noreply@predivo.ch arrives | |
| C8 | Subscription created | Verify in Supabase dashboard | User has "starter" tier subscription in subscriptions table | |

---

## Phase D: Authentication — Login

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| D1 | Password login | Sign out → /login → Password tab → enter email+password | Redirects to /dashboard | |
| D2 | Wrong password | Enter correct email, wrong password | Error: "Invalid login credentials" | |
| D3 | OTP login | Switch to "Email Code" tab → enter email → Send | OTP arrives in inbox | |
| D4 | OTP verify | Enter 6-digit code from email | Redirects to /dashboard | |
| D5 | Resend timer | On OTP verify screen, observe resend button | Countdown timer (60s), then "Resend code" becomes clickable | |
| D6 | Forgot password | Click "Forgot password?" → enter email → submit | Password reset email arrives | |
| D7 | Reset password | Click link in reset email → enter new password | Password updated, can login with new password | |

---

## Phase E: App — Dashboard

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| E1 | Dashboard loads | Navigate to /dashboard (logged in) | Peer comparison table renders with seeded companies | |
| E2 | KPI data | Check table content | Shows financial KPIs (Revenue, EBITDA, etc.) with values | |
| E3 | Company rows | Verify company names | 16 seeded companies visible (Holcim, CRH, Heidelberg, etc.) | |
| E4 | Chart renders | Check if chart/visualization appears | Peer comparison chart renders without errors | |
| E5 | Mobile layout | View on phone or 375px | Table/cards stack properly, no horizontal overflow | |

---

## Phase F: App — Upload (test with a real PDF annual report)

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| F1 | Upload page | Navigate to /upload | Upload form renders (company selector, year, report type, file input) | |
| F2 | File selection | Select a real PDF annual report | File name appears, upload button enabled | |
| F3 | Upload + extraction | Click upload | Progress indicator shows, extraction starts via edge function | |
| F4 | Extraction result | Wait for completion | Extracted KPIs appear with confidence scores | |
| F5 | Low confidence flag | Check if any values show <0.85 confidence | Flagged values appear in amber/yellow | |

---

## Phase G: App — Review

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| G1 | Review page | Navigate to /review | Shows KPI values needing review (confidence <0.85) | |
| G2 | Review actions | Attempt to approve/edit/reject a value | Action completes, value removed from queue or updated | |

---

## Phase H: App — Navigation & Layout

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| H1 | Nav links | Click Dashboard, Upload, Review in sidebar | Navigates to correct page, active link highlighted | |
| H2 | User menu | Click user avatar/name in top-right | Dropdown shows email + Sign Out option | |
| H3 | Sign out | Click Sign Out | Redirects to /login, session cleared | |
| H4 | Protected routes | While signed out, visit /dashboard directly | Redirects to /login | |
| H5 | Mobile nav | On phone: tap hamburger in app layout | Mobile drawer opens with nav links | |
| H6 | Theme toggle | Toggle dark/light mode | UI switches theme, persists on reload | |

---

## Phase I: Stripe & Billing

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| I1 | Subscription check | After signup, verify in Supabase dashboard | subscriptions table has row with tier: 'starter', status: 'active' | |
| I2 | Billing portal | If billing portal link exists in app, click it | Redirects to Stripe customer portal | |

---

## Phase J: Edge Functions (direct verification)

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| J1 | send-welcome | Already tested in C7 | Welcome email delivered | |
| J2 | upload-report | Already tested in F3 | PDF stored in Supabase Storage | |
| J3 | extract-kpis | Already tested in F4 | KPIs extracted and saved | |
| J4 | stripe-webhook | Send test event from Stripe dashboard | Webhook processes without error | |
| J5 | delete-account | (Optional, destructive) Sign in → delete account | Account removed, redirected to landing | |

---

## Phase K: Email Delivery

| # | Test | Action | Expected Result | Pass? |
|---|------|--------|-----------------|-------|
| K1 | OTP email | Trigger via signup or login | Arrives from noreply@predivo.ch, contains 6-digit code | |
| K2 | Welcome email | Trigger via new signup | Arrives with BenchmarkSignal branding | |
| K3 | Password reset | Trigger via forgot password | Arrives with reset link | |
| K4 | Spam check | Check spam/junk folder | Emails land in inbox, not spam | |

---

## Test Results Summary

| Phase | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| A: Landing Page | 7 | | | |
| B: Password Gate | 5 | | | |
| C: Sign Up | 8 | | | |
| D: Login | 7 | | | |
| E: Dashboard | 5 | | | |
| F: Upload | 5 | | | |
| G: Review | 2 | | | |
| H: Navigation | 6 | | | |
| I: Stripe | 2 | | | |
| J: Edge Functions | 5 | | | |
| K: Email | 4 | | | |
| **Total** | **56** | | | |

---

## Prerequisites
- A real email address you can check (for OTP and welcome emails)
- A PDF annual report from a public company (for upload testing — e.g., Holcim, ABB, or Nestle)
- Access to Supabase dashboard (supabase@benchmarksignal.predivo.ch) to verify DB state
- Access to Stripe dashboard to verify webhook and subscription state
