#!/usr/bin/env node
/**
 * THE RECORDED hello@valrano.com CREDENTIAL ACTUALLY OPENS THE MAILBOX.
 *
 * Board row `rotate-valrano-mailbox-password-exposed-2026-09-03`. Two earlier sweeps recorded, in
 * good faith, that this row could have no finish-test: *"a successful SMTP AUTH proves a password
 * works, not that it CHANGED — and the only way to make it a real test would be to hold the exposed
 * value for comparison, which is precisely what must not be done."*
 *
 * That is right about the wrong question. "Did it change" is a fact about one moment and can never
 * be re-run. The thing that must stay true for ever is different and IS re-runnable: **the value
 * this fleet has written down is the value the mailbox accepts.** The failure that keeps happening
 * here is not a password that was never rotated, it is a rotation whose new value never reached the
 * file, or reached one file and not the consumer — §3c of the rotation standard, twice in one week.
 * A suite that opens the door with the recorded key catches exactly that, on every future rotation.
 *
 * It reads the gitignored credentials file and NEVER prints a value: the assertions are protocol
 * reply codes, and the only identifier printed is a SHA-256 prefix.
 *
 * NAMED `.live.` because it needs the credentials file and the network, neither of which a CI
 * runner has. A guard that reds the fleet for want of a dependency it cannot have is not stricter,
 * it is broken.
 *
 *   node scripts/the-recorded-hello-mailbox-credential-opens-the-mailbox.live.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import tls from 'node:tls'
import crypto from 'node:crypto'

const HOST = 'tertia.sui-inter.net'
const ADDR = 'hello@valrano.com'
const CREDS = 'C:\\Business\\Internal Projects\\Valrano\\docs\\Credentials.txt'
const LABEL = 'hello@valrano.com password'

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)

/** The recorded password, taken from its own labelled line. Returned, never printed. */
export function recorded(txt) {
  for (const line of String(txt).split(/\r?\n/)) {
    if (line.startsWith('#') || !line.startsWith(LABEL)) continue
    const v = line.slice(LABEL.length).trim()
    if (v) return v
  }
  return null
}

function imapLogin(user, pass) {
  return new Promise((resolve) => {
    const s = tls.connect({ host: HOST, port: 993, servername: HOST, rejectUnauthorized: false, timeout: 25000 })
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
    const s = tls.connect({ host: HOST, port: 465, servername: HOST, rejectUnauthorized: false, timeout: 25000 })
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

test('the credentials file records a password for this mailbox at all', () => {
  // PROVEN RED by construction: before 2026-09-09 this file held no entry for this address, and
  // this assertion is the one that would have said so. Six days of "rotate it" and nothing to open.
  const v = recorded(readFileSync(CREDS, 'utf-8'))
  assert.ok(v, `no line beginning "${LABEL}" in ${CREDS} — a rotation whose value never reached the file`)
  console.log(`      recorded value digest ${sha(v)}`)
})

test('the label parser takes the value and not the whole line', () => {
  // The 2026-09-03 leak happened twice through a parser that guessed a separator. This one is
  // anchored on the label, and is asserted rather than trusted.
  assert.equal(recorded(`${LABEL}  abc123XYZ`), 'abc123XYZ')
  assert.equal(recorded(`# ${LABEL}  commented-out`), null, 'a comment is not a record')
  assert.equal(recorded('something else  value'), null)
})

test('IMAP 993 accepts the recorded credential', async () => {
  const v = recorded(readFileSync(CREDS, 'utf-8'))
  assert.equal(await imapLogin(ADDR, v), 'OK', 'the recorded value does not open the mailbox')
})

test('SMTP 465 accepts the recorded credential', async () => {
  const v = recorded(readFileSync(CREDS, 'utf-8'))
  assert.equal(await smtpAuth(ADDR, v), 235, 'the recorded value is refused by the mail server')
})

test('a wrong password is genuinely refused — the probes are not answering OK to anything', async () => {
  // Without this, a probe that resolved 'OK' on any input would make the two above meaningless.
  assert.equal(await imapLogin(ADDR, 'not-the-password-' + Date.now()), 'NO')
  assert.equal(await smtpAuth(ADDR, 'not-the-password-' + Date.now()), 535)
})
