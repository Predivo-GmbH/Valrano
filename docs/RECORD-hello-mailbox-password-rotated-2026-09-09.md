# The hello@valrano.com mailbox password was changed

2026-09-09 · session `wave4-B` · board row `rotate-valrano-mailbox-password-exposed-2026-09-03`

## Why

The password was rendered into two session transcripts on 2026-09-03, both times by a
general-purpose tool pointed near a credentials file rather than by anyone opening one: a masked
scan that only caught tokens of 14 characters or more (this one is 9), and then a "print the label
only" split on `:` against a line that contains no `:`, which returned the whole line. It was burned
from that moment. The row then sat open for six days.

## What the row had already settled, and what it had not

Two earlier sessions established the fact the row itself said must come first — **is the exposed
address a sending identity or only a receiving one?** It is receiving only. Both Valrano projects
authenticate as `noreply@valrano.com`, confirmed on 2026-09-09 against the live function
environments of production (`mkdeftmubrkseyrrbzvp`) and staging (`vfwpcgdkrwqhdivfzmrg`) by hashing
candidate strings locally and comparing digests, so nothing was displayed. `hello@` appears in the
repository only as the public contact address on the landing/imprint/privacy/terms pages and as
`DEMO_INBOX` in `supabase/functions/request-demo/index.ts`, which *sends to* it.

**So this was the small branch: one password change, no secret rewrite in either project, no
function redeploy, and no proof-send from the product path.** The four-step "one mailbox, two
consumers" rotation that this row feared does not apply.

What stopped it for a further day was the panel login. The last session recorded, correctly, that
retrying a login blind against `tertia.sui-inter.net` is what got our own address banned by the host
on 2026-09-03 and took every Predivo site dark from Roger's network. The answer was not to retry
blind: the credential is documented — `standards/credential-rotation-standard.md` §"How to recover a
Supabase account", `Plesk panel https://tertia.sui-inter.net:8443`, user `mueller`, password in
`replyflow/docs/Credentials.txt` under `## Plesk Panel (Metanet)` — and the XML-API at
`/enterprise/control/agent.php` accepts it. One authenticated call, no guessing.

## What was done

| step | how it was confirmed |
|---|---|
| located `valrano.com` | `site:get` → site-id **6183**, status ok |
| located the mailbox | `mail:get_info` → mail id **8520**, and it carries a mailbox **and** one forwarding address, so a password set changes the mailbox and leaves the contact forwarding alone |
| set a new 32-character random password | `mail:update` → `status: ok`, no errcode |
| the new password works | SMTP `tertia.sui-inter.net:465` AUTH LOGIN → **235**; IMAP `:993` LOGIN → **OK** |
| recorded | appended as a labelled block to `Valrano/docs/Credentials.txt` (gitignored, confirmed by `git check-ignore`), one occurrence, digest `6c9bdfb00c1b` |

Nothing was rendered at any point. The panel credential and the new value were read into variables
and piped straight to their destinations; the only things printed were reply codes, Plesk status
elements, and SHA-256 digests.

## The honest limit of the proof, stated rather than papered over

**The old value was never in the credentials file, so this rotation cannot show it being refused.**
Measured before touching anything: the only 9-character value in `Valrano/docs/Credentials.txt`
(line 105, digest `dd4dfb4cc0b1`, located by sliding digest match rather than by parsing a line
shape — the parse is what leaked it the second time) was tried against the mailbox and **refused on
both SMTP (535) and IMAP (NO)**. It belongs to something else and was deliberately left untouched.

So the precedent's strongest proof — *old refused, new accepted* — is only half available here. What
does hold: a Plesk password set replaces whatever was there, and the value now on the mailbox was
generated with `crypto.randomInt` in this session and exists in exactly one file on disk. Any copy
of the previous value, in a transcript or anywhere else, is worthless. That is the whole point of
the rotation, and it is achieved.

One more thing worth keeping, from the 2026-09-06 ReplyFlow mailbox rotation: **a panel that
answers "saved" is not proof.** That attempt silently changed nothing and was caught only because
the protocol still refused the new value afterwards. Here the protocol was asked, on both ports,
and answered 235 and OK.

## Not Roger's, and why

Money, a credential only he holds, physical access, an outside send on his account, a genuine
preference between valid options — none of the five. The panel credential is documented and on this
disk, the mailbox is ours, and there was exactly one reversible option. His standing instruction of
2026-09-08 is explicit: *if a key needs rotating, rotate it — do not ask, production included.*
