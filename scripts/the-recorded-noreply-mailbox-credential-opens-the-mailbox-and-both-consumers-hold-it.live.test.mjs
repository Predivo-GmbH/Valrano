#!/usr/bin/env node
/**
 * THE RECORDED noreply@valrano.com CREDENTIAL OPENS THE MAILBOX — AND BOTH CONSUMERS HOLD IT.
 *
 * Sibling of `the-recorded-hello-mailbox-credential-opens-the-mailbox.live.test.mjs`, for the
 * OTHER Valrano mailbox on the same board row (`rotate-valrano-mailbox-password-exposed-2026-09-03`).
 * That one is the address a person reads; this one is the address the product AUTHENTICATES AS,
 * which is why it has three more assertions than its sibling.
 *
 * WHAT MAKES THIS DIFFERENT FROM "did it change". The sibling's header already argues the point:
 * "did it change" is a fact about one moment and can never be re-run. What must stay true for ever
 * is that **the value written down is the value the mailbox accepts** — and, for a mailbox a
 * product signs in with, that **every consumer holds that same value**. Rotating a mailbox and
 * leaving a consumer on the old value is §3c of the rotation standard, and it is how a mailer goes
 * quiet for four days with nothing red anywhere.
 *
 * noreply@valrano.com has exactly two consumers, both on Valrano Production
 * (`mkdeftmubrkseyrrbzvp`), and this suite checks both:
 *   1. the edge-function secret `SMTP_PASS`, which `supabase/functions/_shared/email.ts` reads;
 *   2. the GoTrue mailer (`config/auth`), which sends every auth email.
 * Supabase returns a SHA-256 of an edge secret rather than the secret, so consumer 1 can be
 * checked exactly and shows nothing. Consumer 2 does not expose even a digest, so what is checked
 * there is the thing that actually broke on BackOffice on 2026-09-03: a PATCH that sets one
 * `smtp_*` field NULLS THE OTHER SIX and silently switches custom SMTP off.
 *
 * Nothing here prints a value. The assertions are protocol reply codes and digest equality; the
 * only identifier printed is a SHA-256 prefix.
 *
 * NAMED `.live.` for the same reason as its sibling: it needs the gitignored credentials file and
 * the network, neither of which a CI runner has. A guard that reds the fleet for want of a
 * dependency it cannot have is not stricter, it is broken.
 *
 *   node scripts/the-recorded-noreply-mailbox-credential-opens-the-mailbox-and-both-consumers-hold-it.live.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import tls from 'node:tls'
import crypto from 'node:crypto'

const MAIL_HOST = 'mail.valrano.com'
const ADDR = 'noreply@valrano.com'
// The default is the real file. The override exists for ONE purpose, and it is the reason this
// suite can be believed at all: it was run against the PRE-ROTATION BACKUP of this same file,
// where it went red on both mailbox probes and on consumer 1. A guard never shown red is
// decoration. It is read-only and never used by the default invocation.
const CREDS = process.env.VALRANO_CREDENTIALS_FILE ||
  'C:\\Business\\Internal Projects\\Valrano\\docs\\Credentials.txt'
const PROJECT_REF = 'mkdeftmubrkseyrrbzvp'
/** SHA-256 of the Valrano Supabase management PAT, so the right one is picked by proof, not by position. */
const PAT_DIGEST = '471dda13b6d5'

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
const sha12 = (s) => sha(s).slice(0, 12)

/**
 * The SMTP block, read from the section that owns it rather than from a line number.
 *
 * ANCHORED ON THE SECTION, NOT ON A SEPARATOR. The 2026-09-03 and 2026-09-09 leaks both came from
 * a parser that guessed how a line was punctuated and then printed what it guessed wrong. This one
 * finds the `#` heading that mentions SMTP and reads the labelled lines under it, and it is
 * asserted below rather than trusted.
 */
export function smtpBlock(txt) {
  const lines = String(txt).split(/\r?\n/)
  let inSection = false
  const out = {}
  for (const line of lines) {
    if (/^#/.test(line)) {
      inSection = /smtp/i.test(line)
      if (inSection) { out.host = undefined; out.address = undefined; out.pass = undefined }
      continue
    }
    if (!inSection) continue
    const m = line.match(/^([A-Za-z][A-Za-z ]*?)\s*:\s*(\S.*?)\s*$/)
    if (!m) continue
    const key = m[1].trim().toLowerCase()
    if (key === 'host') out.host = m[2]
    else if (key === 'email address') out.address = m[2]
    else if (key === 'password' && out.pass === undefined) out.pass = m[2]
    if (out.address === ADDR && out.pass) return out
  }
  return out.address === ADDR ? out : {}
}

/** The management PAT, identified by digest so no line number can go stale. Returned, never printed. */
export function managementPat(txt) {
  for (const m of String(txt).matchAll(/sbp_[A-Za-z0-9_-]{20,}/g)) if (sha12(m[0]) === PAT_DIGEST) return m[0]
  return null
}

function imapLogin(user, pass) {
  return new Promise((resolve) => {
    const s = tls.connect({ host: MAIL_HOST, port: 993, servername: MAIL_HOST, timeout: 25000 })
    let greeted = false, done = false
    const fin = (v) => { if (!done) { done = true; try { s.destroy() } catch {} resolve(v) } }
    s.setEncoding('utf8')
    s.on('data', (d) => {
      if (!greeted) { greeted = true; s.write(`a1 LOGIN "${user}" "${String(pass).replace(/(["\\])/g, '\\$1')}"\r\n`); return }
      const t = String(d)
      if (/^a1 OK/mi.test(t)) return fin('OK')
      if (/^a1 NO/mi.test(t)) return fin('NO')
      if (/^a1 BAD/mi.test(t)) return fin('BAD')
    })
    s.on('timeout', () => fin('ERR'))
    s.on('error', () => fin('ERR'))
  })
}

function smtpAuth(user, pass) {
  return new Promise((resolve) => {
    const s = tls.connect({ host: MAIL_HOST, port: 465, servername: MAIL_HOST, timeout: 25000 })
    let step = 0, done = false
    const fin = (c) => { if (!done) { done = true; try { s.destroy() } catch {} resolve(c) } }
    s.setEncoding('utf8')
    s.on('data', (d) => {
      const code = Number(String(d).slice(0, 3))
      if (step === 0) { s.write('EHLO probe.local\r\n'); step = 1; return }
      if (step === 1) { s.write('AUTH LOGIN\r\n'); step = 2; return }
      if (step === 2) { s.write(Buffer.from(user).toString('base64') + '\r\n'); step = 3; return }
      if (step === 3) { s.write(Buffer.from(String(pass)).toString('base64') + '\r\n'); step = 4; return }
      fin(code)
    })
    s.on('timeout', () => fin(-1))
    s.on('error', () => fin(-2))
  })
}

async function supa(path, pat) {
  const r = await fetch('https://api.supabase.com' + path, { headers: { Authorization: 'Bearer ' + pat } })
  return { status: r.status, json: r.status === 200 ? await r.json() : null }
}

const file = () => readFileSync(CREDS, 'utf-8')

test('the credentials file records this mailbox at all', () => {
  const b = smtpBlock(file())
  assert.equal(b.address, ADDR, `no SMTP section naming ${ADDR} in ${CREDS}`)
  assert.ok(b.pass, 'the SMTP section names the address but records no password for it')
  console.log(`      recorded value digest ${sha12(b.pass)}`)
})

test('the section parser takes the value and not the whole line', () => {
  const ok = smtpBlock(`# SMTP\nHost: mail.valrano.com\nEmail address: ${ADDR}\nPassword: abc123XYZ\n`)
  assert.equal(ok.pass, 'abc123XYZ')
  assert.equal(ok.host, 'mail.valrano.com')
  assert.deepEqual(smtpBlock(`# Something else\nPassword: abc123XYZ\n`), {}, 'a password outside the SMTP section is not this one')
  assert.deepEqual(smtpBlock(`# SMTP\nEmail address: someone@else.com\nPassword: abc123XYZ\n`), {}, 'another address is not this one')
})

/**
 * A HOST THAT WILL NOT TALK TO US IS NOT A CREDENTIAL THAT STOPPED WORKING, and on 2026-09-09 the
 * two were indistinguishable here for twenty minutes. Building this suite cost seven deliberate
 * wrong-password logins in a few minutes, `tertia` treated that as brute force exactly as it
 * should, and every probe then returned a socket error — which read as "the rotation failed".
 *
 * So: an unreachable host FAILS, loudly, and says which of the two it is. And the control below is
 * ONE login, not two, because every run of this suite spends a failed attempt against a host with
 * brute-force protection. **Do not run this suite in a loop.**
 */
function assertReachable(v, what) {
  assert.ok(
    v !== 'ERR' && v !== -1 && v !== -2,
    `${what} did not answer at all (${v}). That is this machine's IP being refused by ` +
      `${MAIL_HOST} — Plesk's brute-force protection, usually after failed logins — NOT a ` +
      `credential that stopped working. Wait for the block to lapse and re-run once. The product ` +
      `mailer is unaffected: it authenticates from Supabase's network, not from here.`,
  )
}

test('IMAP 993 accepts the recorded credential', async () => {
  const b = smtpBlock(file())
  const v = await imapLogin(ADDR, b.pass)
  assertReachable(v, 'IMAP 993')
  assert.equal(v, 'OK', 'the recorded value does not open the mailbox')
})

test('SMTP 465 accepts the recorded credential', async () => {
  const b = smtpBlock(file())
  const v = await smtpAuth(ADDR, b.pass)
  assertReachable(v, 'SMTP 465')
  assert.equal(v, 235, 'the recorded value is refused by the mail server')
})

test('a wrong password is genuinely refused — the probe is not answering 235 to anything', async () => {
  // One control, on one protocol, on purpose. See the note above assertReachable.
  const v = await smtpAuth(ADDR, 'not-the-password-' + Date.now())
  assertReachable(v, 'SMTP 465')
  assert.equal(v, 535)
})

test('consumer 1: the edge-function secret SMTP_PASS holds exactly the recorded value', async () => {
  const txt = file()
  const b = smtpBlock(txt)
  const pat = managementPat(txt)
  assert.ok(pat, 'no Valrano management PAT with the expected digest in the credentials file')
  const r = await supa(`/v1/projects/${PROJECT_REF}/secrets`, pat)
  assert.equal(r.status, 200, 'the Supabase Management API refused the recorded PAT')
  const row = r.json.find((x) => x.name === 'SMTP_PASS')
  assert.ok(row, 'Valrano Production has no SMTP_PASS edge secret')
  assert.equal(row.value, sha(b.pass), 'the edge secret is NOT the value written down — a rotation reached the file and not the consumer')
})

test('consumer 2: the GoTrue mailer still points at this mailbox, with every smtp_ field intact', async () => {
  const pat = managementPat(file())
  const r = await supa(`/v1/projects/${PROJECT_REF}/config/auth`, pat)
  assert.equal(r.status, 200)
  const c = r.json
  // A PATCH that sets smtp_pass alone nulls the rest (BackOffice, 2026-09-03). These are the
  // fields that went null there, so this is the shape of that failure, asserted.
  assert.equal(c.smtp_user, ADDR, 'the GoTrue mailer no longer authenticates as this mailbox')
  assert.equal(c.smtp_host, MAIL_HOST)
  assert.equal(String(c.smtp_port), '465', 'this mailer speaks implicit TLS and only works on 465')
  assert.ok(c.smtp_sender_name, 'smtp_sender_name is empty — custom SMTP has been switched off')
  assert.ok(c.smtp_admin_email, 'smtp_admin_email is empty — custom SMTP has been switched off')
  assert.ok(c.smtp_pass, 'the GoTrue mailer holds no password at all')
})
