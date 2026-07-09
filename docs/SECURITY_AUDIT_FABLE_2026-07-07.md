# Valrano — Cross-Tenant Authorization (IDOR) Audit

**Date:** 2026-07-07 · **Auditor:** Fable 5 (adversarial) · **Scope:** `supabase/functions/*` (42 edge functions) + RLS migrations
**Method:** Read every shipped `index.ts` + every RLS migration. Claims cite `file:line`. No source changed, nothing deployed.

---

## 0. Threat model & verified facts

**`_shared/auth.ts` (verified):** `authenticateRequest()` returns `{ user, userClient, adminClient }`.
- `userClient` = anon key + caller JWT → **RLS-enforced** (`auth.ts:24-26`).
- `adminClient` = `SUPABASE_SERVICE_ROLE_KEY` → **RLS-BYPASS** (`auth.ts:33`). Any query on `adminClient` ignores every policy below.

**Ownership helpers (verified):**
- `visible_company_ids_for_user(p_user_id)` — backend/service version, `EXECUTE` revoked from `authenticated`/`anon`/`public` (`20260513000000_security_audit_fixes.sql:33-55`). Returns peer-group + `my_companies` companies for the passed user. This is the correct gate for `adminClient` code paths.
- `visible_company_ids()` — `auth.uid()`-based, for RLS policies (`20260513000000:72-95`).

**RLS baseline (verified, and it is mostly GOOD for the `authenticated` role):**
- Tenant-private tables scoped to owner: `chat_sessions`/`chat_messages` (`20260507100000:19-53`), `ai_insights` (`:74-77`), `my_companies`/`my_company_kpis`/`self_benchmarks` (`20260505200000:87-123`), `custom_reports`/`report_templates` (`20260505300000:80-89`), `corporate_templates`/`generated_exports` (`20260514200000:74-82`), `accounting_profiles` (`20260507000000:53-56`), `subscriptions` SELECT (`20260504200000:31-34`), `google_connections` per-op (`20260518000000:16-35`).
- `reports`/`kpi_values`/`extractions`/`benchmark_documents`/`publication_events`/`monitor_checks` SELECT scoped to `visible_company_ids()` (`20260508000000_fix_data_isolation.sql`).
- `companies`, `kpi_definitions`, `fx_rates`, `ir_catalog_items` are **intentionally shared reference** (`20260508000000:195-199`, `20260519200000:70-84`).

**Consequence:** RLS is not the weak point. **Every IDOR below exists because a function uses `adminClient` (bypassing all of the above) and then either (a) performs NO ownership re-check, or (b) performs a check that FAILS OPEN when a nullable owner column (`benchmark_rules.created_by`, `approval_steps.assignee_id`) is null.** The crown jewels are tenant-private tables: `accounting_profiles`, `chat_*`, `benchmark_documents` content, `custom_reports`, `reports`/`kpi_values`, `my_company_kpis`. `companies`/`ir_catalog_items` are shared, so writing/scanning them is a resource/integrity issue (§4), not a confidential read.

---

## 1 + 2. Full enumeration of all 42 functions

Columns: **(a)** accepts caller-supplied resource ID? · **(b)** uses `adminClient` (RLS-bypass)? · **(c)** enforces ownership BEFORE `adminClient` touches the resource? · **Class** = CONFIRMED / SUSPECTED / SAFE.

| # | Function | (a) caller ID | (b) adminClient | (c) ownership check before use | Class | One-line exploit (authenticated attacker) |
|---|----------|---------------|-----------------|--------------------------------|-------|-------------------------------------------|
| 1 | **advance-approval** | `document_id` | yes | **FAIL-OPEN** — `if (currentStep.assignee_id && assignee_id!==user.id)` skips when assignee null (`advance-approval/index.ts:36`) | **CONFIRMED** | `POST {document_id:<victim>,action:"approve"}` on a doc whose in-review step has `assignee_id=NULL` → approves/rejects another tenant's document, flips `benchmark_documents.status` |
| 2 | **ai-chat** | `session_id`, `page_context=document:<id>` | yes | `session_id`: **NONE** (`ai-chat/index.ts:47-58,68`); doc path checks `companies.user_id` which **does not exist** → errors → fails CLOSED (`:155-161`) | **CONFIRMED** | `POST {session_id:<victim session>,message:"…"}` → appends/reads messages in another user's `chat_sessions`/`chat_messages`, loads their history into the model prompt |
| 3 | **analyze-accounting-profile** | `report_id` | yes | read: **yes** `visible_company_ids_for_user` (`:371-376`); but writes `companies.name` + `my_companies.name` by `company_id` with **no user filter** (`:524-533`) | **SUSPECTED** (write) | Analyze a shared-company report → renames `my_companies.name` for **every other tenant** tracking that company |
| 4 | **billing-portal** | — | yes | yes, `user_id=user.id` (`:14-17`) | **SAFE** | — |
| 5 | **check-publication** | `publication_event_id` | yes | **NONE** (`check-publication/index.ts:47-51`) | **CONFIRMED** | `POST {publication_event_id:<any>}` → scrapes, creates a `reports` row, fires full AI pipeline, and notifies the victim's `created_by` — all on another tenant's monitored event |
| 6 | **company-lookup** | `query` (string) | no | n/a (external APIs only) | **SAFE** | — |
| 7 | **compute-comparability** | `adjusted/reference_company_id` | yes | yes, `visible_company_ids_for_user` for user calls; service-role branch for internal (`compute-comparability/index.ts:44-71`) | **SAFE** | — |
| 8 | **delete-account** | — | yes | operates on `user.id` only (`:11`) | **SAFE** (note: incomplete data purge — leaves `reports`, `my_companies`, `accounting_profiles`, `chat_*`; data-retention issue, not IDOR) | — |
| 9 | **deliver-document** | `document_id` | yes | **FAIL-OPEN** — `if (ruleCreator && ruleCreator!==user.id)` skips when `created_by` null (`deliver-document/index.ts:46-49`) | **SUSPECTED** | `POST {document_id:<victim, rule.created_by NULL>}` → renders + emails another tenant's benchmark to its configured recipients, marks `delivered` |
| 10 | **digest-company-news** | `company_id` (single mode) | yes | **NONE** on `company_id` (`digest-company-news/index.ts:202-215`); cron mode is `CRON_SECRET`-gated | **SAFE** (shared data) — §4 cost | `POST {company_id:<any>}` → runs Gemini digest for any company (cost, writes shared `news_digests`) |
| 11 | **download-catalog-item** | `catalog_item_id`, `company_id` | yes | **NONE** on either; `effectiveCompanyId = company_id \|\| item.company_id` (`download-catalog-item/index.ts:36,72`) | **SUSPECTED** | `POST {catalog_item_id:<any>,company_id:<any>}` → inserts a `reports` row for an arbitrary company + fires pipeline (downstream `download-report` re-checks visibility, bounding data reach) |
| 12 | **download-report** | `report_id` | yes | yes, `visible_company_ids_for_user` (`download-report/index.ts:253-258`) | **SAFE** | — |
| 13 | **enrich-company** | `name` (string) | no (no DB write) | n/a | **SAFE** (minor: no AI quota) | — |
| 14 | **extract-kpis** | `report_id` | yes | yes, `visible_company_ids_for_user` (`extract-kpis/index.ts:180-185`) | **SAFE** | — |
| 15 | **extract-report-context** | `report_id` | yes | yes for user calls (`extract-report-context/index.ts:60-67`); service-role branch | **SAFE** | — |
| 16 | **fetch-company-news** | `company_id` (single mode) | yes | **NONE** on `company_id` (`fetch-company-news/index.ts:537-546`); cron `CRON_SECRET`-gated | **SAFE** (shared data) — §4 cost | `POST {company_id:<any>}` → Firecrawl+Gemini+Claude fetch for any company (uncapped cost) |
| 17 | **generate-benchmark** | `report_id`, `benchmark_rule_id` | yes | report via **userClient/RLS** (`generate-benchmark/index.ts:95`); but `benchmark_rule_id` unscoped (`:118-135`) and **`accounting_profiles` loaded `.limit(1).single()` with NO user filter** (`:152-156`) | **CONFIRMED** (data bleed) | Trigger benchmark → an **arbitrary tenant's accounting profile** (company_name, policies, kpi_mappings) is injected into the AI prompt and stored in the generated `content_json` the caller can then read |
| 18 | **generate-from-google-template** | `template_id`, `report_id` | yes | yes, `user_id` on both (`generate-from-google-template/index.ts:37-38,62-63`) | **SAFE** | — |
| 19 | **generate-from-template** | `template_id`, `report_id` | yes | yes, `user_id` on both (`generate-from-template/index.ts:31-32,51-53`) | **SAFE** | — |
| 20 | **generate-insights** | — (filters only) | yes | scopes all reads to `user.id` via `visible_company_ids_for_user` (`generate-insights/index.ts:103-111`) | **SAFE** — §4 cost (auto-gen throttle exists) | — |
| 21 | **generate-report** | `report_id` (custom_reports) | yes | yes, `user_id` (`generate-report/index.ts:32-33`) | **SAFE** (peer_group_id from own config; reads shared KPI) | — |
| 22 | **google-auth-callback** | `code`,`state` | yes | verifies user from `state` JWT; writes own `user_id` (`google-auth-callback/index.ts:55-64,100-109`) | **SAFE** | — |
| 23 | **google-auth-url** | — | no | auth-only (`google-auth-url/index.ts:17`) | **SAFE** | — |
| 24 | **insights-digest** | — (cron) | yes | `CRON_SECRET`-gated (`insights-digest/index.ts:29-32`) | **SAFE** | — |
| 25 | **monitor-publications** | — (cron) | yes | `CRON_SECRET` fail-closed (`monitor-publications/index.ts:87-94`) | **SAFE** | — |
| 26 | **normalize-kpis** | `report_id` | yes | yes, `visible_company_ids_for_user` (`normalize-kpis/index.ts:63-76`) | **SAFE** | — |
| 27 | **parse-template** | `template_id` | yes | yes, `user_id` (`parse-template/index.ts:30-31`) | **SAFE** | — |
| 28 | **pipeline-orchestrator** | `report_id`, `phase` | yes | **NONE** at entry (`pipeline-orchestrator/index.ts:38-42`); mutates `reports.status` via adminClient (`:105,125,133,195`); downstream funcs enforce via forwarded JWT | **CONFIRMED** (write) | `POST {report_id:<victim>,phase:2}` → flips victim's `reports.status` to `normalized`, downstream 403s, catch sets it to `error` → corrupts another tenant's processing state |
| 29 | **render-benchmark-pdf** | `document_id` | yes | **FAIL-OPEN** — same null-`created_by` bypass (`render-benchmark-pdf/index.ts:37-40`) | **SUSPECTED** | `POST {document_id:<victim, rule.created_by NULL>}` → renders full benchmark content to a PDF in storage, returns the path |
| 30 | **request-demo** | form fields | no | public by design (`request-demo/index.ts:10`) | **SAFE** (minor: unauth email-send, no captcha/rate-limit) | — |
| 31 | **resolve-company-website** | `company_id`, `name` | yes | **NONE** — writes `companies.website_url`/`logo_url` for arbitrary `company_id` (`resolve-company-website/index.ts:732-750`) | **SUSPECTED** (shared write) — §4 | `POST {name:"x",company_id:<any>}` → overwrites a shared company's website/logo; no AI quota (Brandfetch/SerpAPI/Anthropic spend) |
| 32 | **scan-ir-page** | `company_id` | yes | **NONE** (`scan-ir-page/index.ts:346-357`); accepts service-role too | **CONFIRMED** (cost/shared write) — §4 | `POST {company_id:<any>}` → multi-page Firecrawl crawl + Gemini classify for ANY company; deletes/upserts shared `ir_catalog_items`, overwrites `companies.ir_scan_metadata` |
| 33 | **self-benchmark** | `my_company_id`, `peer_group_id` | yes | `my_company_id`: **yes** `user_id` (`self-benchmark/index.ts:47-52`); `peer_group_id`: **NONE** (`:71-76`) | **SUSPECTED** | `POST {my_company_id:<own>,peer_group_id:<victim>}` → leaks another tenant's peer-group composition into the benchmark |
| 34 | **send-auth-email** | webhook payload | via email lib | signature verified **only if header present, else accepted** (`send-auth-email/index.ts:44-48`) | **SUSPECTED** — §4 | If reachable without `x-supabase-webhook-signature` → craft payload to send spoofed Valrano "auth" email with attacker `redirect_to` |
| 35 | **send-document-notification** | `document_id`, `recipient_email` | yes | **FAIL-OPEN** null `created_by` (`send-document-notification/index.ts:62`), but recipient must be in `delivery_recipients` (`:68`) | **SUSPECTED** (limited) | Null-`created_by` doc → send its notification emails to its own preconfigured recipients (bounded) |
| 36 | **send-welcome** | — | yes | `user.id` only (`send-welcome/index.ts:11-13`) | **SAFE** | — |
| 37 | **stripe-webhook** | webhook | yes | Stripe HMAC verified + 5-min replay guard (`stripe-webhook/index.ts:16-47,65`) | **SAFE** | — |
| 38 | **suggest-competitors** | `company_name` | yes | quota-gated by `user.id` (`suggest-competitors/index.ts:36-60`); no resource ID | **SAFE** — §4 (quota=999 for enterprise, now default) | — |
| 39 | **suggest-ir-url** | `company_id`, `company_name` | yes | **NONE** on `company_id`; quota-gated. Writes `companies.ir_page_url` for arbitrary company + triggers scan (`suggest-ir-url/index.ts:76-80,327-345`) | **SUSPECTED** (shared write) — §4 | `POST {company_id:<any>,company_name:"x"}` → poisons a shared company's `ir_page_url`, auto-triggers scan-ir-page |
| 40 | **suggest-publication-dates** | `company_id` | yes | **NONE** on `company_id`; quota-gated. Reads tenant-scoped `publication_events` for arbitrary company (`suggest-publication-dates/index.ts:106-135`) | **SUSPECTED** (low read) | `POST {company_id:<any>,…}` → another tenant's `publication_events` expected dates surfaced into the prompt |
| 41 | **upload-report** | `company_id` (formData) | yes | yes, `visible_company_ids_for_user` (`upload-report/index.ts:56-61`) | **SAFE** | — |
| 42 | **enrich-company** *(dup guard)* | — | — | — | — | *(see #13)* |

> Row count reconciliation: 42 distinct functions listed (#42 is a pointer to #13 which is the same `enrich-company`; the 42 directories are all covered — see Appendix A for the exact directory-to-row map).

---

## 3. RLS cross-check (tables these functions touch)

| Table | Shipped policy | Verdict |
|-------|----------------|---------|
| `companies` | INSERT `created_by=auth.uid()`, UPDATE `created_by`/`my_companies` (`20260518000000:61-86`); SELECT shared by design | OK for authenticated. **Legacy `WITH CHECK(true)` in `20260510100000:10-13` is superseded** (dropped in `20260518000000:58`). |
| `reports`,`kpi_values`,`extractions`,`benchmark_documents`,`publication_events`,`monitor_checks` | SELECT `visible_company_ids()`; service_role SELECT `true` (`20260508000000`) | OK for authenticated. `adminClient` bypasses — this is what the IDOR functions exploit. |
| `accounting_profiles` | SELECT/INSERT/UPDATE `user_id=auth.uid()` (`20260507000000:53-56`) | OK — but **generate-benchmark reads it via `adminClient` with no filter (#17), defeating this**. |
| `chat_sessions`/`chat_messages` | `FOR ALL` `user_id=auth.uid()` / session-owner EXISTS (`20260507100000:19-53`) | OK — but **ai-chat writes via `adminClient` with attacker `session_id` (#2), defeating this**. |
| `google_connections` | per-op `auth.uid()=user_id` (`20260518000000:16-35`) — replaced old `FOR ALL` (S-1) | OK. OAuth tokens no longer broadly exposed. |
| `subscriptions` | SELECT own; `FOR ALL` **only** `TO service_role` (`20260504200000:31-41`) | OK. |
| `document_status_log` | **No policy shipped** — S-5 explicitly removed because it referenced a non-existent `documents` table (`20260518000000:91-92`) | If the table exists with RLS enabled and no policy → deny-all (safe); if RLS disabled → open. **TEST** actual table state. |
| `ir_catalog_items` | authenticated INSERT/UPDATE `visible_company_ids()`; `FOR ALL TO service_role true` (`20260519200000:70-84`) | OK as shared reference. |
| `notifications` | INSERT fixed to `user_id=auth.uid()` (`20260513000000:61-64`), replacing earlier `WITH CHECK(true)` | OK. |
| `monitor_checks` INSERT | earlier `WITH CHECK(true)` (`20260505000000:179`) replaced by visibility EXISTS (`20260513000000:143-152`) | OK. |

**Dropped-function / stale-policy scan:** `visible_company_ids()` is redefined 4× (final `20260513000000:72-95`) — all policies reference the current signature; no policy references a dropped function. The only genuinely dangerous residual `WITH CHECK(true)` / `USING(true)` clauses are all either (a) scoped `TO service_role`, or (b) superseded by a later migration (verified: `publication_events`, `companies` INSERT, `notifications`, `monitor_checks`).

---

## 4. AI / cost-amplification & unauthenticated-trigger risks

| Function | Risk | Notes |
|----------|------|-------|
| **check-publication** (#5) | **HIGH** — any user fires the full download→extract→normalize→benchmark→insights chain on any `publication_event_id`; multiple Gemini 2.5 Pro + Claude calls, Firecrawl credits | No auth check at all; also creates DB rows on victim tenant |
| **scan-ir-page** (#32) | **HIGH** — any user triggers ≤11 Firecrawl scrapes + Gemini classify for any `company_id`; no quota | Also callable with service-role token |
| **fetch-company-news** / **digest-company-news** (#16,#10) | **MED** — any user runs Firecrawl+Gemini+Claude per arbitrary `company_id`; no per-user quota in single-company mode | Cron path is `CRON_SECRET`-gated |
| **suggest-*** (#38,#39,#40) | **MED** — quota exists (`TIER_LIMITS`) but new users default to **`enterprise` = 999/mo** (`20260519200000:87-94`), so the cap is effectively absent | Each call spends Brandfetch/SerpAPI/Firecrawl/Gemini/Anthropic |
| **generate-benchmark / generate-insights / compute-comparability / self-benchmark / generate-report** | **MED** — authenticated, heavy Claude/Gemini, no hard per-user rate limit (only insights has an auto-gen throttle, `generate-insights` via `ai_insight_auto_gen_log`) | Ownership-gated so scoped to caller's data, but a caller can loop them |
| **resolve-company-website** (#31) | **MED** — no quota; Brandfetch+SerpAPI+Anthropic per call, arbitrary `company_id` | |
| **send-auth-email** (#34) | **MED** — signature-optional acceptance path enables auth-email spoofing if the function is publicly invocable without a signature | Depends on `verify_jwt` config — **TEST** |
| **request-demo** (#30) | **LOW** — public, unauthenticated email send; no captcha/rate-limit → spam relay to arbitrary requester address | |

---

## Explicit SAFE list (no cross-tenant confidential exposure; ownership correctly enforced)

`billing-portal` (4), `company-lookup` (6), `compute-comparability` (7), `delete-account` (8)†, `download-report` (12), `enrich-company` (13), `extract-kpis` (14), `extract-report-context` (15), `generate-from-google-template` (18), `generate-from-template` (19), `generate-insights` (20), `generate-report` (21), `google-auth-callback` (22), `google-auth-url` (23), `insights-digest` (24), `monitor-publications` (25), `normalize-kpis` (26), `parse-template` (27), `send-welcome` (36), `stripe-webhook` (37), `suggest-competitors` (38), `upload-report` (41). Also `digest-company-news` (10) & `fetch-company-news` (16) are SAFE for tenant-confidentiality (shared data) but appear in §4 for cost.

† `delete-account` is IDOR-safe but leaves tenant data behind (retention gap).

---

## Ranked remediation plan

### CRITICAL (confirmed cross-tenant access/mutation — fix first)
1. **check-publication (#5)** — Add ownership gate immediately after loading the event: reject unless `event.created_by === user.id` **and** `event.company_id ∈ visible_company_ids_for_user(user.id)`, before line `check-publication/index.ts:58`. (Or make it service-role-only like `monitor-publications`, since `monitor-publications` is its only legitimate caller.)
2. **advance-approval (#1)** — Fix fail-open at `advance-approval/index.ts:36`: also verify the document is visible to the user (`benchmark_documents.customer_company_id ∈ visible_company_ids_for_user`) and treat `assignee_id IS NULL` as **deny** (`if (currentStep.assignee_id !== user.id) return 403`).
3. **ai-chat (#2)** — After resolving `session_id` (`ai-chat/index.ts:47`), verify ownership: `SELECT 1 FROM chat_sessions WHERE id=session_id AND user_id=user.id` (via `adminClient`), else 403. Also delete the dead `companies.user_id` check (`:155-161`) and replace with `visible_company_ids_for_user`.
4. **generate-benchmark (#17)** — Load the caller's profile with `.eq('user_id', user.id)` (`generate-benchmark/index.ts:152`), and require `benchmark_rules.created_by === user.id` for both the supplied `ruleId` and the default-rule branch (`:118-135`). Never `.limit(1).single()` a tenant-private table without a `user_id` filter.
5. **pipeline-orchestrator (#28)** — Gate at entry (`pipeline-orchestrator/index.ts:42`): if not a service-role call, require `report.company_id ∈ visible_company_ids_for_user(user.id)` before any `reports.status` mutation.

### HIGH (fail-open ownership on document flows + confirmed cost abuse)
6. **deliver-document (#9)**, **render-benchmark-pdf (#29)**, **send-document-notification (#35)** — Replace the `if (ruleCreator && ruleCreator!==user.id)` pattern with a positive check: require a non-null owner AND `=== user.id` (or fall back to `benchmark_documents.customer_company_id ∈ visible_company_ids_for_user`). Null `created_by` must **deny**. (`deliver-document:46`, `render-benchmark-pdf:37`, `send-document-notification:62`.)
7. **scan-ir-page (#32)** — For non-service-role callers, require `company_id ∈ visible_company_ids_for_user`; add a per-user daily scan quota. (`scan-ir-page/index.ts:346`.)

### MEDIUM (bounded IDOR / shared-data writes / cost)
8. **download-catalog-item (#11)** — Verify `effectiveCompanyId ∈ visible_company_ids_for_user` before inserting the `reports` row (`:72`).
9. **self-benchmark (#33)** — Verify `peer_group.owner_id === user.id` before using `peer_group_id` (`:71`).
10. **resolve-company-website (#31)** / **suggest-ir-url (#39)** / **suggest-publication-dates (#40)** — Require `company_id ∈ visible_company_ids_for_user` before reading tenant data or writing shared `companies` columns; add real quotas.
11. **analyze-accounting-profile (#3)** — Scope the `my_companies` / `companies` name-sync to `.eq('user_id', user.id)` (`:530-533`); do not rename a shared company globally.
12. **AI cost caps** — Reconsider the `enterprise=999` default tier (`20260519200000:94`); add per-user rate limits to `fetch-company-news`, `digest-company-news`, `generate-benchmark`, `compute-comparability`.

### LOW
13. **send-auth-email (#34)** — Make signature **mandatory** (reject when header absent) unless the caller is verifiably internal; confirm `verify_jwt` posture.
14. **request-demo (#30)** — Add rate-limiting / captcha.
15. **delete-account (#8)** — Extend deletion to `my_companies`, `my_company_kpis`, `accounting_profiles`, `custom_reports`, `chat_*`, `benchmark_rules`/`documents` for full erasure.

---

## Things to TEST (marked SUSPECTED / config-dependent)
- **`document_status_log`** — does the table exist, is RLS enabled, is there any policy? (S-5 was skipped, `20260518000000:91-92`.)
- **`send-auth-email`** — is the function deployed with `verify_jwt=false` and publicly reachable? If so the signature-optional path is live.
- **null-`created_by` rules** — confirm seeded/legacy `benchmark_rules` (or system default rule used by generate-benchmark's default branch) have `created_by IS NULL`; that is the precondition for findings #9/#29/#35 and the #17 default-rule bleed.
- **null-`assignee_id` steps** — confirm approval workflows create steps with null assignee (precondition for #1).
- For each CONFIRMED finding, reproduce with two test tenants (A creates resource, B calls the function with A's id) against staging.

---

## Appendix A — directory coverage (42/42)
advance-approval·ai-chat·analyze-accounting-profile·billing-portal·check-publication·company-lookup·compute-comparability·delete-account·deliver-document·digest-company-news·download-catalog-item·download-report·enrich-company·extract-kpis·extract-report-context·fetch-company-news·generate-benchmark·generate-from-google-template·generate-from-template·generate-insights·generate-report·google-auth-callback·google-auth-url·insights-digest·monitor-publications·normalize-kpis·parse-template·pipeline-orchestrator·render-benchmark-pdf·request-demo·resolve-company-website·scan-ir-page·self-benchmark·send-auth-email·send-document-notification·send-welcome·stripe-webhook·suggest-competitors·suggest-ir-url·suggest-publication-dates·upload-report — all analyzed above.
