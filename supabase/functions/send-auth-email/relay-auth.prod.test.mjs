#!/usr/bin/env node
/**
 * relay-auth.prod.test.mjs — production/staging regression guard for the send-auth-email
 * open-relay fix (signal-fleet:send-auth-email:unauthenticated-relay, closed on Valrano
 * production 2026-09-04).
 *
 * The function used to check a Standard-Webhooks signature ONLY when one was present. This
 * project's Send-Email hook is a Postgres hook (`pg-functions://postgres/public/handle_send_email`)
 * called through pg_net with no signature at all, so "no signature" meant "no check": any holder
 * of the public website key could POST a crafted payload and make Valrano mail a login or
 * password-reset code to an address of their choosing. It now requires EITHER a valid signature
 * OR the internal shared secret in `x-send-email-secret`, which handle_send_email reads from
 * Vault (`send_email_internal_secret`) and sends on every relay call. Enforcement is gated on
 * the edge function's own SEND_EMAIL_INTERNAL_SECRET being set.
 *
 * WHY A LIVE PROBE AND NOT A UNIT TEST. The code half was committed on 2026-09-02 (4493c70) and
 * production was STILL an open relay on 2026-09-04 — measured, an unauthenticated POST of `{}`
 * answered 400 — because the gate is inert until a secret exists in two places that live nowhere
 * in this repo (a Vault row and an edge-function env var). A test that reads index.ts would have
 * been green throughout. Only asking the live endpoint can tell "the fix shipped" apart from
 * "the fix is in effect".
 *
 * Self-contained — needs no credentials, which is the whole point: an unauthenticated caller
 * must be refused. A 400 here is the FAILING state, not a passing one: 400 "No email in payload"
 * is a complaint about the body, which is only reached after authentication.
 *
 * Run: node supabase/functions/send-auth-email/relay-auth.prod.test.mjs
 * Exit 0 = relay closed on every checked project; non-zero = a project is an open relay again.
 *
 * IF THIS FAILS, the most likely cause is not a code change: the Vault secret is DATA, not
 * schema, so a `supabase db reset` / re-provision drops it. Re-seed the Vault row
 * (`send_email_internal_secret`) BEFORE the migration is re-applied, then re-set the edge
 * variable SEND_EMAIL_INTERNAL_SECRET to the same value — Vault first, env var last, or auth
 * email goes down for real customers.
 *
 * Ported from BackOffice/supabase/functions/send-auth-email/relay-auth.prod.test.mjs, which was
 * itself ported from ChannelMover. Diff the three before changing any of them.
 */
import assert from 'node:assert/strict'

const PROJECTS = [
  { name: 'production', ref: 'mkdeftmubrkseyrrbzvp' },
  { name: 'staging', ref: 'vfwpcgdkrwqhdivfzmrg' },
]

// Exactly what an attacker holding only the public website key (or nothing at all) can send.
// The recipient is a `.invalid` address (RFC 2606, guaranteed never to resolve) so that even a
// regressed deployment that accepted this probe could not mail a real person because of it.
const forgedPayload = {
  user: { email: 'relay-guard@valrano-test.invalid' },
  email_data: {
    token: '000000',
    token_hash: 'RELAY-GUARD',
    redirect_to: 'https://valrano.com',
    email_action_type: 'recovery',
    site_url: 'https://valrano.com',
  },
}

let failures = 0
for (const p of PROJECTS) {
  const url = `https://${p.ref}.supabase.co/functions/v1/send-auth-email`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forgedPayload),
    })
    assert.equal(res.status, 401, `${p.name}: unsigned relay attempt must be rejected 401, got ${res.status}`)
    console.log(`ok - ${p.name} (${p.ref}): unsigned relay attempt rejected with 401`)
  } catch (err) {
    failures++
    console.error(`FAIL - ${p.name} (${p.ref}): ${err.message}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} project(s) still accept an unsigned relay - the open relay is NOT closed.`)
  process.exit(1)
}
console.log(`\nall ${PROJECTS.length} project(s) reject an unauthenticated relay attempt.`)
