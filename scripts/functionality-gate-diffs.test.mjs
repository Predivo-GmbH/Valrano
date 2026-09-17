#!/usr/bin/env node
/**
 * FINISH-TEST for the functionality gate's empty-range defect (row
 * signal-Valrano:73c3e30:functionality-gate-diffs-main-aga).
 *
 * THE DEFECT. The BLOCKING "Nothing new shipped without its test" gate (deploy.yml, prod-promotion
 * job) ran `node scripts/check-new-functionality-registered.mjs` with no --diff, so it used
 * defaultRange() = `${base}...HEAD` for the first of origin/main / origin/master / main / master
 * that resolved. A production promotion is a workflow_dispatch off main, so the checkout IS main:
 * `main...HEAD` (or `origin/main...HEAD`) is a commit compared against ITSELF — an EMPTY range. The
 * gate diffed nothing, saw zero new functionality, and passed everything. It could never block.
 *
 * Valrano runs the gate from the repository ROOT (no `working-directory: app`), so it does NOT have
 * the sibling products' app/-path double-join bug — the single defect here is the empty range.
 *
 * This suite builds throwaway git repos in the exact state a production deploy runs in (main ==
 * HEAD) and drives the REAL scripts. Each check asserts the fixed behaviour and would fail against
 * the pre-fix code. Run: `node scripts/functionality-gate-diffs.test.mjs`.
 */

import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const CHECK = join(HERE, 'check-new-functionality-registered.mjs')
const RECOGNISE = join(HERE, 'recognise-functionality.mjs')
const { defaultRange } = await import('./check-new-functionality-registered.mjs')

let passed = 0
const ok = (name) => { console.log(`  ok  ${name}`); passed++ }

function git(cwd, ...a) { execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }) }

/**
 * A fresh flat repo (Valrano's shape: src/, docs/, e2e/ at the root — no app/ subtree). The change
 * under test adds a brand-new route (a thing a user can newly do). `registered` = that route also
 * gets an F-row and a real test file, so the gate should PASS.
 */
function makeRepo({ registered }) {
  const root = mkdtempSync(join(tmpdir(), 'valgate-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'docs'), { recursive: true })
  mkdirSync(join(root, 'e2e'), { recursive: true })
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  git(root, 'config', 'core.autocrlf', 'false')
  writeFileSync(join(root, 'src', 'App.tsx'), 'export default function App(){return null}\n')
  let features = '# Features\n\n### F-001: See the home screen\n- **Test Files:** E2E: `e2e/home.spec.ts`\n'
  if (registered) {
    features += '\n### F-002: Open the reports page\n- **Status:** tested\n- **Test Files:** E2E: `e2e/reports.spec.ts`\n'
    writeFileSync(join(root, 'e2e', 'reports.spec.ts'), 'test\n')
  }
  writeFileSync(join(root, 'docs', 'FEATURES.md'), features)
  writeFileSync(join(root, 'e2e', 'home.spec.ts'), 'test\n')
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'baseline')
  // the change under test: a brand-new route (a thing a user can newly do)
  writeFileSync(join(root, 'src', 'App.tsx'),
    'export default function App(){return <Route path="/reports" element={<R/>}/> }\n')
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'add reports route')
  // main == HEAD: this is exactly the state a production promotion of main runs in
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim()
  const main = execFileSync('git', ['rev-parse', 'main'], { cwd: root, encoding: 'utf-8' }).trim()
  assert.equal(head, main, 'fixture precondition: main must equal HEAD')
  return { root }
}

function runCheck(root) {
  try {
    const stdout = execFileSync(process.execPath, [CHECK], { cwd: root, encoding: 'utf-8' })
    return { code: 0, out: stdout }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}

console.log('functionality-gate-diffs.test.mjs')

// ── DEFECT: defaultRange never yields an empty range on a production (main) deploy ────────────
{
  const { root } = makeRepo({ registered: false })
  // the pre-fix range: main...HEAD, which is EMPTY here (documents the bug)
  const emptyDiff = execFileSync('git', ['diff', '--name-only', 'main...HEAD'], { cwd: root, encoding: 'utf-8' }).trim()
  assert.equal(emptyDiff, '', 'precondition: main...HEAD is empty when main == HEAD')
  const range = defaultRange(root)
  assert.notEqual(range, 'main...HEAD', 'defaultRange must not return the empty main...HEAD')
  assert.notEqual(range, 'origin/main...HEAD')
  const chosenDiff = execFileSync('git', ['diff', '--name-only', range], { cwd: root, encoding: 'utf-8' }).trim()
  assert.ok(chosenDiff.length > 0, `defaultRange (${range}) must select a non-empty diff, got empty`)
  rmSync(root, { recursive: true, force: true })
  ok('defaultRange yields a non-empty range when main == HEAD (production deploy)')
}

// ── DEFECT (env): an explicit production baseline is honoured ─────────────────────────────────
{
  const { root } = makeRepo({ registered: false })
  const base = execFileSync('git', ['rev-parse', 'HEAD~1'], { cwd: root, encoding: 'utf-8' }).trim()
  process.env.FUNCTIONALITY_GATE_BASE = base
  const range = defaultRange(root)
  delete process.env.FUNCTIONALITY_GATE_BASE
  assert.equal(range, `${base}...HEAD`, 'FUNCTIONALITY_GATE_BASE must be used as the base')
  rmSync(root, { recursive: true, force: true })
  ok('FUNCTIONALITY_GATE_BASE sets the production baseline')
}

// ── the recogniser SEES the changed root file (Valrano scans from ROOT, no app/ prefix) ───────
{
  const { root } = makeRepo({ registered: false })
  const out = execFileSync(process.execPath,
    [RECOGNISE, '--root', root, '--diff', 'HEAD~1...HEAD', '--json'], { cwd: root, encoding: 'utf-8' })
  const rep = JSON.parse(out)
  assert.equal(rep.total, 1, `recogniser must see the 1 changed functionality, saw ${rep.total}`)
  assert.equal(rep.items[0].kind, 'route')
  assert.match(rep.items[0].evidence[0], /^src\/App\.tsx:/, 'evidence path must be repo-root-relative')
  rmSync(root, { recursive: true, force: true })
  ok('recogniser resolves the changed src/ file from the repository root')
}

// ── END TO END: unregistered new functionality is REFUSED on a main deploy ────────────────────
{
  const { root } = makeRepo({ registered: false })
  const r = runCheck(root) // no --diff -> exercises the fixed defaultRange
  assert.equal(r.code, 1, `gate must REFUSE an untested new functionality, exit was ${r.code}\n${r.out}`)
  assert.match(r.out, /Open the page at \/reports/, 'refusal must name the new route it caught')
  assert.match(r.out, /REFUSED/)
  rmSync(root, { recursive: true, force: true })
  ok('gate refuses an unregistered new functionality on a main deploy')
}

// ── END TO END: the same change PASSES once it has a row and a test (gate is not always-red) ───
{
  const { root } = makeRepo({ registered: true })
  const r = runCheck(root)
  assert.equal(r.code, 0, `gate must PASS when the new functionality is registered+tested, exit was ${r.code}\n${r.out}`)
  rmSync(root, { recursive: true, force: true })
  ok('gate passes when the new functionality has a row and a real test file')
}

console.log(`\n${passed}/5 checks passed`)
assert.equal(passed, 5)
