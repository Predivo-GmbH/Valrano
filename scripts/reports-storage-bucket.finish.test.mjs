#!/usr/bin/env node
/**
 * FINISH-TEST for row: valrano-test-copy-cannot-take-a-report-2026-09-24
 *
 * The defect: the `reports` storage bucket — where every uploaded and downloaded
 * company PDF lives — was created by hand in production and never captured in a
 * migration. Any fresh copy of the database (the staging/test project) therefore
 * had no `reports` bucket, and upload-report failed with "Bucket not found":
 * "the test copy cannot take a report, its report storage is missing."
 *
 * "Finished" means, checkably:
 *   1. Every storage bucket that an edge function reads/writes via
 *      `.storage.from('<bucket>')` is created by a migration. (This is the
 *      regression class — a used bucket with no migration behind it.)
 *   2. In particular the `reports` bucket is created, idempotently
 *      (ON CONFLICT DO NOTHING, so it is safe to re-run against prod).
 *   3. If staging service-role credentials are present in the environment, the
 *      `reports` bucket actually exists in the live staging project.
 *
 * Exit 0 = finished. Runs with no network/credentials (checks 1 & 2); the live
 * check (3) runs only when SUPABASE_STAGING_URL + SUPABASE_STAGING_SERVICE_ROLE_KEY
 * are set (they are in CI), and is skipped, not failed, when they are absent.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions')

function readAllMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
}

/** Collect bucket ids referenced by edge functions via .storage.from('<id>'). */
function bucketsUsedByFunctions() {
  const ids = new Set()
  const re = /\.storage\s*\.from\(\s*['"]([^'"]+)['"]\s*\)/g
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(p); continue }
      if (!entry.name.endsWith('.ts')) continue
      const src = fs.readFileSync(p, 'utf8')
      let m
      while ((m = re.exec(src)) !== null) ids.add(m[1])
    }
  }
  walk(FUNCTIONS_DIR)
  return ids
}

let ran = 0
function check(name, fn) {
  fn()
  ran++
  console.log(`  ok - ${name}`)
}

console.log('reports-storage-bucket.finish.test.mjs')

const allSql = readAllMigrations()
const usedBuckets = bucketsUsedByFunctions()

// (1) every storage bucket an edge function uses must be created by a migration
check('every storage bucket used by an edge function is created by a migration', () => {
  assert.ok(usedBuckets.size > 0, 'expected at least one .storage.from() reference in edge functions')
  for (const id of usedBuckets) {
    const created = new RegExp(
      `insert\\s+into\\s+storage\\.buckets[\\s\\S]*?['"]${id}['"]`,
      'i',
    ).test(allSql)
    assert.ok(created, `storage bucket "${id}" is used by an edge function but no migration creates it`)
  }
})

// (2) the reports bucket specifically is created, idempotently
check('the `reports` bucket is created by a migration', () => {
  assert.ok(usedBuckets.has('reports'), 'expected the reports bucket to be referenced by an edge function')
  assert.match(
    allSql,
    /insert\s+into\s+storage\.buckets[\s\S]*?['"]reports['"]/i,
    'no migration inserts the `reports` bucket',
  )
})

check('the `reports` bucket creation is idempotent (ON CONFLICT DO NOTHING)', () => {
  // Find the statement that inserts the reports bucket and confirm it guards on conflict.
  const stmt = allSql
    .split(';')
    .find((s) => /insert\s+into\s+storage\.buckets/i.test(s) && /['"]reports['"]/i.test(s))
  assert.ok(stmt, 'could not locate the reports-bucket INSERT statement')
  assert.match(stmt, /on\s+conflict[\s\S]*do\s+nothing/i,
    'reports-bucket INSERT must be idempotent (ON CONFLICT ... DO NOTHING) so it is safe to re-run against prod')
})

// (3) live check against staging when credentials are available (CI)
const stagingUrl = process.env.SUPABASE_STAGING_URL
const stagingKey = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY
if (stagingUrl && stagingKey) {
  const res = await fetch(`${stagingUrl.replace(/\/$/, '')}/storage/v1/bucket/reports`, {
    headers: { apikey: stagingKey, Authorization: `Bearer ${stagingKey}` },
  })
  check('the `reports` bucket exists in the live staging project', () => {
    assert.equal(res.status, 200, `staging GET /storage/v1/bucket/reports returned ${res.status}, expected 200 (bucket present)`)
  })
} else {
  console.log('  skip - live staging check (SUPABASE_STAGING_URL / SUPABASE_STAGING_SERVICE_ROLE_KEY not set)')
}

console.log(`\nPASS - ${ran} check(s) passed. The reports storage bucket is provisioned by a migration.`)
