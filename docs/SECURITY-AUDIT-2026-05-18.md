# Valrano Security Audit Report

**Date:** 2026-05-18
**Scope:** Full security audit of valrano.com (formerly BenchmarkSignal)
**Auditors:** 8-domain parallel agent team
**Supabase Project:** mkdeftmubrkseyrrbzvp
**Production URL:** https://valrano.com

---

## Executive Summary

8 specialized security agents audited the entire Valrano implementation across authentication, edge functions, frontend, database RLS, Stripe integration, infrastructure, API exposure, and OWASP Top 10 compliance. **2 critical**, **3 high**, **~12 medium**, and **~15 low** findings were identified.

The most urgent issues are OAuth token exposure via the Data API and a fully open INSERT policy on the `companies` table.

---

## Findings by Severity

### CRITICAL (2)

#### C1: OAuth tokens exposed via Supabase Data API
- **Domain:** API Exposure / Database
- **Location:** `google_connections` table (columns: `access_token`, `refresh_token`)
- **Risk:** Any authenticated user can read all OAuth tokens from the Data API (`/rest/v1/google_connections`). These tokens grant access to users' Google Workspace (Slides, Sheets, Drive). Full account takeover of Google integrations.
- **Root Cause:** Table lacks row-level security restricting reads to `auth.uid() = user_id`.
- **Fix:** Add RLS policy: `CREATE POLICY "users_own_connections" ON google_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`

#### C2: `companies` table has fully open INSERT policy
- **Domain:** Database RLS
- **Location:** `companies` table, INSERT policy uses `WITH CHECK (true)`
- **Risk:** Any authenticated user can insert arbitrary company records, polluting the dataset and potentially impersonating real companies.
- **Fix:** Change to `WITH CHECK (auth.uid() = created_by)` or restrict to workspace membership.

---

### HIGH (3)

#### H1: Security headers not served on production
- **Domain:** Infrastructure
- **Location:** `public/.htaccess` (lines 1-25)
- **Risk:** `.htaccess` defines HSTS, CSP, X-Frame-Options, X-Content-Type-Options — but Metanet uses nginx, which ignores `.htaccess`. These headers are **never sent** to browsers. No clickjacking protection, no XSS mitigation via CSP, no HSTS.
- **Fix:** Configure headers in Metanet's nginx config (Plesk panel > Apache & nginx Settings > Additional nginx directives), or add a `_headers` file if supported, or inject via `<meta>` tags for CSP at minimum.

#### H2: Plain FTP deployment (no TLS)
- **Domain:** Infrastructure
- **Location:** `.github/workflows/deploy.yml` — `set ftp:ssl-allow no`
- **Risk:** Build artifacts (including any embedded secrets or API keys in the bundle) are transmitted in plaintext over the internet during every deploy.
- **Fix:** Change to `set ftp:ssl-allow yes; set ftp:ssl-force yes; set ssl:verify-certificate yes` or switch to SFTP if Metanet supports it.

#### H3: `document_status_log` RLS references revoked function
- **Domain:** Database RLS
- **Location:** `document_status_log` table RLS policy
- **Risk:** RLS policy calls a function that has been revoked/dropped. This could cause all queries to this table to fail or — worse — default to permissive access depending on Supabase's error handling.
- **Fix:** Verify the function exists. If removed intentionally, update the RLS policy to use a direct `auth.uid()` check instead.

---

### MEDIUM (12)

#### M1: Stale redirect URL in Supabase Auth
- **Location:** Auth config `uri_allow_list`
- **Detail:** `benchmarksignal.predivo.ch/**` is still in the allowed redirect list.
- **Risk:** If the old domain is ever re-registered by someone else, they could intercept auth redirects.
- **Fix:** Remove `benchmarksignal.predivo.ch/**` from `uri_allow_list` via Management API.

#### M2: No session inactivity timeout
- **Location:** Supabase Auth config
- **Detail:** Sessions never expire from inactivity. A token stolen from an idle session remains valid indefinitely (until refresh token expiry).
- **Fix:** Set `security_manual_linking_enabled` and configure `sessions.timebox` or implement client-side idle detection that calls `supabase.auth.signOut()`.

#### M3: Password minimum length mismatch
- **Location:** Supabase Auth config (`min_password_length: 6`) vs frontend validation (`minLength: 8`)
- **Risk:** Direct API calls bypass frontend validation, allowing 6-character passwords.
- **Fix:** Set `min_password_length: 8` in Supabase Auth config via Management API.

#### M4: Password change without reauthentication
- **Location:** Settings page / Supabase Auth config
- **Detail:** `supabase.auth.updateUser({ password })` doesn't require the current password.
- **Risk:** If a session is hijacked, attacker can change the password without knowing the original.
- **Fix:** Add current password field in UI, verify via `supabase.auth.signInWithPassword()` before calling `updateUser`.

#### M5: Non-timing-safe signature comparison
- **Location:** `supabase/functions/send-auth-email/index.ts` line 28
- **Detail:** Uses `===` to compare webhook signature instead of a constant-time comparison.
- **Risk:** Theoretical timing attack to forge webhook signatures (low practical risk since hook is currently disabled).
- **Fix:** Use `crypto.timingSafeEqual()` or equivalent.

#### M6: RPC function name leakage
- **Location:** Supabase Data API error responses
- **Detail:** When calling non-existent RPCs, error messages hint at existing function names.
- **Risk:** Attacker can enumerate internal function names to find attack surface.
- **Fix:** Limited mitigation — consider wrapping sensitive RPCs behind edge functions instead of exposing via Data API.

#### M7: No rate limiting on edge functions
- **Location:** All 38 edge functions
- **Detail:** No rate limiting at the edge function or API gateway level.
- **Risk:** Brute force attacks on auth, API abuse, cost amplification (especially AI-calling functions like `ai-chat`, `generate-insights`).
- **Fix:** Implement rate limiting via Supabase's built-in rate limiter or add a Redis-based counter in edge functions. Priority: auth-related and AI-calling functions.

#### M8: Wildcard CORS on Supabase Data API
- **Location:** Supabase project config
- **Detail:** Data API returns `Access-Control-Allow-Origin: *` by default (Supabase behavior).
- **Risk:** Any website can make authenticated requests if it obtains a valid JWT.
- **Fix:** Limited mitigation — Supabase doesn't support custom CORS on Data API. Mitigate by keeping JWTs secure and using short expiry.

#### M9: Open signup endpoint
- **Location:** Supabase Auth config
- **Detail:** Anyone can sign up — no email domain restriction, no invite-only mode.
- **Risk:** Attackers can create accounts to probe internal features and data.
- **Fix:** If Valrano is not a public signup product, enable invite-only mode. If it is, add email verification enforcement and consider domain allowlisting.

#### M10: Unnecessary CSP connect-src entry
- **Location:** `public/.htaccess` CSP header (not currently served — see H1)
- **Detail:** `api.anthropic.com` is in `connect-src` but the frontend never calls Anthropic directly (edge functions do).
- **Risk:** If CSP were enforced, this would widen the attack surface unnecessarily.
- **Fix:** Remove `api.anthropic.com` from `connect-src`.

#### M11: Missing ownership checks in edge functions
- **Location:** `check-publication`, `digest-company-news`, `fetch-company-news`
- **Detail:** These functions accept a `company_id` parameter but don't verify the authenticated user owns/has access to that company.
- **Risk:** Any authenticated user can trigger operations on any company's data.
- **Fix:** Add `visible_company_ids()` check or workspace membership verification before processing.

#### M12: `verify_jwt` disabled on all edge functions
- **Location:** All 38 functions deployed with `--no-verify-jwt`
- **Detail:** JWT verification is done in function code, but the Supabase gateway doesn't reject unauthenticated requests.
- **Risk:** Functions must each implement their own auth correctly. Any function that forgets to check auth is fully open.
- **Fix:** Audit each function to confirm it checks `Authorization` header. Consider enabling `verify_jwt` for functions that always require auth.

---

### LOW (15)

#### L1: No Content-Security-Policy via meta tags
- Even though .htaccess CSP isn't served (H1), no `<meta>` fallback exists in `index.html`.

#### L2: Source maps may be deployed to production
- Check if Vite build outputs `.map` files that get FTP-deployed.

#### L3: No Subresource Integrity (SRI) on CDN scripts
- External scripts (if any) lack `integrity` attributes.

#### L4: Console.log statements in production edge functions
- Several edge functions log request details that could leak sensitive data in Supabase logs.

#### L5: No audit logging for admin actions
- Admin operations (wipe data, manage users) aren't logged to an audit trail table.

#### L6: npm dependencies may have known vulnerabilities
- `npm audit` not run as part of CI pipeline.

#### L7: No CSRF protection on state-changing operations
- Supabase uses JWT (not cookies) so CSRF risk is low, but custom cookie usage should be verified.

#### L8: Email enumeration via auth endpoints
- Supabase signup/signin responses differ for existing vs non-existing emails.

#### L9: No account lockout after failed login attempts
- Unlimited password attempts possible via Supabase Auth API.

#### L10: Edge function error messages may leak internal details
- Some catch blocks return `error.message` directly to the client.

#### L11: `SEND_EMAIL_HOOK_SECRET` stored as edge function secret
- If hook is permanently disabled, remove the secret to reduce attack surface.

#### L12: No DMARC/SPF verification documented for valrano.com
- Email deliverability and anti-spoofing depend on proper DNS records.

#### L13: Stripe webhook endpoint doesn't verify event age
- Old/replayed events are processed without checking `event.created` timestamp.

#### L14: No automated security scanning in CI
- No SAST, dependency scanning, or secret detection in GitHub Actions.

#### L15: localStorage used for sensitive data
- Auth tokens in localStorage are accessible to any XSS — consider sessionStorage or httpOnly cookies via Supabase SSR.

---

## Fix Plan (Prioritized)

### Phase 1: Immediate (CRITICAL + HIGH) — Do First

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 1 | C1 | Add RLS policy on `google_connections`: `USING (auth.uid() = user_id)` | 5 min |
| 2 | C2 | Fix `companies` INSERT policy: `WITH CHECK (auth.uid() = created_by)` | 5 min |
| 3 | H3 | Fix or replace `document_status_log` RLS policy referencing revoked function | 15 min |
| 4 | H1 | Add security headers via Plesk nginx config or `<meta>` CSP fallback | 30 min |
| 5 | H2 | Enable FTP TLS in deploy.yml (`ftp:ssl-force yes`) | 5 min |

### Phase 2: Short-term (MEDIUM) — This Week

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 6 | M1 | Remove `benchmarksignal.predivo.ch/**` from redirect URIs | 5 min |
| 7 | M3 | Set `min_password_length: 8` in Supabase Auth config | 5 min |
| 8 | M4 | Add current password verification before password change | 30 min |
| 9 | M5 | Replace `===` with `crypto.timingSafeEqual()` in send-auth-email | 10 min |
| 10 | M7 | Add rate limiting to auth + AI edge functions | 2 hr |
| 11 | M11 | Add ownership checks to 3 edge functions | 1 hr |
| 12 | M12 | Audit all 38 functions for proper auth checks | 2 hr |
| 13 | M10 | Remove `api.anthropic.com` from CSP connect-src | 5 min |

### Phase 3: Hardening (LOW) — Next Sprint

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 14 | L2 | Disable source maps in production build | 5 min |
| 15 | L4 | Remove/gate console.log in edge functions | 1 hr |
| 16 | L5 | Create `admin_audit_log` table | 1 hr |
| 17 | L6 | Add `npm audit` to CI pipeline | 15 min |
| 18 | L10 | Sanitize error messages in edge function responses | 1 hr |
| 19 | L12 | Verify/add SPF, DKIM, DMARC DNS records for valrano.com | 30 min |
| 20 | L13 | Add event age check in stripe-webhook | 15 min |
| 21 | L14 | Add GitHub Actions security scanning (CodeQL or similar) | 1 hr |

### Items NOT requiring action (accepted risk or Supabase limitation):
- M2 (session timeout) — Supabase doesn't support server-side idle timeout natively. Client-side mitigation optional.
- M6 (RPC name leakage) — Supabase limitation, low practical risk.
- M8 (wildcard CORS) — Supabase Data API limitation.
- M9 (open signup) — Business decision (Valrano is a signup product).
- L8 (email enumeration) — Supabase limitation.
- L9 (account lockout) — Supabase limitation.
- L15 (localStorage) — Standard Supabase client behavior.

---

## Summary

| Severity | Count | Immediate Action Required |
|----------|-------|--------------------------|
| CRITICAL | 2 | Yes — data exposure |
| HIGH | 3 | Yes — infrastructure gaps |
| MEDIUM | 12 | This week |
| LOW | 15 | Next sprint |
| **Total** | **32** | |

**Estimated total fix effort:** ~12 hours across all phases.

Phase 1 (critical + high) can be completed in under 1 hour and should be done immediately.
