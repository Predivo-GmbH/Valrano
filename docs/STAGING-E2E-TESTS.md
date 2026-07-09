# Valrano — Staging E2E Test Documentation

Total: **39 tests** (27 authenticated + 12 public)

---

## Authenticated Tests (`e2e/staging/authenticated.spec.ts`) — 27 tests

### Dashboard (4 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 1 | `dashboard loads after login` | Navigates to `/dashboard`, waits for network idle, verifies the URL contains `/dashboard`, and checks that the page body has meaningful content (length > 50 characters). |
| 2 | `no critical console errors on dashboard` | Listens for `console.error` events while loading `/dashboard`. Filters out known benign errors (supabase, 401, 403, favicon, Failed to fetch, X-Frame-Options). Asserts zero critical console errors remain. |
| 3 | `dashboard shows Valrano branding` | Loads `/dashboard` and verifies that a DOM element containing the text "Valrano" is visible within 10 seconds. |
| 4 | `sidebar navigation is visible` | Loads `/dashboard` and counts navigation links within `nav` or `aside` elements. Asserts at least 3 navigation links are present. |

### Navigation (2 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 5 | `all main nav links work without errors` | Navigates sequentially to 6 routes (`/competitors`, `/my-company`, `/analytics`, `/reports`, `/settings`, `/account`). For each route, verifies: (a) no redirect to `/login`, (b) no error boundary text "Something went wrong". |
| 6 | `redirect routes work correctly` | Tests 4 legacy redirects: `/peers` → `/competitors`, `/upload` → `/competitors`, `/calendar` → `/competitors`, `/documents` → `/reports`. Verifies each final URL contains the expected target path. |

### Competitors Page (4 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 7 | `competitors page loads` | Navigates to `/competitors`, verifies URL and that page body has content. |
| 8 | `add peer button is visible` | Loads `/competitors` and asserts a button with name matching `/add/i` is visible within 10 seconds. |
| 9 | `competitor search autocomplete opens` | Loads `/competitors`, clicks the "Add" button, then verifies at least one text input (for company search autocomplete) appears within 500ms. |
| 10 | `tabs are present on competitors page` | Loads `/competitors` and verifies the page body has substantial content (length > 100 characters), indicating tabs and interactive elements are rendered. |

### My Company Page (2 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 11 | `my company page loads` | Navigates to `/my-company`, verifies URL, checks body has content, and asserts no error boundary text. |
| 12 | `my company page has tabs` | Loads `/my-company` and counts elements with `role="tab"` or `button` tags. Asserts at least 1 tab/button exists. |

### Analytics Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 13 | `analytics page loads` | Navigates to `/analytics`, verifies URL, checks body has content, and asserts no error boundary text. |

### Reports Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 14 | `reports page loads` | Navigates to `/reports`, verifies URL, checks body has content, and asserts no error boundary text. |

### Settings Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 15 | `settings page loads with user info` | Navigates to `/settings`, verifies URL, checks body has content, and asserts no error boundary text. |

### Account Page (1 test)

| # | Test Name | Description |
|---|-----------|-------------|
| 16 | `account page shows subscription info` | Navigates to `/account` and checks the page body contains at least one subscription-related keyword: "starter", "professional", "enterprise", "subscription", "plan", or "account" (case-insensitive). |

### Onboarding Wizard (4 tests)

| # | Test Name | Description |
|---|-----------|-------------|
| 17 | `onboarding page loads without crash` | Temporarily un-dismisses onboarding via Supabase Auth API (`onboarding_dismissed: false`), navigates to `/onboarding`, verifies no error boundary, checks for wizard content ("Accounting Framework", "Valrano", or "Skip setup"), then re-dismisses onboarding. |
| 18 | `onboarding wizard shows step 1 (Accounting Framework)` | Un-dismisses onboarding, loads `/onboarding`, verifies Step 1 content: "Accounting Framework" text, upload UI (upload/drag/drop keywords), "Skip setup" button visible, and breadcrumb steps ("Add Competitors", "Analyze Reports", "Publication Schedule"). Re-dismisses after. |
| 19 | `onboarding skip setup works` | Un-dismisses onboarding, loads `/onboarding`, clicks "Skip setup" button, verifies navigation to `/dashboard` within 10 seconds. Re-dismisses after. |
| 20 | `onboarding step navigation works (breadcrumb clicks)` | Un-dismisses onboarding, loads `/onboarding`, verifies no error boundary, checks that the "Back" button is disabled on Step 1, and that the "Continue" button is visible. Re-dismisses after. |

### No Crashes on Any Page (7 tests — dynamically generated)

For each of the 7 authenticated routes (`/dashboard`, `/my-company`, `/competitors`, `/analytics`, `/reports`, `/settings`, `/account`):

| # | Test Name | Description |
|---|-----------|-------------|
| 21 | `/dashboard does not show error boundary` | Navigates to the route, listens for `pageerror` events, verifies body does not contain "Something went wrong" or "An unexpected error occurred", and asserts zero uncaught JS exceptions. |
| 22 | `/my-company does not show error boundary` | Same as above for `/my-company`. |
| 23 | `/competitors does not show error boundary` | Same as above for `/competitors`. |
| 24 | `/analytics does not show error boundary` | Same as above for `/analytics`. |
| 25 | `/reports does not show error boundary` | Same as above for `/reports`. |
| 26 | `/settings does not show error boundary` | Same as above for `/settings`. |
| 27 | `/account does not show error boundary` | Same as above for `/account`. |

---

## Public Tests (`e2e/staging/public.spec.ts`) — 12 tests

### Public Pages (12 tests)

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

*Generated 2026-05-27. Source files: `e2e/staging/authenticated.spec.ts`, `e2e/staging/public.spec.ts`.*
