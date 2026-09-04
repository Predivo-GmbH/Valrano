#!/usr/bin/env node
/**
 * seed-email-relay-vault.mjs — (re-)seed the three Vault secrets `handle_send_email` needs, and
 * the matching edge-function secret that turns enforcement on.
 *
 * `handle_send_email` (the GoTrue "Send Email" hook relay -> the send-auth-email edge function)
 * reads `supabase_url` + `service_role_key` from Vault, and `send_email_internal_secret` for the
 * `x-send-email-secret` header. The relay FUNCTION is codified in
 * `supabase/migrations/20260903000000_handle_send_email_relay_secret.sql`, but those Vault values
 * are DATA, not schema — a fresh `supabase db reset` / re-provision drops them and auth email
 * silently stops (the relay RAISEs "vault secrets ... missing").
 *
 * ORDER MATTERS, and getting it wrong rejects every auth email in between:
 *   Vault first (the relay starts sending the header), THEN the edge-function secret
 *   (the moment enforcement turns on). This script does them in that order and stops on the
 *   first failure, so it can never leave the edge side enforcing a header the DB is not sending.
 *
 * The value is never echoed, never written to a file, and never put in a commit. The only thing
 * printed is a digest comparison, which proves both sides hold the SAME value while displaying
 * neither: Vault's `encode(digest(decrypted_secret,'sha256'),'hex')` against the SHA-256 the
 * Management API returns for the edge secret.
 *
 * EACH SECRET IS REPLACED IN ONE STATEMENT BATCH (delete + create in a single query string, so
 * Postgres runs them in one implicit transaction). The bash version this was ported from issued
 * the delete and the create as two HTTP calls, which leaves a window — small, but a window in
 * which every auth email raises. There is no reason to have one.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<pat> node scripts/seed-email-relay-vault.mjs --project-ref <ref>
 *          [--relay-secret-only | --skip-relay-secret | --from-vault]
 *   production: mkdeftmubrkseyrrbzvp      staging: vfwpcgdkrwqhdivfzmrg
 *
 * `--relay-secret-only` leaves `supabase_url` / `service_role_key` untouched — use it when those
 * are known good and only the relay secret is being rotated or introduced.
 *
 * `--skip-relay-secret` does the opposite, and exists for one specific and easily-missed case:
 * seeding an environment whose `handle_send_email` is still the OLD definition that does not send
 * the header yet. The migration is what teaches the relay to send it, and CI applies migrations
 * on deploy — so between provisioning and that deploy there is a window in which turning
 * enforcement on would reject every auth email. Seed the two Vault values now with this flag, let
 * the migration land, then run again with `--relay-secret-only`.
 *
 * `--from-vault` MINTS NOTHING AND WRITES NOTHING TO VAULT. It reads the relay secret already
 * stored there and only sets the edge variable, which is the last step of the rollout and the
 * instant enforcement turns on. This is the mode that closed Valrano PRODUCTION on 2026-09-04:
 * production's Vault had been seeded the day before, the migration landed with the promotion, and
 * rotating the value at cutover time would have been a second moving part for no gain. It REFUSES
 * to run unless `handle_send_email` already sends the header and Vault already holds the secret —
 * the two preconditions whose absence turns this step into an outage.
 *
 * Ported from BackOffice/scripts/seed-email-relay-vault.mjs (itself ported from ChannelMover and
 * Distribution-OS). Diff them before changing any of them.
 */

import crypto from 'node:crypto'

const API = 'https://api.supabase.com/v1/projects'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

const ref = arg('--project-ref')
const relaySecretOnly = process.argv.includes('--relay-secret-only')
const skipRelaySecret = process.argv.includes('--skip-relay-secret')
const fromVault = process.argv.includes('--from-vault')
const token = process.env.SUPABASE_ACCESS_TOKEN

if ([relaySecretOnly, skipRelaySecret, fromVault].filter(Boolean).length > 1) {
  console.error('ERROR: --relay-secret-only, --skip-relay-secret and --from-vault are mutually exclusive')
  process.exit(1)
}
if (!ref) {
  console.error('ERROR: --project-ref is required')
  process.exit(1)
}
if (!token) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN is not set')
  process.exit(1)
}

/** Run SQL through the Management API. Returns parsed rows; throws with the status on failure. */
async function query(sql) {
  const res = await fetch(`${API}/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
  try { return JSON.parse(text) } catch { return [] }
}

/** SQL string literal. The values here are secrets, so they never go near a shell. */
function lit(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

async function replaceVaultSecret(name, value, description) {
  // One statement batch => one implicit transaction => no window with the secret absent.
  await query(
    `delete from vault.secrets where name = ${lit(name)};` +
    `select vault.create_secret(${lit(value)}, ${lit(name)}, ${lit(description)});`
  )
}

/** Set the edge variable and prove both sides hold the same value without displaying either. */
async function setEdgeSecretAndVerify(relaySecret) {
  const setRes = await fetch(`${API}/${ref}/secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name: 'SEND_EMAIL_INTERNAL_SECRET', value: relaySecret }]),
  })
  if (![200, 201].includes(setRes.status)) {
    console.error(
      `ERROR: SEND_EMAIL_INTERNAL_SECRET failed (HTTP ${setRes.status}) for ${ref} — ` +
      'enforcement is OFF, which is the safe side: auth email still flows. Re-run this script.',
    )
    process.exit(1)
  }

  const expected = crypto.createHash('sha256').update(relaySecret).digest('hex')
  const vaultRows = await query(
    "select encode(digest(decrypted_secret,'sha256'),'hex') as digest" +
    " from vault.decrypted_secrets where name = 'send_email_internal_secret'",
  )
  const listRes = await fetch(`${API}/${ref}/secrets`, { headers: { Authorization: `Bearer ${token}` } })
  const edgeDigest = (await listRes.json()).find((s) => s.name === 'SEND_EMAIL_INTERNAL_SECRET')?.value

  const vaultOk = vaultRows[0]?.digest === expected
  const edgeOk = edgeDigest === expected
  console.log(`digest match — vault: ${vaultOk ? 'YES' : 'NO'}, edge: ${edgeOk ? 'YES' : 'NO'}`)
  if (!vaultOk || !edgeOk) {
    console.error('ERROR: the two sides do not hold the same value. Re-run before trusting the gate.')
    process.exit(1)
  }
  console.log(`OK: relay secret set on both sides for ${ref}; send-auth-email now rejects unsigned callers.`)
}

// -- 0. --from-vault: use what is already stored, mint nothing, write no Vault row ------------
if (fromVault) {
  const pre = await query(`
    select
      (select bool_or(pg_get_functiondef(p.oid) like '%x-send-email-secret%')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'handle_send_email') as sends_header,
      (select count(*) from vault.decrypted_secrets
         where name = 'send_email_internal_secret') as vault_secret
  `)
  const p = pre[0]
  if (p?.sends_header !== true || Number(p?.vault_secret) !== 1) {
    console.error(
      `REFUSING on ${ref}: sends_header=${p?.sends_header}, vault_secret=${p?.vault_secret}. ` +
      'The relay must already send the header and Vault must already hold the secret, or setting ' +
      'the edge variable rejects every auth email. Apply the migration / seed Vault first.',
    )
    process.exit(1)
  }
  const rows = await query(
    "select decrypted_secret as s from vault.decrypted_secrets where name = 'send_email_internal_secret'",
  )
  const relaySecret = rows[0]?.s
  if (!relaySecret) {
    console.error(`ERROR: Vault read returned nothing for ${ref}`)
    process.exit(1)
  }
  await setEdgeSecretAndVerify(relaySecret)
  process.exit(0)
}

// -- 1. supabase_url + service_role_key -------------------------------------------------------
if (!relaySecretOnly) {
  const keysRes = await fetch(`${API}/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!keysRes.ok) {
    console.error(`ERROR: could not read api-keys for ${ref} (HTTP ${keysRes.status})`)
    process.exit(1)
  }
  const keys = await keysRes.json()
  // Prefer the `secret` (sb_secret_...) key: several fleet projects had their LEGACY
  // anon/service_role JWTs disabled in June 2026, so taking `service_role` by name can seed a
  // dead credential that only appears to work because send-auth-email runs verify_jwt=false.
  const serviceKey =
    keys.find((k) => k.type === 'secret')?.api_key ??
    keys.find((k) => k.name === 'service_role')?.api_key
  if (!serviceKey) {
    console.error(`ERROR: no secret / service_role key returned for ${ref}`)
    process.exit(1)
  }
  await replaceVaultSecret('supabase_url', `https://${ref}.supabase.co`, 'edge base url for handle_send_email')
  await replaceVaultSecret('service_role_key', serviceKey, 'functions gateway auth for handle_send_email')
  console.log(`OK: Vault seeded for ${ref} (supabase_url + service_role_key)`)
} else {
  console.log('skipping supabase_url / service_role_key (--relay-secret-only)')
}

if (skipRelaySecret) {
  console.log(
    `OK: ${ref} has the two Vault values the relay reads. The relay secret is deliberately NOT set, ` +
    'so enforcement stays off and auth email keeps flowing. Re-run with --relay-secret-only once ' +
    'the relay migration is live here.',
  )
  process.exit(0)
}

// -- 2. the internal relay secret, Vault side (signal-fleet:send-auth-email:unauthenticated-relay)
const relaySecret = crypto.randomBytes(32).toString('hex')
await replaceVaultSecret(
  'send_email_internal_secret',
  relaySecret,
  'shared secret handle_send_email sends to send-auth-email',
)
console.log(`OK: Vault holds send_email_internal_secret for ${ref} — the relay now sends the header`)

// -- 3. the edge-function secret. THIS is the instant enforcement turns on. --------------------
await setEdgeSecretAndVerify(relaySecret)
