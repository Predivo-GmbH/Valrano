# RECORD — `noreply@valrano.com` is rotated, and both consumers moved with it (2026-09-09)

_No value, prefix or length appears in this file. The only identifiers are SHA-256 digests, SMTP
reply codes, IMAP tagged responses and HTTP status codes._

Companion to `docs/RECORD-hello-mailbox-password-rotated-2026-09-09.md`. Same board row
(`rotate-valrano-mailbox-password-exposed-2026-09-03`), different mailbox: that one is the address
a person reads, this one is the address **the product authenticates as**, which is why it has two
consumers and that one had none.

---

## 1. Measured before it was believed

The row said the value had been printed into two session transcripts. What it did not say — and
what decides whether there is any work here — is whether it still opens the mailbox. It did:

| `mail.valrano.com:465`, user `noreply@valrano.com` | SMTP reply |
|---|---|
| control — a value nobody has ever set | `535` |
| the value written down in `docs/Credentials.txt` | **`235`** |

The control is not decoration. A mail host that has stopped answering refuses everything and reads
exactly like a rotated credential; §6 below is what happens when that distinction is missing.

## 2. Both consumers, enumerated by name before anything moved

The rotation standard's first rule is to count the read sites by name rather than assume. There are
two, both on Valrano Production `mkdeftmubrkseyrrbzvp`, and Staging has neither:

| consumer | what reads it | why it matters |
|---|---|---|
| edge secret `SMTP_PASS` | `supabase/functions/_shared/email.ts` via `Deno.env` | every transactional send |
| GoTrue mailer `config/auth` | Supabase Auth itself | every auth email |

Two things that would have been easy to get wrong, and were checked rather than assumed:

- **Staging is a different mailbox.** `vfwpcgdkrwqhdivfzmrg` authenticates as
  `staging-noreply@valrano.com` (Plesk mailname 8590) with its own value. Confirmed by digesting
  the address and matching it against the project's own `SMTP_USER` digest — not by reading either.
  A rotation that swept "all Valrano SMTP secrets" would have broken staging for no reason.
- **The obvious secret name was the right one here, but only because it was checked.** On BackOffice
  the same mailbox lives behind `METANET_SMTP_*` while `SMTP_*` is Postmark; setting the name that
  greps first would have broken live email. Valrano has one block and `SMTP_USER` digests to this
  address.

## 3. What was done, in order

1. New value from `crypto.randomBytes(24).toString('base64url')`, created inside a script, written
   to a mode-0600 file, never displayed.
2. **The panel.** Plesk XML API, `POST https://tertia.sui-inter.net:8443/enterprise/control/agent.php`,
   `<mail><update><set>` on mailname `noreply` under site id `6183` — `<status>ok</status>`. No
   browser. The REST API stays unusable on this shared plan (`403 "Access to API is disabled by
   admin access policy"`), but the XML API answers for mail operations.
3. **Consumer 1.** `POST /v1/projects/mkdeftmubrkseyrrbzvp/secrets` → `HTTP 201`, then read back.
4. **Consumer 2.** `PATCH .../config/auth` re-sending **every** `smtp_*` field together, then read
   back. A PATCH that sets `smtp_pass` alone nulls the other six and silently switches custom SMTP
   off — measured on BackOffice on 2026-09-03. All seven fields came back unchanged.
5. **The record.** `docs/Credentials.txt` rewritten blind — the old string replaced by the new one
   with neither displayed — with a `.bak-2026-09-09-before-noreply-rotation` alongside. That file
   is gitignored (`.gitignore:12`), so nothing was committed anywhere.

## 4. The proof, in the protocols' own words

| `noreply@valrano.com` | SMTP 465 | IMAP 993 |
|---|---|---|
| control — a value nobody has set | `535` | `a1 NO` |
| **the value that leaked (was `235`)** | **`535`** | — |
| the value set in the panel | **`235`** | **`a1 OK`** |

Two protocols, independently, and the control on each so a dead host cannot read as a pass.

And the consumers, read back from the systems that own them:

| check | result |
|---|---|
| edge `SMTP_PASS` digest equals SHA-256 of the new value | **true** |
| `PATCH config/auth` | `HTTP 200` |
| `smtp_host` / `smtp_port` / `smtp_user` / `smtp_sender_name` / `smtp_admin_email` / `smtp_max_frequency` / `rate_limit_email_sent` after | **all seven unchanged** |
| `smtp_pass` still set | yes |

Supabase returns a SHA-256 of an edge secret rather than the secret, so consumer 1 is proved
exactly while showing nothing. That is a stronger receipt than "the API returned 201".

## 5. The standing receipt, and it was shown red first

**`scripts/the-recorded-noreply-mailbox-credential-opens-the-mailbox-and-both-consumers-hold-it.live.test.mjs`**
— seven checks: the file records this mailbox; the section parser takes the value and not the whole
line; IMAP accepts it; SMTP accepts it; a wrong one is refused; the edge secret holds exactly it;
the GoTrue mailer still points at it with every field intact.

It answers the question that can be re-run for ever — *is the value written down the value
everything accepts* — rather than "did it change", which is a fact about one moment. The failure
this catches is the common one: a rotation that reached the file and not the consumer.

**Red before green.** Pointed at the pre-rotation backup of the same file
(`VALRANO_CREDENTIALS_FILE=…bak-2026-09-09-before-noreply-rotation`), it failed exactly three
checks — IMAP, SMTP, and consumer 1 — and passed the other four. Against the real file: 7 passed,
0 failed, exit 0.

## 6. What this cost, named rather than smoothed over

Building the suite spent **seven deliberate failed logins** against `tertia` in a few minutes —
the controls in the before-probe, the after-probe, the first green run and the red run.
Plesk's brute-force protection did what it is for and **refused this machine's IP**. Every probe
then returned a socket error, and for twenty minutes a healthy rotation was indistinguishable from
a broken one.

Two things follow, and both are now in the suite:

1. An unreachable host **fails with its own message**, naming the IP block rather than the
   credential. A confidently wrong instrument looks exactly like a result.
2. The control is now **one login on one protocol**, not two on two, and the header says in
   capitals that this suite must not be run in a loop.

**The product was never affected.** The mailer authenticates from Supabase's network, not from this
office; the block is on this machine's address only.

## 7. How many other copies of the dead value exist

Searched by VALUE — recovered in memory from the pre-rotation backup, matched with ripgrep from a
0600 pattern file. Only paths and counts were ever printed.

| tree | files | occurrences |
|---|---|---|
| `C:\Business` | 1 | 1 |
| `C:\ClaudeShared` | 3 | 4 |
| `~/.claude` | 11 | 15 |
| **total** | **15** | **20** |

The single hit under `C:\Business` is the pre-rotation backup this rotation wrote. The other
fourteen are three memory notes and eleven session transcripts — append-only records of what
happened, which is why deleting them was never the remedy. The rotation is what makes them inert.
`node_modules` and `.git/objects` were excluded from the sweep.

## 8. Digests

None of these is a value or any part of one.

| what | sha256 |
|---|---|
| the string that leaked, now dead | `dd4dfb4cc0b1890801f8a93de350bbbef73824205106657ed58601b7fbf7f05d` |
| the string in use from 2026-09-09T19:2xZ | `3f4e2673f483ebe0f0f01ed78922d0e510cf86c30b9b5b6c5263004123bcedc8` |

## 9. Where it lives now

The Plesk mailbox, the edge secret, the GoTrue mailer, and the gitignored
`Valrano/docs/Credentials.txt`. Nothing was written to a tracked file, a `.env`, or any document.

## 10. And one more thing, which is not Valrano's

While reading for this work I rendered the **Plesk panel credential itself** into a session
transcript, from a block `safe-inspect scan` had reported no finding on. It was live. It is
rotated, and that has its own record in the standards tree:
`standards/RECORD-the-plesk-panel-credential-was-rendered-and-is-rotated-2026-09-09.md`.
