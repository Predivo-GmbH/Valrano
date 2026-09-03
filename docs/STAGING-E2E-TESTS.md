# Valrano — Staging E2E Test Documentation

Total: **51 tests** — 39 authenticated + 11 public + 1 auth-setup project
(`auth.setup.ts` runs as its own Playwright project, so `npx playwright test` reports it
in the count: it printed `Running 42 tests` before this split and `Running 51 tests` after.)

---

## Authenticated Tests (`e2e/staging/authenticated.spec.ts`) — 39 tests

### Dashboard (4 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 1 | `dashboard loads after login` | Navigates to `/dashboard`, waits for network idle, verifies the URL contains `/dashboard`, and checks that the page body has meaningful content (length > 50 characters). |
| 2 | `no critical console errors on dashboard` | Listens for `console.error` events while loading `/dashboard`. Filters out known benign errors (supabase, 401, 403, favicon, Failed to fetch, X-Frame-Options). Asserts zero critical console errors remain. |
| 3 | `dashboard shows Valrano branding` | Loads `/dashboard` and verifies that a DOM element containing the text "Valrano" is visible within 10 seconds. |
| 4 | `sidebar navigation is visible` | Loads `/dashboard` and counts navigation links within `nav` or `aside` elements. Asserts at least 3 navigation links are present. |

### Navigation (11 tests — one per navigation)

Every route gets its own test on purpose. Playwright's `timeout` in
`playwright.staging.config.ts` is a **per-test** budget, so the single test that used to
walk seven routes gave all seven `goto` + `networkidle` pairs one 45s budget between them
while every other test here spends that budget on one navigation. It therefore passed on a
quiet runner (whole suite 1.5-2.0m) and failed on a busy one (same suite 8-9m), which is
what blocked the production promotion in run 33734154907. Splitting it kept every
assertion; no timeout was raised and no route was dropped.

| # | Test Name | Description |
|---|-----------|-------------|
| 5 | `/dashboard works without errors` | Navigates to `/dashboard`, waits for network idle, asserts the URL does not settle on `/login` (web-first, retrying) and that the body does not contain "Something went wrong". |
| 6 | `/competitors works without errors` | Same checks for `/competitors`. |
| 7 | `/my-company works without errors` | Same checks for `/my-company`. |
| 8 | `/analytics works without errors` | Same checks for `/analytics`. |
| 9 | `/reports works without errors` | Same checks for `/reports`. |
| 10 | `/settings works without errors` | Same checks for `/settings`. |
| 11 | `/account works without errors` | Same checks for `/account`. |
| 12 | `/peers redirects to /competitors` | Navigates to the legacy `/peers` path and asserts the final URL contains `/competitors`. |
| 13 | `/upload redirects to /competitors` | Same for `/upload`. |
| 14 | `/calendar redirects to /competitors` | Same for `/calendar` (lands on `/competitors?tab=calendar`). |
| 15 | `/documents redirects to /reports` | Same for `/documents`, expecting `/reports`. |

### Competitors Page (4 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 16 | `competitors page loads` | Navigates to `/competitors`, verifies URL and that page body has content. |
| 17 | `add peer button is visible` | Loads `/competitors` and asserts a button with name matching `/add/i` is visible within 10 seconds. |
| 18 | `competitor search autocomplete opens` | Loads `/competitors`, clicks the "Add" button, then verifies at least one text input (for company search autocomplete) appears. |
| 19 | `tabs are present on competitors page` | Loads `/competitors` and verifies the page body has substantial content (length > 100 characters), indicating tabs and interactive elements are rendered. |

### My Company Page (2 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 20 | `my company page loads` | Navigates to `/my-company`, verifies URL, checks body has content, and asserts no error boundary text. |
| 21 | `my company page has tabs` | Loads `/my-company` and counts elements with `role="tab"` or `button` tags. Asserts at least 1 tab/button exists. |

### Analytics Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 22 | `analytics page loads` | Navigates to `/analytics`, verifies URL, checks body has content, and asserts no error boundary text. |

### Reports Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 23 | `reports page loads` | Navigates to `/reports`, verifies URL, checks body has content, and asserts no error boundary text. |

### Settings Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 24 | `settings page loads with user info` | Navigates to `/settings`, verifies URL, checks body has content, and asserts no error boundary text. |

### Account Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 25 | `account page shows subscription info` | Navigates to `/account` and checks the page body contains at least one subscription-related keyword: "starter", "professional", "enterprise", "subscription", "plan", or "account" (case-insensitive). |

### Onboarding Wizard (6 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 26 | `onboarding page loads without crash` | Temporarily un-dismisses onboarding via the Supabase Auth API (`onboarding_dismissed: false`), navigates to `/onboarding`, verifies no error boundary, checks for wizard content ("Accounting Framework", "Valrano", or "Skip setup"), then re-dismisses onboarding. |
| 27 | `wizard shows step 1 (Accounting Framework)` | Un-dismisses onboarding, loads `/onboarding`, verifies Step 1 content: "Accounting Framework" text, the other three step labels, upload UI (upload/drag/drop keywords) and a visible "Skip setup" button. Re-dismisses after. |
| 28 | `skip setup shows SetupProgressBanner on dashboard` | Un-dismisses onboarding and clears the banner dismissal, clicks "Skip setup", waits for `/dashboard`, then asserts the "Complete Setup" banner is visible and the body matches `Setup \d/3 complete`. |
| 29 | `Complete Setup button on banner returns to wizard` | Skips setup to reach the dashboard, clicks "Complete Setup" on the banner, waits for `/onboarding` and asserts the wizard stepper ("Accounting Framework") becomes visible. |
| 30 | `dismissing banner with X hides it` | Skips setup to reach the dashboard, clicks the "Dismiss setup banner" X, asserts the banner disappears, reloads and asserts it stays hidden (persisted in localStorage + user metadata). |
| 31 | `step navigation works (breadcrumb clicks)` | Un-dismisses onboarding, loads `/onboarding`, verifies no error boundary, checks that the "Back" button is disabled on Step 1 and that the "Continue" button is visible. Re-dismisses after. |

### Auth Flows (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 32 | `sign out redirects to landing page` | Loads `/dashboard`, opens the "User menu" dropdown, clicks "Sign out", and asserts (web-first, retrying) that the browser leaves `/dashboard` and `/competitors`. |

### No Crashes on Any Page (7 tests — dynamically generated)

For each of the 7 authenticated routes (`/dashboard`, `/my-company`, `/competitors`, `/analytics`, `/reports`, `/settings`, `/account`):

| # | Test Name | Description |
|---|-----------|-------------|
| 33 | `/dashboard does not show error boundary` | Navigates to the route, listens for `pageerror` events, verifies body does not contain "Something went wrong" or "An unexpected error occurred", and asserts zero uncaught JS exceptions. |
| 34 | `/my-company does not show error boundary` | Same as above for `/my-company`. |
| 35 | `/competitors does not show error boundary` | Same as above for `/competitors`. |
| 36 | `/analytics does not show error boundary` | Same as above for `/analytics`. |
| 37 | `/reports does not show error boundary` | Same as above for `/reports`. |
| 38 | `/settings does not show error boundary` | Same as above for `/settings`. |
| 39 | `/account does not show error boundary` | Same as above for `/account`. |

---

## Public Tests (`e2e/staging/public.spec.ts`) — 11 tests

### Public Pages (11 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 1 | `landing page loads` | Navigates to `/` and verifies the page title contains "Valrano". |
| 2 | `dark mode is default` | Loads `/` and checks that the `<html>` element has the CSS class `dark`, confirming dark mode is the default theme. |
| 3 | `login page is accessible` | Navigates to `/login` and verifies a heading element is visible. |
| 4 | `signup page is accessible` | Navigates to `/signup` and verifies a heading element is visible. |
| 5 | `unauthenticated user cannot access dashboard` | Navigates to `/dashboard` without auth. Verifies that the user is either redirected to `/login` or `/auth`, shown a login prompt ("Sign in"/"Log in"), or shown a PasswordGate ("access code"/"Private beta"). |
| 6 | `privacy page loads` | Navigates to `/privacy`, verifies page title contains "Privacy" (case-insensitive), and checks body content length > 50. |
| 7 | `terms page loads` | Navigates to `/terms`, verifies page title contains "Terms" (case-insensitive), and checks body content length > 50. |
| 8 | `imprint page loads` | Navigates to `/imprint`, verifies page title contains "Imprint" (case-insensitive), and checks body content length > 50. |
| 9 | `unknown route shows not-found page` | Navigates to `/nonexistent-route-xyz` and verifies the page renders content (body length > 10) rather than a blank page. |
| 10 | `no critical console errors on landing` | Listens for console errors on `/`, filters out benign errors (supabase, auth, 401, 403, favicon, X-Frame-Options), asserts zero critical errors. |
| 11 | `staging connects to staging Supabase (not production)` | Intercepts all network requests to `supabase.co` while loading `/login`. Verifies all requests go to the staging Supabase project (`vfwpcgdkrwqhdivfzmrg`) and NOT to the production project (`mkdeftmubrkseyrrbzvp`). |

---

*Generated 2026-05-27; authenticated section re-checked against the source files on 2026-09-03 (it had drifted: the Onboarding wizard had grown from 4 tests to 6 and the Auth Flows test was missing entirely, so the stated total was 39 when the suite ran 42). Source files: `e2e/staging/authenticated.spec.ts`, `e2e/staging/public.spec.ts`.*
