#!/usr/bin/env node
/**
 * The three states seed-email-relay-vault.mjs can be in when the edge-secret write fails, and the
 * one it used to report for all three. Run: node scripts/lib/relay-enforcement-verdict.test.mjs
 */
import assert from 'node:assert/strict'
import { enforcementVerdict } from './relay-enforcement-verdict.mjs'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
let failed = 0

function check(name, fn) {
  try { fn(); console.log(`  ok   ${name}`) }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`) }
}

console.log('relay enforcement verdict')

check('first seeding — no edge secret yet — auth email still flows', () => {
  const v = enforcementVerdict({ edgeSecretExistedBefore: false, edgeDigestBefore: null, vaultDigestNow: A })
  assert.equal(v.authEmailBroken, false)
  assert.match(v.message, /still flows/)
})

check('re-run with the same value — the failed write changed nothing — auth email still flows', () => {
  const v = enforcementVerdict({ edgeSecretExistedBefore: true, edgeDigestBefore: A, vaultDigestNow: A })
  assert.equal(v.authEmailBroken, false)
  assert.match(v.message, /still flows/)
})

check('ROTATION — Vault moved on, the edge did not — auth email is rejected right now', () => {
  const v = enforcementVerdict({ edgeSecretExistedBefore: true, edgeDigestBefore: A, vaultDigestNow: B })
  assert.equal(v.authEmailBroken, true)
  assert.match(v.message, /REJECTED RIGHT NOW/)
  assert.doesNotMatch(v.message, /still flows/)
})

check('an edge secret whose digest could not be read is treated as a mismatch, not as safe', () => {
  const v = enforcementVerdict({ edgeSecretExistedBefore: true, edgeDigestBefore: null, vaultDigestNow: B })
  assert.equal(v.authEmailBroken, true)
})

check('no verdict ever prints a secret — only 64-hex digests go in and none comes out', () => {
  for (const v of [
    enforcementVerdict({ edgeSecretExistedBefore: false, edgeDigestBefore: null, vaultDigestNow: A }),
    enforcementVerdict({ edgeSecretExistedBefore: true, edgeDigestBefore: A, vaultDigestNow: A }),
    enforcementVerdict({ edgeSecretExistedBefore: true, edgeDigestBefore: A, vaultDigestNow: B }),
  ]) {
    assert.doesNotMatch(v.message, /[0-9a-f]{32,}/, 'a digest leaked into the operator-facing message')
  }
})

if (failed) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
