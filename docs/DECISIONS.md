# Valrano Decision Log

> **Purpose:** capture WHY we chose something, at the moment we chose it, in the project it belongs to.
> Adopted 2026-08-24 (Roger: *"take all of them"*). This replaces the habit of leaving decisions in
> session memory, which is exactly why they get re-argued weeks later.
>
> **The rule (checklist Rule 37):** when an architectural decision, an approach change, or a
> cost-impacting agreement is made, write the row **before writing any code**. A decision IS a
> milestone. Do not wait for the implementation to finish.
>
> **Why HERE and not in memory:** the old convention lived in global memory files as
> `decision_*.md`. It quietly died: **27 notes exist and the newest is dated 2026-07-15**, while
> **241 memory files carry an August 2026 date** (both counted 2026-08-24). Nothing enforced it and
> nobody opening the project could see it. A file in the repo is visible to whoever opens the repo,
> survives context compaction, and travels with the code.

## How to write a row

- **One row per decision.** Short. If it needs more than a paragraph, link a doc.
- **Record the REJECTED option too.** A decision with no alternative was never a decision, and the
  rejected option is the half that stops the re-argument.
- **Never delete a row.** If a decision is reversed, add a NEW row that supersedes it and set the old
  row's status to `superseded by D-nnn`. The history is the value.
- **Date it.** Absolute dates only, never "last week".
- **Money, pricing, or anything customer-visible needs Roger's sign-off recorded in the row.**

## Decisions

| ID | Date | Decision | Why | Rejected alternative | Decided by | Status |
|---|---|---|---|---|---|---|
| D-001 | 2026-08-24 | Valrano has exactly ONE mailer. `send-document-notification` no longer reads SMTP_HOST/PORT/USER/PASS itself; it calls the shared `sendEmail()` in `_shared/email.ts` | A second mailer reading a first mailer's environment variables is an undeclared dependency: BackOffice support mail went dark for four days (2026-08-20 to 2026-08-24) exactly this way, when a shared SMTP_HOST/SMTP_PORT was repointed for one mailer and a second one silently followed. The hand-rolled version also discarded every SMTP reply code and returned success no matter what the server said | Giving the second mailer its own SUPPORT_-style prefixed variables (two mailers to keep in step forever, for one function that needs nothing the shared one lacks) | Claude, under the fleet silent-mailer sweep | active |
| D-002 | 2026-08-24 | The mailer refuses any SMTP port other than 465, in words, instead of failing at the TLS layer | It opens the socket with implicit TLS, which exists only on 465. On 587 the handshake dies with "received corrupt message of type InvalidContentType". Live values read 2026-08-24: mail.valrano.com:465, correct today - but five fleet products have already moved to Postmark, which has no 465 listener at all, so the day Valrano moves this file must move to the Postmark HTTP API in the same change | Leaving it to fail at the TLS layer and hoping someone reads the logs | Claude | active |

<!--
Example row, delete when the first real one is added:

| D-001 | 2026-08-24 | Transactional email goes through Postmark, not Supabase built-in | Supabase auth email hard-caps at 2/hour/user without custom SMTP, which broke 6+ projects | Supabase built-in SMTP (rate limit), SendGrid (no existing account) | Roger | active |
-->

## Superseded decisions
<!-- Move nothing here. This section is a pointer only: superseded rows STAY in the table above with
     their status changed, so the trail is readable top to bottom. -->
