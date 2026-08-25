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
| D-003 | 2026-08-25 | STAGING sends as its own mailbox, `staging-noreply@valrano.com` (Plesk mailname 8590 on site 6183). PRODUCTION keeps `noreply@valrano.com`. `SMTP_HOST` and `SMTP_PORT` stay identical on both | Until 2026-08-25 both Supabase projects carried the IDENTICAL SMTP_USER / SMTP_PASS / SMTP_FROM digests, so to Metanet the two environments were the SAME ACTOR: a staging mistake spent production's sending reputation, and either environment could be rate-limited or blocked on the other's behalf. Fleet rule, already written down: only ONE environment may hold a shared external identity. arivioo made the same split on 2026-08-15. Host and port are the server's address, not an identity, so they stay shared | Keeping one credential and being careful on staging (that is the state that produced the defect); or authenticating as staging but still sending `From: noreply@valrano.com` (arivioo's shape, forced there by a hardcoded From) - rejected because a staging test mail marked as spam would still land on production's From address | Claude | active |
| D-004 | 2026-08-25 | The `Swiss-made` trust mark is removed from every Valrano EMAIL template and kept on the website footer | `standards/footer-standard.md` line 19 reserves the mark for the website footer; the Email Footer section, updated 2026-08-24 after Roger found it still in ChannelMover's lifecycle mail, bans it outright: "NO Swiss-made mark. NO company slogan." Valrano was still sending it from three places - the shared template every transactional mail renders through, the document-notification footer, and the monthly insights digest | Removing it from the website too (the standard explicitly wants it there, as the Swiss-quality trust signal) | Claude | active |
| D-005 | 2026-08-25 | `supabase/functions` is type-checked in CI by `gate-edge-typecheck`, as a RATCHET against `.github/typecheck-functions-baseline.txt`, and both deploying jobs `needs:` it | Nothing in the repo compiled the edge functions: eslint ignores the directory, the app tsconfigs exclude it, vitest never loads it, `npm run build` runs tsc over src/ only. That is how ReplyFlow shipped a broken function (R-CI-02). The first run found 53 pre-existing errors, so a plain pass/fail gate would be permanently red - and because both deploy jobs depend on it, permanently red means permanently blocked, which ends with someone switching it off. A ratchet blocks the NEW error today and lets the 53 be paid down separately | Plain pass/fail (permanently red); `continue-on-error` (a gate that never gates - the exact mistake replyflow made on 2026-08-23 and undid on 2026-08-24); a standalone non-blocking workflow like ChannelMover's (visible, but stops nothing) | Claude | active |

<!--
Example row, delete when the first real one is added:

| D-001 | 2026-08-24 | Transactional email goes through Postmark, not Supabase built-in | Supabase auth email hard-caps at 2/hour/user without custom SMTP, which broke 6+ projects | Supabase built-in SMTP (rate limit), SendGrid (no existing account) | Roger | active |
-->

## Superseded decisions
<!-- Move nothing here. This section is a pointer only: superseded rows STAY in the table above with
     their status changed, so the trail is readable top to bottom. -->
